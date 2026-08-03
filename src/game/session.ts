import type { Beat, Character } from '../engine/types.ts';
import { TheaterEngine } from '../engine/theater.ts';
import { CAST, CURTAINS, DEMO_LINES, OPENINGS } from './content.ts';

export const DEMO_BUDGET = 172;
export const DEMO_ROUNDS = 5;

export const countDemoTokens = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

export type GameSession = {
  engine: TheaterEngine;
  premiseId: string;
  premise: string;
  round: number;
  turnInRound: number;
  complete: boolean;
  lastForgotten: Beat[];
  directorNotes: number;
};

export type SessionSnapshot = {
  memory: Beat[];
  forgotten: Beat[];
  lastForgotten: Beat[];
  memoryTokens: number;
  budget: number;
  round: number;
  turnInRound: number;
  nextSpeaker: Character | null;
  complete: boolean;
  canAdvance: boolean;
  pinnedCount: number;
  directorNoteUsed: boolean;
};

function openingFor(premiseId: string): string {
  return OPENINGS[premiseId] ?? 'The curtain rises on a room where certainty is already becoming dangerous.';
}

function lineFor(premiseId: string, round: number, turn: number, speaker: Character): string {
  const rounds = DEMO_LINES[premiseId] ?? DEMO_LINES.wedding;
  const lines = rounds?.[round - 1];
  return lines?.[turn] ?? `${speaker.name} states a new certainty that nobody else can verify.`;
}

export function createGameSession(
  premiseId: string,
  premise: string,
  cast: Character[] = CAST,
  options: { commitOpening?: boolean } = {},
): GameSession {
  const engine = new TheaterEngine({
    cast,
    countTokens: countDemoTokens,
    budget: DEMO_BUDGET,
  });
  engine.prepareOpening(premise);
  if (options.commitOpening ?? true) engine.commitOpening(openingFor(premiseId));
  return {
    engine,
    premiseId,
    premise,
    round: 1,
    turnInRound: 0,
    complete: false,
    lastForgotten: [...engine.lastForgotten],
    directorNotes: 0,
  };
}

export function commitGeneratedOpening(session: GameSession, text = openingFor(session.premiseId)): Beat {
  if (session.complete) throw new Error('the play has already ended');
  return session.engine.commitOpening(text);
}

export function prepareGameBeat(session: GameSession): { speaker: Character } {
  if (session.complete) throw new Error('the play has already ended');
  return { speaker: session.engine.nextSpeaker() };
}

export function advanceGameSession(session: GameSession, preparedSpeaker?: Character): Beat {
  if (session.complete) throw new Error('the play has already ended');

  const speaker = preparedSpeaker ?? session.engine.nextSpeaker();
  return commitGeneratedBeat(
    session,
    speaker,
    lineFor(session.premiseId, session.round, session.turnInRound, speaker),
  );
}

export function commitGeneratedBeat(
  session: GameSession,
  speaker: Character,
  text: string,
): Beat {
  if (session.complete) throw new Error('the play has already ended');
  const expected = session.engine.nextSpeaker();
  if (expected.name !== speaker.name) throw new Error('prepared speaker is no longer current');
  const beat = session.engine.commitBeat(speaker, text);
  session.lastForgotten = session.engine.lastForgotten.map((item) => ({ ...item }));
  session.turnInRound += 1;

  if (session.turnInRound >= session.engine.cast.length) {
    session.turnInRound = 0;
    session.round += 1;
  }
  return beat;
}

export function addDirectorNote(session: GameSession, note: string): Beat {
  if (session.complete) throw new Error('the play has already ended');
  if (session.directorNotes >= 1) throw new Error('the director note has already been used');
  const beat = session.engine.addDirection(note);
  session.lastForgotten = session.engine.lastForgotten.map((item) => ({ ...item }));
  session.directorNotes += 1;
  return beat;
}

export function finishGameSession(session: GameSession): Beat {
  return commitGeneratedCurtain(
    session,
    CURTAINS[session.premiseId] ?? 'The curtain falls before anyone can agree what just happened.',
  );
}

export function commitGeneratedCurtain(session: GameSession, text: string): Beat {
  if (session.complete) throw new Error('the play has already ended');
  const beat = session.engine.commitCurtain(text);
  session.lastForgotten = session.engine.lastForgotten.map((item) => ({ ...item }));
  session.complete = true;
  return beat;
}

export function pinBeat(session: GameSession, beatId: number): boolean {
  return session.engine.pin(beatId);
}

export function canFinish(session: GameSession): boolean {
  return session.round > DEMO_ROUNDS;
}

export function snapshotSession(session: GameSession): SessionSnapshot {
  return {
    memory: session.engine.memory.map((beat) => ({ ...beat })),
    forgotten: session.engine.forgotten.map((beat) => ({ ...beat })),
    lastForgotten: session.lastForgotten.map((beat) => ({ ...beat })),
    memoryTokens: session.engine.memoryTokens(),
    budget: session.engine.budget,
    round: Math.min(session.round, DEMO_ROUNDS),
    turnInRound: session.turnInRound,
    nextSpeaker:
      session.complete || session.round > DEMO_ROUNDS ? null : { ...session.engine.nextSpeaker() },
    complete: session.complete,
    canAdvance: !session.complete && session.round <= DEMO_ROUNDS,
    pinnedCount: session.engine.pinnedCount(),
    directorNoteUsed: session.directorNotes > 0,
  };
}
