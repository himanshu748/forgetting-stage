import { canStartPerformance, type DailyPassState } from './daily-pass.ts';

export type DailyPassAccess = 'checking' | 'start' | 'paywall';

/**
 * Keeps the lobby conservative while persisted daily access is unresolved.
 * A missing pass is an unknown state, never a fresh free performance.
 */
export function dailyPassAccess(pass: DailyPassState | null): DailyPassAccess {
  if (!pass) return 'checking';
  return canStartPerformance(pass) ? 'start' : 'paywall';
}
