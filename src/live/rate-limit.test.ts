import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRateLimiter } from './rate-limit.ts';

test('limits each key inside a sliding window', () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(limiter.take('a', 1000).allowed, true);
  assert.equal(limiter.take('a', 1100).allowed, true);
  const blocked = limiter.take('a', 1200);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  assert.equal(limiter.take('b', 1200).allowed, true);
  assert.equal(limiter.take('a', 2101).allowed, true);
});
