import { randomUUID } from 'node:crypto';

import type { CountTokens } from '../engine/types.ts';
import {
  addDirectorNote,
  advanceGameSession,
  canFinish,
  commitGeneratedBeat,
  commitGeneratedCurtain,
  commitGeneratedOpening,
  createGameSession,
  LIVE_BUDGET,
  LIVE_EXTENSION_ROUNDS,
  LIVE_ROUNDS,
  pinBeat,
  prepareGameBeat,
  replacementFor,
  snapshotSession,
} from '../game/session.ts';
import {
  MAX_NOTE_CHARS,
  isPerformanceAction,
  type PerformanceRequest,
  type PerformanceResponse,
  type PerformanceSource,
} from './contract.ts';
import {
  createInMemoryPerformanceStore,
  type PerformanceStore,
  type StoredPerformance,
} from './performance-store.ts';
import {
  buildBeatGeneration,
  buildCurtainGeneration,
  buildOpeningGeneration,
  findPremise,
  type TrustedGeneration,
} from './prompts.ts';
import { createRateLimiter, type RateLimiter } from './rate-limit.ts';
import { loadModelTokenCounter } from './tokenizer.ts';

const HUGGING_FACE_ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';
const DEFAULT_MODEL = 'Qwen/Qwen3-4B-Instruct-2507';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 4_000;
const MAX_PERFORMANCE_STEPS = 40;
const SHARED_REQUESTS_PER_MINUTE = 40;
const SHARED_CAPACITY_BUCKET = 'serverless-instance';

export type GatewayRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
};

export type GatewayResponse = {
  status(code: number): GatewayResponse;
  setHeader(name: string, value: string | number): void;
  json(body: unknown): void;
  end?(): void;
};

export type FetchLike = typeof fetch;

export type GatewayOptions = {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  limiter?: RateLimiter;
  store?: PerformanceStore;
  loadCountTokens?: (model: string) => Promise<CountTokens>;
  createRequestId?: () => string;
  createPerformanceId?: () => string;
  timeoutMs?: number;
};

const defaultLimiter = createRateLimiter({ limit: SHARED_REQUESTS_PER_MINUTE, windowMs: 60_000 });
const defaultStore = createInMemoryPerformanceStore();

function parseBody(body: unknown): Record<string, unknown> {
  let value = body;
  if (typeof value === 'string') {
    if (Buffer.byteLength(value, 'utf8') > MAX_BODY_BYTES) throw new Error('request body is too large');
    try {
      value = JSON.parse(value);
    } catch {
      throw new Error('request body must be valid JSON');
    }
  } else {
    const serialized = JSON.stringify(value ?? null);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) throw new Error('request body is too large');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('request body must be an object');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${name} must not be empty`);
  if (trimmed.length > maxLength) throw new Error(`${name} is too long`);
  return trimmed;
}

function parsePerformanceRequest(body: unknown): PerformanceRequest {
  const input = parseBody(body);
  if ('script' in input || 'speakerName' in input || 'transcript' in input) {
    throw new Error('client-controlled transcript and speaker fields are not accepted');
  }
  if (!isPerformanceAction(input.action)) {
    throw new Error('action must be start, advance, pin, direction or finish');
  }
  if (input.action === 'start') {
    const premiseId = requiredString(input.premiseId, 'premiseId', 64);
    findPremise(premiseId);
    return { action: 'start', premiseId };
  }

  const performanceId = requiredString(input.performanceId, 'performanceId', 128);
  if (input.action === 'pin') {
    if (!Number.isInteger(input.beatId) || Number(input.beatId) < 0) {
      throw new Error('beatId must be a non-negative integer');
    }
    return { action: 'pin', performanceId, beatId: Number(input.beatId) };
  }
  if (input.action === 'direction') {
    return {
      action: 'direction',
      performanceId,
      note: requiredString(input.note, 'note', MAX_NOTE_CHARS),
    };
  }
  return { action: input.action, performanceId };
}

function send(res: GatewayResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function errorCode(message: string): string {
  if (message.includes('too large')) return 'body_too_large';
  if (message.includes('valid JSON')) return 'invalid_json';
  if (message.includes('curtain')) return 'not_ready';
  return 'invalid_request';
}

async function fetchCompletion(opts: {
  endpoint: string;
  token?: string;
  model: string;
  generation: TrustedGeneration;
  fetchImpl: FetchLike;
  timeoutMs: number;
}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const response = await opts.fetchImpl(opts.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: opts.model,
        messages: opts.generation.messages,
        max_tokens: opts.generation.maxTokens,
        temperature: opts.generation.temperature,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`model provider returned ${response.status}`);
    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('model provider returned an empty completion');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function chatEndpointConfiguration(env: Record<string, string | undefined>): {
  endpoint: string;
  token?: string;
} | null {
  const configuredEndpoint = env.AI_CHAT_ENDPOINT?.trim();
  const endpoint = configuredEndpoint || HUGGING_FACE_ENDPOINT;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const hostname = url.hostname.toLowerCase();
  const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  // Never forward a Hugging Face credential to a custom provider. A custom
  // endpoint must use its own token, while exact loopback may run tokenless.
  const token = (configuredEndpoint ? env.AI_CHAT_TOKEN : env.HF_TOKEN)?.trim() || undefined;
  if (!loopback && !token) return null;
  return { endpoint: url.toString(), ...(token ? { token } : {}) };
}

function publicFallbackReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/hedged|uncertain|duplicat/i.test(message)) return 'The model answer broke the certainty rule.';
  return 'The live model was unavailable for this beat.';
}

function responseFor(
  performance: StoredPerformance,
  requestId: string,
  source: PerformanceSource,
  beat?: PerformanceResponse['beat'],
  fallbackReason?: string,
): PerformanceResponse {
  return {
    performanceId: performance.id,
    beat,
    snapshot: snapshotSession(performance.session),
    drift: performance.session.engine.drift(),
    source,
    requestId,
    model: performance.model,
    ...(fallbackReason ? { fallbackReason } : {}),
  };
}

export function createGenerateHandler(options: GatewayOptions = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const limiter = options.limiter ?? defaultLimiter;
  const store = options.store ?? defaultStore;
  const loadCountTokens = options.loadCountTokens ?? loadModelTokenCounter;
  const createRequestId = options.createRequestId ?? randomUUID;
  const createPerformanceId = options.createPerformanceId ?? randomUUID;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async function generate(req: GatewayRequest, res: GatewayResponse): Promise<void> {
    const requestId = createRequestId();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Request-Id', requestId);

    if ((req.method ?? 'POST').toUpperCase() !== 'POST') {
      res.setHeader('Allow', 'POST');
      send(res, 405, { error: 'Method not allowed', code: 'method_not_allowed', requestId });
      return;
    }

    // The adapter has no trusted client identity. One server-owned bucket is
    // deliberately harder to evade than X-Forwarded-For or a public id.
    const limit = limiter.take(SHARED_CAPACITY_BUCKET);
    res.setHeader('X-RateLimit-Remaining', limit.remaining);
    if (!limit.allowed) {
      res.setHeader('Retry-After', limit.retryAfterSeconds);
      send(res, 429, { error: 'Too many performance requests', code: 'rate_limited', requestId });
      return;
    }

    const provider = chatEndpointConfiguration(env);
    if (!provider) {
      send(res, 503, { error: 'Live generation is not configured', code: 'not_configured', requestId });
      return;
    }

    try {
      const action = parsePerformanceRequest(req.body);

      if (action.action === 'start') {
        const model = env.MODEL ?? DEFAULT_MODEL;
        const tokenizerModel = env.TOKENIZER_MODEL?.trim() || model;
        let countTokens: CountTokens;
        try {
          countTokens = await loadCountTokens(tokenizerModel);
        } catch {
          send(res, 503, {
            error: 'The serving-model tokenizer could not be loaded',
            code: 'tokenizer_unavailable',
            requestId,
          });
          return;
        }
        const premise = findPremise(action.premiseId);
        const session = createGameSession(action.premiseId, premise.premise, undefined, {
          commitOpening: false,
          countTokens,
          budget: LIVE_BUDGET,
          rounds: LIVE_ROUNDS,
          requiredContradictions: 1,
          maxExtensionRounds: LIVE_EXTENSION_ROUNDS,
        });
        const performance: StoredPerformance = {
          id: createPerformanceId(),
          model,
          session,
          steps: 1,
          touchedAt: Date.now(),
        };
        let source: PerformanceSource = 'model';
        let fallbackReason: string | undefined;
        let beat;
        try {
          const text = await fetchCompletion({
            endpoint: provider.endpoint,
            token: provider.token,
            model,
            generation: buildOpeningGeneration(action.premiseId),
            fetchImpl,
            timeoutMs,
          });
          beat = commitGeneratedOpening(session, text);
        } catch (error) {
          source = 'safety-fallback';
          fallbackReason = publicFallbackReason(error);
          beat = commitGeneratedOpening(session);
        }
        store.create(performance);
        send(res, 200, responseFor(performance, requestId, source, beat, fallbackReason));
        return;
      }

      const performance = store.get(action.performanceId);
      if (!performance) {
        send(res, 410, {
          error: 'This live performance expired. Start a new show.',
          code: 'session_expired',
          requestId,
        });
        return;
      }
      if (performance.steps >= MAX_PERFORMANCE_STEPS) {
        send(res, 429, {
          error: 'Performance request limit reached',
          code: 'performance_limit',
          requestId,
        });
        return;
      }
      performance.steps += 1;

      if (action.action === 'pin') {
        if (!pinBeat(performance.session, action.beatId)) {
          throw new Error('that beat cannot be pinned');
        }
        send(res, 200, responseFor(performance, requestId, 'state-only'));
        return;
      }

      if (action.action === 'direction') {
        const beat = addDirectorNote(performance.session, action.note);
        send(res, 200, responseFor(performance, requestId, 'state-only', beat));
        return;
      }

      if (action.action === 'advance') {
        const prepared = prepareGameBeat(performance.session);
        let source: PerformanceSource = 'model';
        let fallbackReason: string | undefined;
        let beat;
        try {
          const text = await fetchCompletion({
            endpoint: provider.endpoint,
            token: provider.token,
            model: performance.model,
            generation: buildBeatGeneration(performance.session, prepared.speaker),
            fetchImpl,
            timeoutMs,
          });
          try {
            beat = commitGeneratedBeat(performance.session, prepared.speaker, text);
          } catch (error) {
            if (!/hedged|uncertain|duplicat/i.test(error instanceof Error ? error.message : String(error))) {
              throw error;
            }
            source = 'safety-fallback';
            fallbackReason = publicFallbackReason(error);
            beat = advanceGameSession(performance.session, prepared.speaker);
          }
        } catch (error) {
          source = 'safety-fallback';
          fallbackReason = publicFallbackReason(error);
          const priorResponses = performance.session.pendingProbe
            ? performance.session.contradictions.find(
              (event) => event.lostSeed.id === performance.session.pendingProbe!.lostSeed.id,
            )?.responses ?? []
            : [];
          const fallback = performance.session.pendingProbe
            ? replacementFor(
              performance.session.premise,
              performance.session.pendingProbe,
              prepared.speaker,
              priorResponses,
            )
            : undefined;
          beat = fallback
            ? commitGeneratedBeat(performance.session, prepared.speaker, fallback)
            : advanceGameSession(performance.session, prepared.speaker);
        }
        send(res, 200, responseFor(performance, requestId, source, beat, fallbackReason));
        return;
      }

      if (!canFinish(performance.session)) {
        throw new Error('the curtain cannot fall before every round and probe response finish');
      }
      let source: PerformanceSource = 'model';
      let fallbackReason: string | undefined;
      let beat;
      try {
        const text = await fetchCompletion({
          endpoint: provider.endpoint,
          token: provider.token,
          model: performance.model,
          generation: buildCurtainGeneration(performance.session),
          fetchImpl,
          timeoutMs,
        });
        beat = commitGeneratedCurtain(performance.session, text);
      } catch (error) {
        source = 'safety-fallback';
        fallbackReason = publicFallbackReason(error);
        beat = commitGeneratedCurtain(
          performance.session,
          'The curtain falls while every actor insists their version was always the only play.',
        );
      }
      send(res, 200, responseFor(performance, requestId, source, beat, fallbackReason));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      send(res, message.includes('curtain') ? 409 : 400, {
        error: message,
        code: errorCode(message),
        requestId,
      });
    }
  };
}
