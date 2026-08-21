import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DailyPassLedger } from './daily-pass.ts';
import {
  bootstrapMonetization,
  unconfiguredMonetization,
} from './bootstrap.ts';
import type { MonetizationStatus } from './revenuecat.ts';

const now = new Date(2026, 7, 21, 10, 0, 0);
const ledger: DailyPassLedger = {
  dayKey: '2026-08-21',
  used: 1,
  encores: 2,
};
const paidStatus: MonetizationStatus = {
  configured: true,
  unlimited: true,
  packages: [],
};

test('loads the daily ledger and RevenueCat state at startup', async () => {
  const result = await bootstrapMonetization({
    loadLedger: async () => ledger,
    refreshRevenueCat: async () => paidStatus,
    now,
  });

  assert.deepEqual(result.monetization, paidStatus);
  assert.equal(result.pass.used, 1);
  assert.equal(result.pass.encores, 2);
  assert.equal(result.pass.unlimited, true);
});

test('keeps the RevenueCat state when loading the daily ledger fails', async () => {
  const result = await bootstrapMonetization({
    loadLedger: () => { throw new Error('storage unavailable'); },
    refreshRevenueCat: async () => paidStatus,
    now,
  });

  assert.deepEqual(result.monetization, paidStatus);
  assert.equal(result.pass.remaining, Number.POSITIVE_INFINITY);
  assert.equal(result.pass.used, 0);
});

test('preserves the daily ledger when refreshing RevenueCat fails', async () => {
  const result = await bootstrapMonetization({
    loadLedger: async () => ledger,
    refreshRevenueCat: () => { throw new Error('RevenueCat unavailable'); },
    now,
  });

  assert.strictEqual(result.monetization, unconfiguredMonetization);
  assert.equal(result.pass.used, 1);
  assert.equal(result.pass.encores, 2);
  assert.equal(result.pass.remaining, 0);
  assert.equal(result.pass.unlimited, false);
});

test('uses the unconfigured fallback when both startup operations fail', async () => {
  const result = await bootstrapMonetization({
    loadLedger: () => { throw new Error('storage unavailable'); },
    refreshRevenueCat: () => { throw new Error('RevenueCat unavailable'); },
    now,
  });

  assert.strictEqual(result.monetization, unconfiguredMonetization);
  assert.equal(result.pass.remaining, 1);
  assert.equal(result.pass.unlimited, false);
});
