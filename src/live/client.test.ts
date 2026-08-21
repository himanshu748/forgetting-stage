import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createGameSession, snapshotSession } from '../game/session.ts';
import { createLivePerformanceClient, LiveGenerationError } from './client.ts';

function responseBody() {
  const session = createGameSession('wedding', 'a wedding');
  return {
    performanceId: 'performance-1',
    snapshot: snapshotSession(session),
    drift: session.engine.drift(),
    source: 'model',
    requestId: 'request-1',
    model: 'test-model',
  } as const;
}

test('posts an action-only performance request and returns authoritative state', async () => {
  let sent = '';
  const client = createLivePerformanceClient({
    platform: 'ios',
    endpoint: 'https://example.test/api/generate',
    fetchImpl: async (_url, init) => {
      sent = String(init?.body);
      return new Response(JSON.stringify(responseBody()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  const response = await client({ action: 'start', premiseId: 'wedding' });
  assert.equal(response.performanceId, 'performance-1');
  assert.deepEqual(JSON.parse(sent), { action: 'start', premiseId: 'wedding' });
});

test('normalizes server failures into a typed client error', async () => {
  const client = createLivePerformanceClient({
    platform: 'web',
    fetchImpl: async () => new Response(JSON.stringify({
      error: 'Too many performance requests',
      code: 'rate_limited',
    }), { status: 429, headers: { 'Content-Type': 'application/json' } }),
  });
  await assert.rejects(
    client({ action: 'start', premiseId: 'wedding' }),
    (error: unknown) => error instanceof LiveGenerationError && error.code === 'rate_limited',
  );
});

test('rejects malformed success bodies instead of trusting partial state', async () => {
  const client = createLivePerformanceClient({
    platform: 'web',
    fetchImpl: async () => new Response(JSON.stringify({
      performanceId: 'performance-1',
      requestId: 'request-1',
      source: 'model',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  });
  await assert.rejects(
    client({ action: 'start', premiseId: 'wedding' }),
    (error: unknown) => error instanceof LiveGenerationError
      && error.code === 'generation_failed',
  );
});

test('rejects unconfigured native endpoints before invoking fetch', async () => {
  for (const endpoint of [undefined, '/api/generate', 'http://example.test/api/generate']) {
    let fetchCalls = 0;
    const client = createLivePerformanceClient({
      platform: 'android',
      endpoint,
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error('fetch must not run');
      },
    });
    await assert.rejects(
      client({ action: 'start', premiseId: 'wedding' }),
      (error: unknown) => error instanceof LiveGenerationError
        && error.code === 'unconfigured'
        && error.message === 'Live generation is not configured for this build',
    );
    assert.equal(fetchCalls, 0, `fetch was invoked for ${endpoint ?? 'an absent endpoint'}`);
  }
});
