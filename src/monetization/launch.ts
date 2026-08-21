import {
  consumePerformance,
  grantEncore,
  ledgerFromState,
  type DailyPassLedger,
  type DailyPassState,
} from './daily-pass.ts';

export type PerformanceLaunchGate = {
  isActive: () => boolean;
  run: <T>(operation: () => Promise<T>) => Promise<
    | { status: 'busy' }
    | { status: 'complete'; value: T }
  >;
};

/** A synchronous gate, so two taps in the same render cannot both launch. */
export function createPerformanceLaunchGate(): PerformanceLaunchGate {
  let active = false;
  return {
    isActive: () => active,
    run: async <T>(operation: () => Promise<T>) => {
      if (active) return { status: 'busy' } as const;
      active = true;
      try {
        return { status: 'complete', value: await operation() } as const;
      } finally {
        active = false;
      }
    },
  };
}

export type ConsumeAndPersistResult =
  | { status: 'consumed'; pass: DailyPassState }
  | { status: 'persistence-error'; pass: DailyPassState };

export async function consumeAndPersistPerformance({
  pass,
  saveLedger,
  now = new Date(),
}: {
  pass: DailyPassState;
  saveLedger: (ledger: DailyPassLedger) => Promise<void>;
  now?: Date;
}): Promise<ConsumeAndPersistResult> {
  const consumed = consumePerformance(pass);
  if (consumed.unlimited) return { status: 'consumed', pass: consumed };
  try {
    await saveLedger(ledgerFromState(consumed, now));
    return { status: 'consumed', pass: consumed };
  } catch {
    return { status: 'persistence-error', pass };
  }
}

export async function recordPurchasedEncore({
  pass,
  saveLedger,
  now = new Date(),
}: {
  pass: DailyPassState;
  saveLedger: (ledger: DailyPassLedger) => Promise<void>;
  now?: Date;
}): Promise<{ pass: DailyPassState; persisted: boolean }> {
  const bought = grantEncore(pass);
  try {
    await saveLedger(ledgerFromState(bought, now));
    return { pass: bought, persisted: true };
  } catch {
    return { pass: bought, persisted: false };
  }
}

/** Spend a purchase already confirmed this run without trusting local storage. */
export function consumeSessionEncore(pass: DailyPassState): DailyPassState {
  if (pass.encores < 1) throw new Error('no session encore available');
  return { ...pass, encores: pass.encores - 1 };
}
