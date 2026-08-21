import {
  normalizeDailyPass,
  type DailyPassLedger,
  type DailyPassState,
} from './daily-pass.ts';
import type { MonetizationStatus } from './revenuecat.ts';

/** The truthful state for builds without an available RevenueCat connection. */
export const unconfiguredMonetization: MonetizationStatus = {
  configured: false,
  unlimited: false,
  packages: [],
};

export const DEFAULT_REVENUECAT_TIMEOUT_MS = 750;

export type MonetizationBootstrap = {
  monetization: MonetizationStatus;
  pass: DailyPassState;
};

export type BootstrapMonetizationOptions = {
  loadLedger: () => Promise<DailyPassLedger | null>;
  refreshRevenueCat: () => Promise<MonetizationStatus>;
  now?: Date;
  /** Bounds a stalled RevenueCat startup request so local access can load. */
  revenueCatTimeoutMs?: number;
  /** Injectable only to keep timeout coverage deterministic. */
  waitForRevenueCatTimeout?: (milliseconds: number) => Promise<void>;
};

function waitForTimeout(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Load local access and RevenueCat separately so either temporary failure still
 * leaves the lobby with the most honest state available.
 */
export async function bootstrapMonetization({
  loadLedger,
  refreshRevenueCat,
  now = new Date(),
  revenueCatTimeoutMs = DEFAULT_REVENUECAT_TIMEOUT_MS,
  waitForRevenueCatTimeout = waitForTimeout,
}: BootstrapMonetizationOptions): Promise<MonetizationBootstrap> {
  const ledgerResult = Promise.resolve()
    .then(loadLedger)
    .catch(() => null);
  const revenueCatResult = Promise.race([
    Promise.resolve()
      .then(refreshRevenueCat)
      .catch(() => unconfiguredMonetization),
    waitForRevenueCatTimeout(revenueCatTimeoutMs).then(() => unconfiguredMonetization),
  ]);
  const [ledger, monetization] = await Promise.all([ledgerResult, revenueCatResult]);

  return {
    monetization,
    pass: normalizeDailyPass(ledger, now, monetization.unlimited),
  };
}
