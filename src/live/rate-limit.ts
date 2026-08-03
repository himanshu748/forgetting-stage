export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimiter = {
  take(key: string, now?: number): RateLimitResult;
};

/**
 * Small in-memory limiter for a single serverless instance. It is intentionally
 * dependency-free. Production deployments can replace it with a shared store
 * without changing the API handler contract.
 */
export function createRateLimiter(opts: { limit: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, number[]>();

  return {
    take(key, now = Date.now()) {
      const start = now - opts.windowMs;
      const recent = (buckets.get(key) ?? []).filter((timestamp) => timestamp > start);
      if (recent.length >= opts.limit) {
        const retryAt = recent[0]! + opts.windowMs;
        buckets.set(key, recent);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1000)),
        };
      }

      recent.push(now);
      buckets.set(key, recent);
      return {
        allowed: true,
        remaining: Math.max(0, opts.limit - recent.length),
        retryAfterSeconds: 0,
      };
    },
  };
}
