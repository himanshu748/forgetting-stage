import type { Beat, Drift } from '../engine/types.ts';
import type { SessionSnapshot } from '../game/session.ts';

export const PERFORMANCE_ACTIONS = ['start', 'advance', 'pin', 'direction', 'finish'] as const;

export type PerformanceAction = (typeof PERFORMANCE_ACTIONS)[number];

/**
 * Public clients submit intent only. Transcript, speaker order, memory pressure
 * and probe history live behind the gateway.
 */
export type PerformanceRequest =
  | { action: 'start'; premiseId: string }
  | { action: 'advance'; performanceId: string }
  | { action: 'pin'; performanceId: string; beatId: number }
  | { action: 'direction'; performanceId: string; note: string }
  | { action: 'finish'; performanceId: string };

export type PerformanceSource = 'model' | 'safety-fallback' | 'state-only';

export type PerformanceResponse = {
  performanceId: string;
  beat?: Beat;
  snapshot: SessionSnapshot;
  drift: Drift;
  source: PerformanceSource;
  requestId: string;
  model: string;
  fallbackReason?: string;
};

export type GenerationError = {
  error: string;
  code: string;
  requestId?: string;
};

export const MAX_NOTE_CHARS = 120;

export function isPerformanceAction(value: unknown): value is PerformanceAction {
  return typeof value === 'string'
    && PERFORMANCE_ACTIONS.includes(value as PerformanceAction);
}
