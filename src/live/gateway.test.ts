import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createGenerateHandler, type GatewayResponse } from './gateway.ts';
import { createRateLimiter } from './rate-limit.ts';

function responseRecorder() {
  const record = { status: 0, headers: new Map<string, string>(), body: undefined as unknown };
  const response: GatewayResponse = {
    status(code) {
      record.status = code;
      return response;
    },
    setHeader(name, value) {
      record.headers.set(name.toLowerCase(), String(value));
    },
    json(body) {
      record.body = body;
    },
  };
  return { record, response };
}

test('keeps the provider token on the server and returns cleaned output', async () => {
  let authorization = '';
  const handler = createGenerateHandler({
    env: { HF_TOKEN: 'server-secret', MODEL: 'test-model' },
    createRequestId: () => 'request-1',
    limiter: createRateLimiter({ limit: 10, windowMs: 1000 }),
    fetchImpl: async (_url, init) => {
      authorization = new Headers(init?.headers).get('authorization') ?? '';
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Meera: I am certainly the bride.' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  const { record, response } = responseRecorder();

  await handler({
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.1' },
    body: {
      kind: 'beat',
      premiseId: 'wedding', performanceId: 'performance-1',
      speakerName: 'Meera',
      script: 'NARRATOR: The hall is ready.',
    },
  }, response);

  assert.equal(record.status, 200);
  assert.equal(authorization, 'Bearer server-secret');
  assert.deepEqual(record.body, {
    text: 'I am certainly the bride.',
    requestId: 'request-1',
    model: 'test-model',
  });
  assert.equal(JSON.stringify(record.body).includes('server-secret'), false);
});

test('rejects malformed requests before calling the provider', async () => {
  let calls = 0;
  const handler = createGenerateHandler({
    env: { HF_TOKEN: 'server-secret' },
    limiter: createRateLimiter({ limit: 10, windowMs: 1000 }),
    fetchImpl: async () => {
      calls += 1;
      return new Response('{}');
    },
  });
  const { record, response } = responseRecorder();
  await handler({ method: 'POST', body: { kind: 'opening', premiseId: 'unknown' } }, response);
  assert.equal(record.status, 400);
  assert.equal(calls, 0);
});

test('returns 429 before provider work when rate limited', async () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
  const handler = createGenerateHandler({
    env: { HF_TOKEN: 'server-secret' },
    limiter,
    fetchImpl: async () => new Response('{}'),
  });
  const first = responseRecorder();
  await handler({ method: 'POST', body: { kind: 'opening', premiseId: 'wedding', performanceId: 'performance-1' } }, first.response);
  const second = responseRecorder();
  await handler({ method: 'POST', body: { kind: 'opening', premiseId: 'wedding', performanceId: 'performance-1' } }, second.response);
  assert.equal(second.record.status, 429);
  assert.equal((second.record.body as { code: string }).code, 'rate_limited');
});

test('returns a safe provider error without leaking response details', async () => {
  const handler = createGenerateHandler({
    env: { HF_TOKEN: 'server-secret' },
    limiter: createRateLimiter({ limit: 10, windowMs: 1000 }),
    fetchImpl: async () => new Response('upstream secret detail', { status: 500 }),
  });
  const { record, response } = responseRecorder();
  await handler({ method: 'POST', body: { kind: 'opening', premiseId: 'wedding', performanceId: 'performance-1' } }, response);
  assert.equal(record.status, 502);
  assert.deepEqual(
    { ...(record.body as object), requestId: undefined },
    { error: 'Live generation failed', code: 'provider_error', requestId: undefined },
  );
  assert.equal(JSON.stringify(record.body).includes('upstream secret detail'), false);
});
