import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DailyPassLedger } from './daily-pass.ts';
import {
  bootstrapMonetization,
  DEFAULT_REVENUECAT_TIMEOUT_MS,
  unconfiguredMonetization,
} from './bootstrap.ts';
import { dailyPassAccess } from './access.ts';
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

test('waits for a delayed ledger before deciding a spent pass can start', async () => {
  let resolveLedger: ((value: DailyPassLedger) => void) | undefined;
  const delayedLedger = new Promise<DailyPassLedger>((resolve) => { resolveLedger = resolve; });
  let settled = false;
  const resultPromise = bootstrapMonetization({
    loadLedger: () => delayedLedger,
    refreshRevenueCat: async () => unconfiguredMonetization,
    now,
  }).then((result) => {
    settled = true;
    return result;
  });

  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false);

  resolveLedger?.({ dayKey: '2026-08-21', used: 1, encores: 0 });
  const result = await resultPromise;
  assert.equal(result.pass.remaining, 0);
  assert.equal(result.pass.encores, 0);
  assert.equal(dailyPassAccess(result.pass), 'paywall');
});

test('falls back from a non-settling RevenueCat request without delaying the ledger', async () => {
  const result = await bootstrapMonetization({
    loadLedger: async () => ({ dayKey: '2026-08-21', used: 1, encores: 0 }),
    refreshRevenueCat: () => new Promise<MonetizationStatus>(() => {}),
    revenueCatTimeoutMs: 1,
    waitForRevenueCatTimeout: async () => {},
    now,
  });

  assert.strictEqual(result.monetization, unconfiguredMonetization);
  assert.equal(result.pass.remaining, 0);
  assert.equal(dailyPassAccess(result.pass), 'paywall');
});

test('uses a bounded production default for a RevenueCat startup request', () => {
  assert.equal(DEFAULT_REVENUECAT_TIMEOUT_MS, 750);
});
