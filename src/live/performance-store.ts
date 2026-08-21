import type { GameSession } from '../game/session.ts';

export type StoredPerformance = {
  id: string;
  model: string;
  session: GameSession;
  steps: number;
  touchedAt: number;
};

export type PerformanceStore = {
  create(performance: StoredPerformance): void;
  get(id: string): StoredPerformance | null;
  delete(id: string): void;
};

export function createInMemoryPerformanceStore(options: {
  ttlMs?: number;
  maxSessions?: number;
  now?: () => number;
} = {}): PerformanceStore {
  const ttlMs = options.ttlMs ?? 2 * 60 * 60 * 1000;
  const maxSessions = options.maxSessions ?? 200;
  const now = options.now ?? Date.now;
  const sessions = new Map<string, StoredPerformance>();

  const prune = () => {
    const time = now();
    for (const [id, performance] of sessions) {
      if (time - performance.touchedAt > ttlMs) sessions.delete(id);
    }
    while (sessions.size >= maxSessions) {
      const oldest = [...sessions.values()].sort((a, b) => a.touchedAt - b.touchedAt)[0];
      if (!oldest) break;
      sessions.delete(oldest.id);
    }
  };

  return {
    create(performance) {
      prune();
      sessions.set(performance.id, performance);
    },
    get(id) {
      prune();
      const performance = sessions.get(id) ?? null;
      if (performance) performance.touchedAt = now();
      return performance;
    },
    delete(id) {
      sessions.delete(id);
    },
  };
}
