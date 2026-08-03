import { randomUUID } from 'node:crypto';

import { cleanOutput } from '../engine/theater.ts';
import { buildTrustedGeneration } from './prompts.ts';
import { createRateLimiter, type RateLimiter } from './rate-limit.ts';

const HUGGING_FACE_ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';
const DEFAULT_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 16_000;
const MAX_PERFORMANCE_STEPS = 20;

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
  createRequestId?: () => string;
  timeoutMs?: number;
};

const defaultLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

function header(req: GatewayRequest, name: string): string {
  const entry = Object.entries(req.headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  const value = entry?.[1];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function requestKey(req: GatewayRequest): string {
  const forwarded = header(req, 'x-forwarded-for').split(',')[0]?.trim();
  return forwarded || req.socket?.remoteAddress || 'anonymous';
}

function parseBody(body: unknown): unknown {
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw new Error('request body is too large');
    try {
      return JSON.parse(body);
    } catch {
      throw new Error('request body must be valid JSON');
    }
  }
  const serialized = JSON.stringify(body ?? null);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) throw new Error('request body is too large');
  return body;
}

function send(res: GatewayResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function errorCode(message: string): string {
  if (message.includes('too large')) return 'body_too_large';
  if (message.includes('valid JSON')) return 'invalid_json';
  return 'invalid_request';
}

async function fetchCompletion(opts: {
  token: string;
  model: string;
  generation: ReturnType<typeof buildTrustedGeneration>;
  fetchImpl: FetchLike;
  timeoutMs: number;
}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const response = await opts.fetchImpl(HUGGING_FACE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.token}`,
        'Content-Type': 'application/json',
      },
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

export function createGenerateHandler(options: GatewayOptions = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const limiter = options.limiter ?? defaultLimiter;
  const createRequestId = options.createRequestId ?? randomUUID;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const performanceSteps = new Map<string, { count: number; touchedAt: number }>();

  return async function generate(req: GatewayRequest, res: GatewayResponse): Promise<void> {
    const requestId = createRequestId();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Request-Id', requestId);

    if ((req.method ?? 'POST').toUpperCase() !== 'POST') {
      res.setHeader('Allow', 'POST');
      send(res, 405, { error: 'Method not allowed', code: 'method_not_allowed', requestId });
      return;
    }

    const limit = limiter.take(requestKey(req));
    res.setHeader('X-RateLimit-Remaining', limit.remaining);
    if (!limit.allowed) {
      res.setHeader('Retry-After', limit.retryAfterSeconds);
      send(res, 429, { error: 'Too many generation requests', code: 'rate_limited', requestId });
      return;
    }

    const token = env.HF_TOKEN;
    if (!token) {
      send(res, 503, { error: 'Live generation is not configured', code: 'not_configured', requestId });
      return;
    }

    try {
      const body = parseBody(req.body);
      const generation = buildTrustedGeneration(body);
      const performanceId = (body as { performanceId: string }).performanceId;
      const now = Date.now();
      for (const [id, entry] of performanceSteps) {
        if (now - entry.touchedAt > 6 * 60 * 60 * 1000) performanceSteps.delete(id);
      }
      const usage = performanceSteps.get(performanceId) ?? { count: 0, touchedAt: now };
      if (usage.count >= MAX_PERFORMANCE_STEPS) {
        send(res, 429, { error: 'Performance generation limit reached', code: 'performance_limit', requestId });
        return;
      }
      performanceSteps.set(performanceId, { count: usage.count + 1, touchedAt: now });
      const model = env.MODEL ?? DEFAULT_MODEL;
      const raw = await fetchCompletion({ token, model, generation, fetchImpl, timeoutMs });
      const speaker = generation.kind === 'beat'
        ? (body as { speakerName?: string }).speakerName ?? ''
        : 'The Narrator';
      send(res, 200, {
        text: cleanOutput(raw, speaker),
        requestId,
        model,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const providerFailure = message.startsWith('model provider') || message.includes('aborted');
      send(res, providerFailure ? 502 : 400, {
        error: providerFailure ? 'Live generation failed' : message,
        code: providerFailure ? 'provider_error' : errorCode(message),
        requestId,
      });
    }
  };
}
