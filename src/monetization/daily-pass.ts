export const DAILY_FREE_PERFORMANCES = 1;

export type DailyPassLedger = {
  dayKey: string;
  used: number;
  encores?: number;
  lastSeenAt?: string;
};

export type DailyPassState = {
  dayKey: string;
  used: number;
  remaining: number;
  /** Bought encores. Unlike the free show these do not expire at midnight. */
  encores: number;
  unlimited: boolean;
  nextRefreshAt: string;
};

export function localDayKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function nextLocalMidnight(now: Date): Date {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next;
}

export function normalizeDailyPass(
  ledger: DailyPassLedger | null | undefined,
  now: Date,
  unlimited = false,
): DailyPassState {
  const dayKey = localDayKey(now);
  const lastSeen = ledger?.lastSeenAt ? new Date(ledger.lastSeenAt) : null;
  const clockMovedBack = Boolean(lastSeen && Number.isFinite(lastSeen.getTime()) && now.getTime() < lastSeen.getTime());
  const used = ledger?.dayKey === dayKey
    ? Math.max(0, ledger.used)
    : clockMovedBack
      ? DAILY_FREE_PERFORMANCES
      : 0;
  const encores = Number(ledger?.encores ?? 0);
  return {
    dayKey,
    used,
    remaining: unlimited ? Number.POSITIVE_INFINITY : Math.max(0, DAILY_FREE_PERFORMANCES - used),
    encores: Number.isFinite(encores) ? Math.max(0, Math.trunc(encores)) : 0,
    unlimited,
    nextRefreshAt: nextLocalMidnight(now).toISOString(),
  };
}

export function canStartPerformance(state: DailyPassState): boolean {
  return state.unlimited || state.remaining > 0 || state.encores > 0;
}

/** The free show is spent first, so an encore is never wasted while one is left. */
export function consumePerformance(state: DailyPassState): DailyPassState {
  if (state.unlimited) return state;
  if (state.remaining < 1) {
    if (state.encores < 1) throw new Error('daily performance already used');
    return { ...state, encores: state.encores - 1 };
  }
  const used = state.used + 1;
  return {
    ...state,
    used,
    remaining: Math.max(0, DAILY_FREE_PERFORMANCES - used),
  };
}

export function grantEncore(state: DailyPassState): DailyPassState {
  return { ...state, encores: state.encores + 1 };
}

export function ledgerFromState(state: DailyPassState, now = new Date()): DailyPassLedger {
  return {
    dayKey: state.dayKey,
    used: state.used,
    encores: state.encores,
    lastSeenAt: now.toISOString(),
  };
}
