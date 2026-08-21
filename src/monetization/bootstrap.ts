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

export type MonetizationBootstrap = {
  monetization: MonetizationStatus;
  pass: DailyPassState;
};

export type BootstrapMonetizationOptions = {
  loadLedger: () => Promise<DailyPassLedger | null>;
  refreshRevenueCat: () => Promise<MonetizationStatus>;
  now?: Date;
};

/**
 * Load local access and RevenueCat separately so either temporary failure still
 * leaves the lobby with the most honest state available.
 */
export async function bootstrapMonetization({
  loadLedger,
  refreshRevenueCat,
  now = new Date(),
}: BootstrapMonetizationOptions): Promise<MonetizationBootstrap> {
  const [ledgerResult, revenueCatResult] = await Promise.allSettled([
    Promise.resolve().then(loadLedger),
    Promise.resolve().then(refreshRevenueCat),
  ]);
  const ledger = ledgerResult.status === 'fulfilled' ? ledgerResult.value : null;
  const monetization = revenueCatResult.status === 'fulfilled'
    ? revenueCatResult.value
    : unconfiguredMonetization;

  return {
    monetization,
    pass: normalizeDailyPass(ledger, now, monetization.unlimited),
  };
}
