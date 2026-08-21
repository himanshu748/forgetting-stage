import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dailyPassAccess } from './access.ts';
import type { DailyPassState } from './daily-pass.ts';

const availablePass: DailyPassState = {
  dayKey: '2026-08-21',
  used: 0,
  remaining: 1,
  encores: 0,
  unlimited: false,
  nextRefreshAt: '2026-08-22T00:00:00.000Z',
};

test('holds the curtain while daily access is still loading', () => {
  assert.equal(dailyPassAccess(null), 'checking');
});

test('sends a spent daily pass with no encores to the box office', () => {
  const spentPass: DailyPassState = {
    ...availablePass,
    used: 1,
    remaining: 0,
  };

  assert.equal(dailyPassAccess(spentPass), 'paywall');
});

test('allows a performance only after a usable pass has loaded', () => {
  assert.equal(dailyPassAccess(availablePass), 'start');
});

test('fails closed when persisted access could not be verified', () => {
  assert.equal(dailyPassAccess(availablePass, false), 'paywall');
});

test('allows a confirmed unlimited entitlement despite an unavailable ledger', () => {
  assert.equal(dailyPassAccess({ ...availablePass, unlimited: true }, false), 'start');
});

test('allows only a known session encore when ledger persistence is unavailable', () => {
  const passWithEncore = { ...availablePass, encores: 1 };
  assert.equal(dailyPassAccess(passWithEncore, false, 1), 'start');
  assert.equal(dailyPassAccess(passWithEncore, false, 0), 'paywall');
});
