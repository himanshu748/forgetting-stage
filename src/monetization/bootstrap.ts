import {
  ledgerFromState,
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
  /** Resolves as soon as persisted local access is available. */
  pass: Promise<DailyPassState>;
  /** Settles independently, including after local access has opened. */
  monetization: Promise<MonetizationStatus>;
};

export type BootstrapMonetizationOptions = {
  loadLedger: () => Promise<DailyPassLedger | null>;
  refreshRevenueCat: () => Promise<MonetizationStatus>;
  now?: Date;
};

export function reconcilePassWithMonetization(
  pass: DailyPassState | null,
  monetization: MonetizationStatus,
  now = new Date(),
): DailyPassState | null {
  if (!pass) return null;
  return normalizeDailyPass(ledgerFromState(pass, now), now, monetization.unlimited);
}

/**
 * Load local access and RevenueCat separately so either temporary failure still
 * leaves the lobby with the most honest state available.
 */
export function bootstrapMonetization({
  loadLedger,
  refreshRevenueCat,
  now = new Date(),
}: BootstrapMonetizationOptions): MonetizationBootstrap {
  let latestMonetization = unconfiguredMonetization;
  const monetization = Promise.resolve()
    .then(refreshRevenueCat)
    .catch(() => unconfiguredMonetization)
    .then((status) => {
      latestMonetization = status;
      return status;
    });
  const pass = Promise.resolve()
    .then(loadLedger)
    .catch(() => null)
    .then((ledger) => normalizeDailyPass(ledger, now, latestMonetization.unlimited));

  return { pass, monetization };
}
