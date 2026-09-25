import type { Beat, Character, Drift } from '../engine/types.ts';
import type { SessionSnapshot } from '../game/session.ts';

export const PERFORMANCE_ACTIONS = ['start', 'advance', 'pin', 'direction', 'finish'] as const;

export type PerformanceAction = (typeof PERFORMANCE_ACTIONS)[number];

/**
 * Public clients submit intent only. Transcript, speaker order, memory pressure
 * and probe history live behind the gateway.
 */
export type PerformanceRequest =
  | { action: 'start'; premiseId: string; cast?: Character[] }
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

export const CAST_LIMITS = {
  size: 3,
  name: 24,
  persona: 240,
  style: 120,
} as const;

/** Only the initial cast is editable; the server retains all subsequent state. */
export function normalizePerformanceCast(value: unknown): Character[] {
  if (!Array.isArray(value) || value.length !== CAST_LIMITS.size) {
    throw new Error('The cast must contain exactly three actors.');
  }
  const names = new Set<string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Actor ${index + 1} must be an object.`);
    }
    const actor = entry as Record<string, unknown>;
    if (Object.keys(actor).some((key) => !['name', 'emoji', 'persona', 'style'].includes(key))) {
      throw new Error(`Actor ${index + 1} contains an unsupported field.`);
    }
    const field = (key: 'name' | 'persona' | 'style', max: number): string => {
      const raw = actor[key];
      if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > max) {
        throw new Error(`Actor ${index + 1} ${key} must be between 1 and ${max} characters.`);
      }
      const text = raw.trim();
      if (/[\u0000-\u001F\u007F]/u.test(text)) {
        throw new Error(`Actor ${index + 1} ${key} must be a single line.`);
      }
      return text;
    };
    const name = field('name', CAST_LIMITS.name);
    if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} .’'-]*$/u.test(name)) {
      throw new Error(`Actor ${index + 1} name may contain letters, numbers, spaces, apostrophes, periods or hyphens.`);
    }
    const identity = name.normalize('NFKC').toLocaleLowerCase('en');
    if (['the play', 'the narrator', 'narrator', 'director'].includes(identity)) {
      throw new Error('Choose an actor name different from the narrator or director.');
    }
    if (names.has(identity)) throw new Error('Each actor needs a different name.');
    names.add(identity);
    const monogram = typeof actor.emoji === 'string' ? actor.emoji.trim() : '';
    if (!/^[\p{L}\p{N}]$/u.test(monogram)) {
      throw new Error(`Actor ${index + 1} monogram must be one letter or number.`);
    }
    return {
      name,
      emoji: monogram,
      persona: field('persona', CAST_LIMITS.persona),
      style: field('style', CAST_LIMITS.style),
    };
  });
}

export function isPerformanceAction(value: unknown): value is PerformanceAction {
  return typeof value === 'string'
    && PERFORMANCE_ACTIONS.includes(value as PerformanceAction);
}
