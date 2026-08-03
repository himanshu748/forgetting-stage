export const DAILY_FREE_PERFORMANCES = 1;

export type DailyPassLedger = {
  dayKey: string;
  used: number;
  lastSeenAt?: string;
};

export type DailyPassState = {
  dayKey: string;
  used: number;
  remaining: number;
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
  return {
    dayKey,
    used,
    remaining: unlimited ? Number.POSITIVE_INFINITY : Math.max(0, DAILY_FREE_PERFORMANCES - used),
    unlimited,
    nextRefreshAt: nextLocalMidnight(now).toISOString(),
  };
}

export function canStartPerformance(state: DailyPassState): boolean {
  return state.unlimited || state.remaining > 0;
}

export function consumePerformance(state: DailyPassState): DailyPassState {
  if (state.unlimited) return state;
  if (state.remaining < 1) throw new Error('daily performance already used');
  const used = state.used + 1;
  return {
    ...state,
    used,
    remaining: Math.max(0, DAILY_FREE_PERFORMANCES - used),
  };
}

export function ledgerFromState(state: DailyPassState, now = new Date()): DailyPassLedger {
  return { dayKey: state.dayKey, used: state.used, lastSeenAt: now.toISOString() };
}
