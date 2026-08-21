import { canStartPerformance, type DailyPassState } from './daily-pass.ts';

export type DailyPassAccess = 'checking' | 'start' | 'paywall';

/**
 * Keeps the lobby conservative while persisted daily access is unresolved.
 * A missing pass is an unknown state, never a fresh free performance.
 */
export function dailyPassAccess(
  pass: DailyPassState | null,
  ledgerAvailable: boolean | null = true,
  sessionEncoreCredits = 0,
): DailyPassAccess {
  if (!pass) return 'checking';
  if (ledgerAvailable === null) return 'checking';
  if (!ledgerAvailable && !pass.unlimited) {
    return sessionEncoreCredits > 0 && pass.encores > 0 ? 'start' : 'paywall';
  }
  return canStartPerformance(pass) ? 'start' : 'paywall';
}
