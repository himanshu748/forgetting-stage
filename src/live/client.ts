import type { GenerationRequest, GenerationResponse } from './contract.ts';

export type LiveGenerator = (request: GenerationRequest) => Promise<string>;

export type LiveGeneratorOptions = {
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

export function createLiveGenerator(options: LiveGeneratorOptions = {}): LiveGenerator {
  const endpoint = options.endpoint ?? '/api/generate';
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;

  return async (request) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const body = await response.json() as Partial<GenerationResponse> & {
        error?: string;
        code?: string;
      };
      if (!response.ok || typeof body.text !== 'string' || !body.text.trim()) {
        throw new LiveGenerationError(
          body.error ?? `Generation failed with status ${response.status}`,
          body.code ?? 'generation_failed',
        );
      }
      return body.text.trim();
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
