import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DailyPassState } from './daily-pass.ts';
import {
  consumeAndPersistPerformance,
  consumeSessionEncore,
  createPerformanceLaunchGate,
  recordPurchasedEncore,
} from './launch.ts';

const now = new Date(2026, 7, 21, 10, 0, 0);
const availablePass: DailyPassState = {
  dayKey: '2026-08-21',
  used: 0,
  remaining: 1,
  encores: 0,
  unlimited: false,
  nextRefreshAt: '2026-08-22T00:00:00.000Z',
};

test('a delayed save admits only one of two synchronous launch attempts', async () => {
  let resolveSave: (() => void) | undefined;
  const delayedSave = new Promise<void>((resolve) => { resolveSave = resolve; });
  let saveCalls = 0;
  const gate = createPerformanceLaunchGate();
  const attempt = () => gate.run(() => consumeAndPersistPerformance({
    pass: availablePass,
    saveLedger: async () => {
      saveCalls += 1;
      await delayedSave;
    },
    now,
  }));

  const first = attempt();
  assert.equal(gate.isActive(), true);
  const second = await attempt();
  assert.equal(second.status, 'busy');
  assert.equal(saveCalls, 1);

  resolveSave?.();
  const firstResult = await first;
  assert.equal(firstResult.status, 'complete');
  if (firstResult.status === 'complete') {
    assert.equal(firstResult.value.status, 'consumed');
  }
  assert.equal(gate.isActive(), false);
});

test('a failed consumption save keeps the original in-memory access', async () => {
  const result = await consumeAndPersistPerformance({
    pass: availablePass,
    saveLedger: async () => { throw new Error('disk full'); },
    now,
  });

  assert.equal(result.status, 'persistence-error');
  assert.deepEqual(result.pass, availablePass);
});

test('a purchased encore reports successful persistence separately', async () => {
  const result = await recordPurchasedEncore({
    pass: availablePass,
    saveLedger: async () => {},
    now,
  });

  assert.equal(result.persisted, true);
  assert.equal(result.pass.encores, 1);
});

test('a post-purchase save failure retains the bought encore for this run', async () => {
  const result = await recordPurchasedEncore({
    pass: availablePass,
    saveLedger: async () => { throw new Error('disk full'); },
    now,
  });

  assert.equal(result.persisted, false);
  assert.equal(result.pass.encores, 1);
  assert.equal(result.pass.remaining, 1);

  const consumed = consumeSessionEncore(result.pass);
  assert.equal(consumed.encores, 0);
  assert.equal(consumed.remaining, 1);
  assert.equal(consumed.used, 0);
});
