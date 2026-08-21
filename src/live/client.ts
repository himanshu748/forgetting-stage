import type { PerformanceRequest, PerformanceResponse } from './contract.ts';

export type LivePerformanceClient = (request: PerformanceRequest) => Promise<PerformanceResponse>;

export type LivePerformanceClientOptions = {
  platform: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export class LiveGenerationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'LiveGenerationError';
    this.code = code;
  }
}

function isConfiguredNativeEndpoint(platform: string, endpoint: string | undefined): boolean {
  if (platform !== 'ios' && platform !== 'android') return true;
  try {
    return new URL(endpoint ?? '').protocol === 'https:';
  } catch {
    return false;
  }
}

function isPerformanceResponse(value: unknown): value is PerformanceResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const response = value as Partial<PerformanceResponse>;
  return typeof response.performanceId === 'string'
    && typeof response.requestId === 'string'
    && typeof response.model === 'string'
    && (response.source === 'model'
      || response.source === 'safety-fallback'
      || response.source === 'state-only')
    && !!response.snapshot
    && typeof response.snapshot === 'object'
    && !!response.drift
    && typeof response.drift === 'object';
}

export function createLivePerformanceClient(
  options: LivePerformanceClientOptions,
): LivePerformanceClient {
  const endpoint = options.endpoint ?? '/api/generate';
  const fetchImpl = options.fetchImpl ?? fetch;
  // A local preview can need one cold model load before subsequent beats are fast.
  // The production gateway still owns its shorter provider timeout.
  const timeoutMs = options.timeoutMs ?? 45_000;

  return async (request) => {
    if (!isConfiguredNativeEndpoint(options.platform, options.endpoint)) {
      throw new LiveGenerationError('Live generation is not configured for this build', 'unconfigured');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const body = await response.json() as unknown;
      if (!response.ok || !isPerformanceResponse(body)) {
        const error = body && typeof body === 'object'
          ? body as { error?: unknown; code?: unknown }
          : {};
        throw new LiveGenerationError(
          typeof error.error === 'string'
            ? error.error
            : `Performance request failed with status ${response.status}`,
          typeof error.code === 'string' ? error.code : 'generation_failed',
        );
      }
      return body;
    } catch (error) {
      if (error instanceof LiveGenerationError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LiveGenerationError('Live generation timed out', 'timeout');
      }
      throw new LiveGenerationError('Live generation is unavailable', 'unavailable');
    } finally {
      clearTimeout(timeout);
    }
  };
}
