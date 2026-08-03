import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createLiveGenerator, LiveGenerationError } from './client.ts';

test('posts the public generation contract and returns text', async () => {
  let sent = '';
  const generate = createLiveGenerator({
    endpoint: 'https://example.test/api/generate',
    fetchImpl: async (_url, init) => {
      sent = String(init?.body);
      return new Response(JSON.stringify({ text: 'The curtain rises.', requestId: '1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  const text = await generate({ kind: 'opening', premiseId: 'wedding', performanceId: 'performance-1' });
  assert.equal(text, 'The curtain rises.');
  assert.deepEqual(JSON.parse(sent), { kind: 'opening', premiseId: 'wedding', performanceId: 'performance-1' });
});

test('normalizes server failures into a typed client error', async () => {
  const generate = createLiveGenerator({
    fetchImpl: async () => new Response(JSON.stringify({
      error: 'Too many generation requests',
      code: 'rate_limited',
    }), { status: 429, headers: { 'Content-Type': 'application/json' } }),
  });
  await assert.rejects(
    generate({ kind: 'opening', premiseId: 'wedding', performanceId: 'performance-1' }),
    (error: unknown) => error instanceof LiveGenerationError && error.code === 'rate_limited',
  );
});
