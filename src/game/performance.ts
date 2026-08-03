import type { Beat } from '../engine/types.ts';
import type { GenerationKind } from '../live/contract.ts';
import type { LiveGenerator } from '../live/client.ts';
import {
  addDirectorNote,
  advanceGameSession,
  commitGeneratedBeat,
  commitGeneratedCurtain,
  commitGeneratedOpening,
  createGameSession,
  finishGameSession,
  prepareGameBeat,
  type GameSession,
} from './session.ts';

export type PerformanceMode = 'live' | 'offline';

export type PerformanceResult = {
  beat: Beat;
  mode: PerformanceMode;
  fallbackReason?: string;
};

export type PerformanceSession = {
  performanceId: string;
  session: GameSession;
  mode: PerformanceMode;
  lastFallbackReason: string | null;
};

export type PerformanceProvider = {
  open(performance: PerformanceSession): Promise<PerformanceResult>;
  advance(performance: PerformanceSession): Promise<PerformanceResult>;
  finish(performance: PerformanceSession): Promise<PerformanceResult>;
  direction(performance: PerformanceSession, note: string): PerformanceResult;
};

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function result(
  performance: PerformanceSession,
  beat: Beat,
  mode: PerformanceMode,
  fallbackReason?: string,
): PerformanceResult {
  performance.mode = mode;
  performance.lastFallbackReason = fallbackReason ?? null;
  return { beat, mode, fallbackReason };
}

async function liveOrFallback(opts: {
  performance: PerformanceSession;
  kind: GenerationKind;
  generate: LiveGenerator;
  liveRequest: () => Parameters<LiveGenerator>[0];
  commitLive: (text: string) => Beat;
  commitOffline: () => Beat;
}): Promise<PerformanceResult> {
  try {
    const text = await opts.generate(opts.liveRequest());
    return result(opts.performance, opts.commitLive(text), 'live');
  } catch (error) {
    const reason = errorDetail(error);
    return result(opts.performance, opts.commitOffline(), 'offline', reason);
  }
}

export function createPerformanceSession(premiseId: string, premise: string): PerformanceSession {
  return {
    performanceId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    session: createGameSession(premiseId, premise, undefined, { commitOpening: false }),
    mode: 'live',
    lastFallbackReason: null,
  };
}

export function createPerformanceProvider(generate: LiveGenerator): PerformanceProvider {
  return {
    open(performance) {
      return liveOrFallback({
        performance,
        kind: 'opening',
        generate,
        liveRequest: () => ({
          kind: 'opening',
          premiseId: performance.session.premiseId,
          performanceId: performance.performanceId,
        }),
        commitLive: (text) => commitGeneratedOpening(performance.session, text),
        commitOffline: () => commitGeneratedOpening(performance.session),
      });
    },

    advance(performance) {
      const prepared = prepareGameBeat(performance.session);
      return liveOrFallback({
        performance,
        kind: 'beat',
        generate,
        liveRequest: () => ({
          kind: 'beat',
          premiseId: performance.session.premiseId,
          performanceId: performance.performanceId,
          script: performance.session.engine.transcript(),
          speakerName: prepared.speaker.name,
        }),
        commitLive: (text) => commitGeneratedBeat(performance.session, prepared.speaker, text),
        commitOffline: () => advanceGameSession(performance.session, prepared.speaker),
      });
    },

    finish(performance) {
      return liveOrFallback({
        performance,
        kind: 'curtain',
        generate,
        liveRequest: () => ({
          kind: 'curtain',
          premiseId: performance.session.premiseId,
          performanceId: performance.performanceId,
          script: performance.session.engine.transcript(),
        }),
        commitLive: (text) => commitGeneratedCurtain(performance.session, text),
        commitOffline: () => finishGameSession(performance.session),
      });
    },

    direction(performance, note) {
      return result(performance, addDirectorNote(performance.session, note), performance.mode);
    },
  };
}
