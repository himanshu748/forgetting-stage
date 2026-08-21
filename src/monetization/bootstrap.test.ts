import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DailyPassLedger } from './daily-pass.ts';
import {
  bootstrapMonetization,
  reconcilePassWithMonetization,
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
  const startup = bootstrapMonetization({
    loadLedger: async () => ledger,
    refreshRevenueCat: async () => paidStatus,
    now,
  });
  const [loadedPass, ledgerAvailable, monetization] = await Promise.all([
    startup.pass,
    startup.ledgerAvailable,
    startup.monetization,
  ]);
  const pass = reconcilePassWithMonetization(loadedPass, monetization, now);

  assert.deepEqual(monetization, paidStatus);
  assert.equal(ledgerAvailable, true);
  assert.equal(pass?.used, 1);
  assert.equal(pass?.encores, 2);
  assert.equal(pass?.unlimited, true);
});

test('keeps the RevenueCat state when loading the daily ledger fails', async () => {
  const startup = bootstrapMonetization({
    loadLedger: () => { throw new Error('storage unavailable'); },
    refreshRevenueCat: async () => paidStatus,
    now,
  });
  const [loadedPass, ledgerAvailable, monetization] = await Promise.all([
    startup.pass,
    startup.ledgerAvailable,
    startup.monetization,
  ]);
  const pass = reconcilePassWithMonetization(loadedPass, monetization, now);

  assert.deepEqual(monetization, paidStatus);
  assert.equal(ledgerAvailable, false);
  assert.equal(pass?.remaining, Number.POSITIVE_INFINITY);
  assert.equal(pass?.used, 1);
});

test('treats a null ledger as a legitimate first launch with one free show', async () => {
  const startup = bootstrapMonetization({
    loadLedger: async () => null,
    refreshRevenueCat: async () => unconfiguredMonetization,
    now,
  });
  const [pass, ledgerAvailable] = await Promise.all([startup.pass, startup.ledgerAvailable]);

  assert.equal(ledgerAvailable, true);
  assert.equal(pass.remaining, 1);
  assert.equal(dailyPassAccess(pass, ledgerAvailable), 'start');
});

test('preserves the daily ledger when refreshing RevenueCat fails', async () => {
  const startup = bootstrapMonetization({
    loadLedger: async () => ledger,
    refreshRevenueCat: () => { throw new Error('RevenueCat unavailable'); },
    now,
  });
  const [pass, monetization] = await Promise.all([startup.pass, startup.monetization]);

  assert.strictEqual(monetization, unconfiguredMonetization);
  assert.equal(pass.used, 1);
  assert.equal(pass.encores, 2);
  assert.equal(pass.remaining, 0);
  assert.equal(pass.unlimited, false);
});

test('uses the unconfigured fallback when both startup operations fail', async () => {
  const startup = bootstrapMonetization({
    loadLedger: () => { throw new Error('storage unavailable'); },
    refreshRevenueCat: () => { throw new Error('RevenueCat unavailable'); },
    now,
  });
  const [pass, ledgerAvailable, monetization] = await Promise.all([
    startup.pass,
    startup.ledgerAvailable,
    startup.monetization,
  ]);

  assert.strictEqual(monetization, unconfiguredMonetization);
  assert.equal(ledgerAvailable, false);
  assert.equal(pass.remaining, 0);
  assert.equal(pass.unlimited, false);
  assert.equal(dailyPassAccess(pass, ledgerAvailable), 'paywall');
});

test('fails closed when the ledger rejects and RevenueCat is unconfigured', async () => {
  const startup = bootstrapMonetization({
    loadLedger: async () => { throw new Error('storage rejected'); },
    refreshRevenueCat: async () => unconfiguredMonetization,
    now,
  });
  const [pass, ledgerAvailable] = await Promise.all([startup.pass, startup.ledgerAvailable]);

  assert.equal(ledgerAvailable, false);
  assert.equal(pass.remaining, 0);
  assert.equal(pass.encores, 0);
  assert.equal(dailyPassAccess(pass, ledgerAvailable), 'paywall');
});

test('waits for a delayed ledger before deciding a spent pass can start', async () => {
  let resolveLedger: ((value: DailyPassLedger) => void) | undefined;
  const delayedLedger = new Promise<DailyPassLedger>((resolve) => { resolveLedger = resolve; });
  let settled = false;
  const startup = bootstrapMonetization({
    loadLedger: () => delayedLedger,
    refreshRevenueCat: async () => unconfiguredMonetization,
    now,
  });
  const passPromise = startup.pass.then((pass) => {
    settled = true;
    return pass;
  });

  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false);

  resolveLedger?.({ dayKey: '2026-08-21', used: 1, encores: 0 });
  const pass = await passPromise;
  assert.equal(pass.remaining, 0);
  assert.equal(pass.encores, 0);
  assert.equal(dailyPassAccess(pass), 'paywall');
});

test('opens local access while RevenueCat is pending, then reconciles a late paid entitlement', async () => {
  let resolveRevenueCat: ((value: MonetizationStatus) => void) | undefined;
  const delayedRevenueCat = new Promise<MonetizationStatus>((resolve) => { resolveRevenueCat = resolve; });
  let revenueCatSettled = false;
  const startup = bootstrapMonetization({
    loadLedger: async () => ({ dayKey: '2026-08-21', used: 1, encores: 0 }),
    refreshRevenueCat: () => delayedRevenueCat,
    now,
  });
  void startup.monetization.then(() => { revenueCatSettled = true; });

  const localPass = await startup.pass;
  assert.equal(revenueCatSettled, false);
  assert.equal(localPass.remaining, 0);
  assert.equal(dailyPassAccess(localPass), 'paywall');

  resolveRevenueCat?.(paidStatus);
  const monetization = await startup.monetization;
  const reconciled = reconcilePassWithMonetization(localPass, monetization, now);
  assert.equal(reconciled?.unlimited, true);
  assert.equal(reconciled?.remaining, Number.POSITIVE_INFINITY);
  assert.equal(dailyPassAccess(reconciled), 'start');
});

test('keeps a ledger read error locked until a late paid entitlement arrives', async () => {
  let resolveRevenueCat: ((value: MonetizationStatus) => void) | undefined;
  const delayedRevenueCat = new Promise<MonetizationStatus>((resolve) => { resolveRevenueCat = resolve; });
  const startup = bootstrapMonetization({
    loadLedger: () => { throw new Error('storage unavailable'); },
    refreshRevenueCat: () => delayedRevenueCat,
    now,
  });

  const [lockedPass, ledgerAvailable] = await Promise.all([startup.pass, startup.ledgerAvailable]);
  assert.equal(ledgerAvailable, false);
  assert.equal(lockedPass.remaining, 0);
  assert.equal(dailyPassAccess(lockedPass, ledgerAvailable), 'paywall');

  resolveRevenueCat?.(paidStatus);
  const reconciled = reconcilePassWithMonetization(lockedPass, await startup.monetization, now);
  assert.equal(reconciled?.unlimited, true);
  assert.equal(dailyPassAccess(reconciled, ledgerAvailable), 'start');
});

test('does not invent access if RevenueCat settles before the ledger', async () => {
  let resolveLedger: ((value: DailyPassLedger) => void) | undefined;
  const delayedLedger = new Promise<DailyPassLedger>((resolve) => { resolveLedger = resolve; });
  const startup = bootstrapMonetization({
    loadLedger: () => delayedLedger,
    refreshRevenueCat: async () => paidStatus,
    now,
  });

  assert.deepEqual(await startup.monetization, paidStatus);
  resolveLedger?.({ dayKey: '2026-08-21', used: 1, encores: 0 });
  const pass = await startup.pass;
  assert.equal(pass.unlimited, true);
  assert.equal(dailyPassAccess(pass), 'start');
});
