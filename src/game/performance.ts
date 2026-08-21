import type { Beat, Drift } from '../engine/types.ts';
import type { PerformanceResponse } from '../live/contract.ts';
import type { LivePerformanceClient } from '../live/client.ts';
import {
  addDirectorNote,
  advanceGameSession,
  canFinish,
  commitGeneratedBeat,
  commitGeneratedCurtain,
  commitGeneratedOpening,
  countApproxModelTokens,
  createGameSession,
  LIVE_BUDGET,
  LIVE_EXTENSION_ROUNDS,
  LIVE_ROUNDS,
  pinBeat,
  prepareGameBeat,
  replacementFor,
  snapshotSession,
  type GameSession,
  type SessionSnapshot,
} from './session.ts';

export type PerformanceMode = 'live' | 'offline';

export type PerformanceResult = {
  beat: Beat;
  mode: PerformanceMode;
  fallbackReason?: string;
};

export type PerformanceSession = {
  performanceId: string | null;
  session: GameSession;
  mode: PerformanceMode;
  serverActive: boolean;
  authoritativeSnapshot: SessionSnapshot | null;
  authoritativeDrift: Drift | null;
  lastFallbackReason: string | null;
};

export type PerformanceProvider = {
  open(performance: PerformanceSession): Promise<PerformanceResult>;
  advance(performance: PerformanceSession): Promise<PerformanceResult>;
  finish(performance: PerformanceSession): Promise<PerformanceResult>;
  pin(performance: PerformanceSession, beatId: number): Promise<boolean>;
  direction(performance: PerformanceSession, note: string): Promise<PerformanceResult | null>;
};

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function localResult(
  performance: PerformanceSession,
  beat: Beat,
  fallbackReason?: string,
): PerformanceResult {
  performance.mode = 'offline';
  performance.serverActive = false;
  performance.authoritativeSnapshot = null;
  performance.authoritativeDrift = null;
  performance.lastFallbackReason = fallbackReason ?? null;
  return { beat, mode: 'offline', fallbackReason };
}

function requiredBeat(response: PerformanceResponse): Beat {
  if (!response.beat) throw new Error('the performance server returned no beat');
  return response.beat;
}

function commitServerBeatToLocalMirror(
  performance: PerformanceSession,
  speaker: Parameters<typeof commitGeneratedBeat>[1],
  text: string,
): void {
  try {
    commitGeneratedBeat(performance.session, speaker, text);
  } catch (error) {
    const message = errorDetail(error);
    const probe = performance.session.pendingProbe;
    if (!probe || !/hedged|uncertain|duplicat/i.test(message)) throw error;
    const event = performance.session.contradictions.find(
      (item) => item.lostSeed.id === probe.lostSeed.id,
    );
    commitGeneratedBeat(
      performance.session,
      speaker,
      replacementFor(
        performance.session.premise,
        probe,
        speaker,
        event?.responses ?? [],
      ),
    );
  }
}

function acceptServerState(
  performance: PerformanceSession,
  response: PerformanceResponse,
  beat: Beat,
  preserveMode = false,
): PerformanceResult {
  performance.performanceId = response.performanceId;
  performance.serverActive = true;
  performance.authoritativeSnapshot = response.snapshot;
  performance.authoritativeDrift = response.drift;
  if (!preserveMode) performance.mode = response.source === 'model' ? 'live' : 'offline';
  performance.lastFallbackReason = response.fallbackReason ?? null;
  return {
    beat,
    mode: performance.mode,
    ...(response.fallbackReason ? { fallbackReason: response.fallbackReason } : {}),
  };
}

export function performanceSnapshot(performance: PerformanceSession): SessionSnapshot {
  return performance.authoritativeSnapshot ?? snapshotSession(performance.session);
}

export function performanceDrift(performance: PerformanceSession): Drift {
  return performance.authoritativeDrift ?? performance.session.engine.drift();
}

export function createPerformanceSession(premiseId: string, premise: string): PerformanceSession {
  return {
    performanceId: null,
    session: createGameSession(premiseId, premise, undefined, {
      commitOpening: false,
      countTokens: countApproxModelTokens,
      budget: LIVE_BUDGET,
      rounds: LIVE_ROUNDS,
      requiredContradictions: 1,
      maxExtensionRounds: LIVE_EXTENSION_ROUNDS,
    }),
    mode: 'live',
    serverActive: true,
    authoritativeSnapshot: null,
    authoritativeDrift: null,
    lastFallbackReason: null,
  };
}

export function createPerformanceProvider(client: LivePerformanceClient): PerformanceProvider {
  return {
    async open(performance) {
      try {
        const response = await client({
          action: 'start',
          premiseId: performance.session.premiseId,
        });
        const beat = requiredBeat(response);
        commitGeneratedOpening(performance.session, beat.text);
        return acceptServerState(performance, response, beat);
      } catch (error) {
        return localResult(
          performance,
          commitGeneratedOpening(performance.session),
          errorDetail(error),
        );
      }
    },

    async advance(performance) {
      const prepared = prepareGameBeat(performance.session, {
        forceRecoveryRound: performance.serverActive
          && performance.authoritativeSnapshot?.canAdvance === true,
      });
      if (performance.serverActive && performance.performanceId) {
        let response: PerformanceResponse;
        try {
          response = await client({
            action: 'advance',
            performanceId: performance.performanceId,
          });
        } catch (error) {
          return localResult(
            performance,
            advanceGameSession(performance.session, prepared.speaker),
            errorDetail(error),
          );
        }
        const beat = requiredBeat(response);
        commitServerBeatToLocalMirror(performance, prepared.speaker, beat.text);
        return acceptServerState(performance, response, beat);
      }
      return localResult(performance, advanceGameSession(performance.session, prepared.speaker));
    },

    async finish(performance) {
      const snapshot = performanceSnapshot(performance);
      if (!snapshot.canFinish) {
        throw new Error('the curtain cannot fall before every round and probe response finish');
      }
      if (performance.serverActive && performance.performanceId) {
        try {
          const response = await client({
            action: 'finish',
            performanceId: performance.performanceId,
          });
          const beat = requiredBeat(response);
          if (canFinish(performance.session)) {
            commitGeneratedCurtain(performance.session, beat.text);
          }
          return acceptServerState(performance, response, beat);
        } catch (error) {
          if (!canFinish(performance.session)) throw error;
          return localResult(
            performance,
            commitGeneratedCurtain(
              performance.session,
              'The curtain falls while every actor insists their version was always the only play.',
            ),
            errorDetail(error),
          );
        }
      }
      return localResult(
        performance,
        commitGeneratedCurtain(
          performance.session,
          'The curtain falls while every actor insists their version was always the only play.',
        ),
      );
    },

    async pin(performance, beatId) {
      if (performanceSnapshot(performance).pinnedCount >= 1) return false;
      if (performance.serverActive && performance.performanceId) {
        try {
          const response = await client({
            action: 'pin',
            performanceId: performance.performanceId,
            beatId,
          });
          // The exact server and approximate local mirror can evict at slightly
          // different moments. A successful server pin remains authoritative.
          pinBeat(performance.session, beatId);
          performance.performanceId = response.performanceId;
          performance.authoritativeSnapshot = response.snapshot;
          performance.authoritativeDrift = response.drift;
          performance.lastFallbackReason = response.fallbackReason ?? null;
          return true;
        } catch (error) {
          performance.lastFallbackReason = errorDetail(error);
          performance.serverActive = false;
          performance.mode = 'offline';
          performance.authoritativeSnapshot = null;
          performance.authoritativeDrift = null;
        }
      }
      return pinBeat(performance.session, beatId);
    },

    async direction(performance, note) {
      if (performance.session.beatPending) return null;
      if (performance.serverActive && performance.performanceId) {
        try {
          const response = await client({
            action: 'direction',
            performanceId: performance.performanceId,
            note,
          });
          const beat = requiredBeat(response);
          addDirectorNote(performance.session, note);
          return acceptServerState(performance, response, beat, true);
        } catch (error) {
          return localResult(performance, addDirectorNote(performance.session, note), errorDetail(error));
        }
      }
      return localResult(performance, addDirectorNote(performance.session, note));
    },
  };
}
