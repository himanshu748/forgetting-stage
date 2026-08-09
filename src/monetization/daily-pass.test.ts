import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canStartPerformance,
  consumePerformance,
  grantEncore,
  ledgerFromState,
  localDayKey,
  normalizeDailyPass,
} from './daily-pass.ts';

test('grants one free performance for the current local day', () => {
  const now = new Date(2026, 7, 3, 10, 0, 0);
  const state = normalizeDailyPass(null, now);
  assert.equal(state.dayKey, localDayKey(now));
  assert.equal(state.remaining, 1);
  const consumed = consumePerformance(state);
  assert.equal(consumed.remaining, 0);
  assert.equal(canStartPerformance(consumed), false);
});

test('refreshes the free performance when the local calendar day changes', () => {
  const beforeMidnight = new Date(2026, 7, 3, 23, 59, 59);
  const consumed = consumePerformance(normalizeDailyPass(null, beforeMidnight));
  const afterMidnight = new Date(2026, 7, 4, 0, 0, 1);
  const refreshed = normalizeDailyPass(
    { dayKey: consumed.dayKey, used: consumed.used },
    afterMidnight,
  );
  assert.equal(refreshed.remaining, 1);
  assert.notEqual(refreshed.dayKey, consumed.dayKey);
});

test('does not grant another free curtain when the device clock moves backwards', () => {
  const now = new Date(2026, 7, 3, 12, 0, 0);
  const state = normalizeDailyPass({
    dayKey: '2026-08-04',
    used: 1,
    lastSeenAt: new Date(2026, 7, 4, 12, 0, 0).toISOString(),
  }, now);
  assert.equal(state.remaining, 0);
});

test('Director Pass holders stay unlimited and do not consume the daily grant', () => {
  const now = new Date(2026, 7, 3, 12, 0, 0);
  const premium = normalizeDailyPass({ dayKey: localDayKey(now), used: 1 }, now, true);
  assert.equal(canStartPerformance(premium), true);
  assert.equal(consumePerformance(premium), premium);
});

test('an encore buys one more performance today and is spent by it', () => {
  const now = new Date(2026, 7, 3, 12, 0, 0);
  const spent = consumePerformance(normalizeDailyPass(null, now));
  assert.equal(canStartPerformance(spent), false);

  const bought = grantEncore(spent);
  assert.equal(canStartPerformance(bought), true);
  const second = consumePerformance(bought);
  assert.equal(second.encores, 0);
  assert.equal(canStartPerformance(second), false);
});

test('the free performance is spent before any encore', () => {
  const now = new Date(2026, 7, 3, 12, 0, 0);
  const withEncore = grantEncore(normalizeDailyPass(null, now));
  const consumed = consumePerformance(withEncore);
  assert.equal(consumed.encores, 1, 'the encore must still be there');
  assert.equal(consumed.remaining, 0);
});

test('an encore survives midnight because it was paid for', () => {
  const tonight = new Date(2026, 7, 3, 23, 0, 0);
  const bought = grantEncore(consumePerformance(normalizeDailyPass(null, tonight)));
  const tomorrow = normalizeDailyPass(ledgerFromState(bought, tonight), new Date(2026, 7, 4, 9, 0, 0));
  assert.equal(tomorrow.remaining, 1);
  assert.equal(tomorrow.encores, 1);
});

test('a ledger with no encore field, or a corrupt one, reads as zero', () => {
  const now = new Date(2026, 7, 3, 12, 0, 0);
  assert.equal(normalizeDailyPass({ dayKey: localDayKey(now), used: 0 }, now).encores, 0);
  const corrupt = { dayKey: localDayKey(now), used: 0, encores: 'many' } as never;
  assert.equal(normalizeDailyPass(corrupt, now).encores, 0);
});
