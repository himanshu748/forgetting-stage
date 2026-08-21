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
