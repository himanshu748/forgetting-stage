import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canStartPerformance,
  consumePerformance,
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
