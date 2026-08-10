import type {
  Beat,
  Character,
  MemoryProbe,
  SeedResponseReservation,
} from '../engine/types.ts';
import { cleanOutput, TheaterEngine } from '../engine/theater.ts';
import { CAST, CURTAINS, DEMO_LINES, OPENINGS } from './content.ts';

export const DEMO_BUDGET = 172;
export const DEMO_ROUNDS = 5;

export const countDemoTokens = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

export type ContradictionResponse = {
  speaker: string;
  emoji: string;
  text: string;
};

export type ContradictionEvent = {
  lostSeed: Beat;
  instruction: string;
  responses: ContradictionResponse[];
  complete: boolean;
};

export type ForgettingDisplay = {
  forgotten: Beat;
  contradiction: ContradictionEvent;
  cascading: Beat[];
};

export type GameSession = {
  engine: TheaterEngine;
  premiseId: string;
  premise: string;
  round: number;
  turnInRound: number;
  complete: boolean;
  lastForgotten: Beat[];
  directorNotes: number;
  pendingProbe: MemoryProbe | null;
  pendingForgotten: Beat[];
  contradictions: ContradictionEvent[];
  beatPending: boolean;
  seedResponseReservation: SeedResponseReservation;
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
  contradictions: ContradictionEvent[];
  actorResponsePending: boolean;
  scheduledProbeCount: number;
  forgettingDisplay: ForgettingDisplay | null;
};

function openingFor(premiseId: string): string {
  return OPENINGS[premiseId] ?? 'The curtain rises on a room where certainty is already becoming dangerous.';
}

function lineFor(premiseId: string, round: number, turn: number, speaker: Character): string {
  const rounds = DEMO_LINES[premiseId] ?? DEMO_LINES.wedding;
  const lines = rounds?.[round - 1];
  return lines?.[turn] ?? `${speaker.name} states a new certainty that nobody else can verify.`;
}

function stableIndex(key: string, length: number): number {
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % length;
}

export function normalizeContradictionText(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HEDGE_PATTERNS = [
  /\bmaybe\b/i,
  /\bperhaps\b/i,
  /\bpossibly\b/i,
  /\bprobably\b/i,
  /\bapparently\b/i,
  /\bpresumably\b/i,
  /\bmight\b/i,
  /\bmay be\b/i,
  /\bcould be\b/i,
  /\bi (?:think|believe|guess|suppose|suspect)\b/i,
  /\b(?:i am|i'm) not (?:sure|certain)\b/i,
  /\bnot (?:sure|certain)\b/i,
  /\b(?:do not|don't) know\b/i,
  /\b(?:cannot|can't) remember\b/i,
  /\b(?:uncertain|unclear)\b/i,
  /\b(?:it )?(?:seems|appears)(?: like| that)?\b/i,
  /\bwho knows\b/i,
] as const;

export function isConfidentContradictionText(text: string): boolean {
  const normalized = normalizeContradictionText(text);
  if (!normalized || /falls silent having lost the thread/i.test(normalized)) return false;
  return HEDGE_PATTERNS.every((pattern) => !pattern.test(text));
}

export function isCompleteContradiction(event: ContradictionEvent): boolean {
  if (event.responses.length !== 2) return false;
  const speakers = new Set(
    event.responses.map((response) => response.speaker.trim().toLocaleLowerCase('en')),
  );
  const texts = new Set(event.responses.map((response) => normalizeContradictionText(response.text)));
  return speakers.size === 2
    && texts.size === 2
    && event.responses.every((response) => isConfidentContradictionText(response.text));
}

export function directorNoteDraftAfterAttempt(draft: string, accepted: boolean): string {
  return accepted ? '' : draft;
}

const PREMISE_REPLACEMENTS = [
  [
    'The play has always concerned a stolen wedding ledger hidden beneath the west veranda.',
    'Tonight has always been the trial of a missing heir inside this crowded hall.',
    'This performance has always chronicled a family auctioning its own ancestral house.',
  ],
  [
    'The entire story is a coronation staged aboard the last train to Jaipur.',
    'This is unquestionably a detective comedy about a vanished silver trophy.',
    'Every scene belongs to a reunion celebrating the return of a notorious magician.',
  ],
] as const;

const CHARACTER_REPLACEMENTS = [
  [
    'the estate lawyer who controls every key in this building',
    'the celebrated matchmaker who arranged tonight\'s entire gathering',
    'the family archivist who wrote every official account in the house',
  ],
  [
    'the district champion secretly judging this ceremony',
    'the palace owner hosting us under a borrowed name',
    'the chief investigator sent to recover the missing inheritance',
  ],
] as const;

/** Pure deterministic replacement used only when an automatic memory probe is pending. */
export function replacementFor(
  premise: string,
  probe: MemoryProbe,
  speaker: Character,
  priorResponses: readonly ContradictionResponse[] = [],
): string {
  const responseGroup = probe.responseIndex === 2 ? 1 : 0;
  const key = [
    premise,
    probe.lostSeed.id,
    probe.lostSeed.speaker,
    probe.lostSeed.text,
    speaker.name,
    probe.responseIndex,
  ].join('|');

  const candidates = probe.lostSeed.speaker === 'The play'
    ? PREMISE_REPLACEMENTS[responseGroup]
    : CHARACTER_REPLACEMENTS[responseGroup].map((role) => `${probe.lostSeed.speaker} is ${role}.`);
  const priorTexts = new Set(
    priorResponses.map((response) => normalizeContradictionText(response.text)),
  );
  const start = stableIndex(key, candidates.length);
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const candidate = candidates[(start + offset) % candidates.length]!;
    if (!priorTexts.has(normalizeContradictionText(candidate))) return candidate;
  }
  throw new Error('no distinct deterministic probe response is available');
}

function copyProbe(probe: MemoryProbe | null): MemoryProbe | null {
  return probe ? { ...probe, lostSeed: { ...probe.lostSeed } } : null;
}

function copyContradiction(event: ContradictionEvent): ContradictionEvent {
  return {
    ...event,
    lostSeed: { ...event.lostSeed },
    responses: event.responses.map((response) => ({ ...response })),
  };
}

function contradictionForProbe(session: GameSession, probe: MemoryProbe): ContradictionEvent {
  let event = session.contradictions.find((item) => item.lostSeed.id === probe.lostSeed.id);
  if (!event) {
    event = {
      lostSeed: { ...probe.lostSeed },
      instruction: probe.instruction,
      responses: [],
      complete: false,
    };
    session.contradictions.push(event);
  }
  return event;
}

function preparedProbe(session: GameSession, probe: MemoryProbe): MemoryProbe {
  if (probe.responseIndex !== 2) return copyProbe(probe)!;
  const firstResponse = contradictionForProbe(session, probe).responses[0];
  if (!firstResponse) return copyProbe(probe)!;
  return {
    ...probe,
    lostSeed: { ...probe.lostSeed },
    instruction: [
      probe.instruction,
      `Disagree with ${firstResponse.speaker}'s first answer, "${firstResponse.text}", and give a different replacement.`,
    ].join(' '),
  };
}

function remainingActorSlots(session: GameSession): number {
  const completed = (session.round - 1) * session.engine.cast.length + session.turnInRound;
  return Math.max(0, DEMO_ROUNDS * session.engine.cast.length - completed);
}

function updateSeedResponseReservation(
  session: GameSession,
  options: { actorSlotBeingCommitted?: boolean; preparedProbeResponses?: number } = {},
): void {
  session.seedResponseReservation.remainingActorSlots = Math.max(
    0,
    remainingActorSlots(session) - (options.actorSlotBeingCommitted ? 1 : 0),
  );
  session.seedResponseReservation.preparedProbeResponses = Math.max(
    0,
    options.preparedProbeResponses ?? (session.pendingProbe ? 1 : 0),
  );
}

function scheduledProbeCount(session: GameSession): number {
  return session.engine.pendingProbeCount() + (session.pendingProbe ? 1 : 0);
}

function validatePendingProbeResponse(
  session: GameSession,
  cleanedText: string,
): void {
  const probe = session.pendingProbe;
  if (!probe) return;
  if (!isConfidentContradictionText(cleanedText)) {
    throw new Error('Live probe response was hedged or uncertain');
  }
  const normalized = normalizeContradictionText(cleanedText);
  const event = contradictionForProbe(session, probe);
  if (event.responses.some((response) => normalizeContradictionText(response.text) === normalized)) {
    throw new Error('Live probe response duplicated the earlier answer');
  }
}

function forgettingDisplay(session: GameSession): ForgettingDisplay | null {
  const contradiction = session.contradictions[session.contradictions.length - 1];
  if (!contradiction) return null;
  return {
    forgotten: { ...contradiction.lostSeed },
    contradiction: copyContradiction(contradiction),
    cascading: session.lastForgotten
      .filter((beat) => beat.id !== contradiction.lostSeed.id)
      .map((beat) => ({ ...beat })),
  };
}

export function createGameSession(
  premiseId: string,
  premise: string,
  cast: Character[] = CAST,
  options: { commitOpening?: boolean } = {},
): GameSession {
  const distinctSpeakers = new Set(
    cast.map((speaker) => speaker.name.trim().toLocaleLowerCase('en')),
  );
  if (distinctSpeakers.size < 2) {
    throw new Error('reserved game sessions require at least two distinct speakers');
  }
  const seedResponseReservation: SeedResponseReservation = {
    remainingActorSlots: DEMO_ROUNDS * cast.length,
    preparedProbeResponses: 0,
  };
  const engine = new TheaterEngine({
    cast,
    countTokens: countDemoTokens,
    budget: DEMO_BUDGET,
    seedResponseReservation,
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
    pendingProbe: null,
    pendingForgotten: [],
    contradictions: [],
    beatPending: false,
    seedResponseReservation,
  };
}

export function commitGeneratedOpening(session: GameSession, text = openingFor(session.premiseId)): Beat {
  if (session.complete) throw new Error('the play has already ended');
  updateSeedResponseReservation(session, { preparedProbeResponses: 0 });
  const beat = session.engine.commitOpening(text);
  session.lastForgotten = session.engine.lastForgotten.map((item) => ({ ...item }));
  session.pendingProbe = null;
  session.pendingForgotten = [];
  session.beatPending = false;
  return beat;
}

export function prepareGameBeat(session: GameSession): {
  speaker: Character;
  probe: MemoryProbe | null;
} {
  if (session.complete) throw new Error('the play has already ended');
  if (session.beatPending) throw new Error('a prepared beat is already pending');
  if (remainingActorSlots(session) === 0) throw new Error('all configured actor rounds are complete');
  // Eviction nobody reacts to is invisible. Losing a seed queues an order to
  // state that fact plainly, and the contradiction happens in the open.
  const queuedProbe = session.engine.nextProbe();
  const probe = queuedProbe ? preparedProbe(session, queuedProbe) : null;
  session.pendingProbe = copyProbe(probe);
  if (probe) {
    contradictionForProbe(session, probe);
    updateSeedResponseReservation(session, { preparedProbeResponses: 1 });
    session.engine.addDirection(probe.instruction);
  }
  session.pendingForgotten = probe
    ? session.engine.lastForgotten.map((item) => ({ ...item }))
    : [];
  session.beatPending = true;
  return { speaker: session.engine.nextSpeaker(), probe: copyProbe(probe) };
}

export function advanceGameSession(session: GameSession, preparedSpeaker?: Character): Beat {
  if (session.complete) throw new Error('the play has already ended');

  const speaker = preparedSpeaker ?? prepareGameBeat(session).speaker;
  const priorResponses = session.pendingProbe
    ? contradictionForProbe(session, session.pendingProbe).responses
    : [];
  const fallback = session.pendingProbe
    ? replacementFor(session.premise, session.pendingProbe, speaker, priorResponses)
    : lineFor(session.premiseId, session.round, session.turnInRound, speaker);
  return commitGeneratedBeat(
    session,
    speaker,
    fallback,
  );
}

export function commitGeneratedBeat(
  session: GameSession,
  speaker: Character,
  text: string,
): Beat {
  if (session.complete) throw new Error('the play has already ended');
  if (!session.beatPending) throw new Error('no prepared actor advance is pending');
  const expected = session.engine.nextSpeaker();
  if (expected.name !== speaker.name) throw new Error('prepared speaker is no longer current');
  const cleanedText = cleanOutput(text, speaker.name);
  validatePendingProbeResponse(session, cleanedText);
  const probe = copyProbe(session.pendingProbe);
  const directionEvictions = session.pendingForgotten.map((item) => ({ ...item }));
  updateSeedResponseReservation(session, {
    actorSlotBeingCommitted: true,
    preparedProbeResponses: 0,
  });
  let beat: Beat;
  try {
    beat = session.engine.commitBeat(speaker, cleanedText);
  } catch (error) {
    updateSeedResponseReservation(session);
    throw error;
  }
  const lineEvictions = session.engine.lastForgotten.map((item) => ({ ...item }));
  session.lastForgotten = [...directionEvictions, ...lineEvictions];

  if (probe) {
    const event = contradictionForProbe(session, probe);
    if (event.responses.length < probe.responseCount) {
      event.responses.push({ speaker: beat.speaker, emoji: beat.emoji, text: beat.text });
    }
    event.complete = isCompleteContradiction(event);
  }

  session.pendingProbe = null;
  session.pendingForgotten = [];
  session.beatPending = false;
  session.turnInRound += 1;

  if (session.turnInRound >= session.engine.cast.length) {
    session.turnInRound = 0;
    session.round += 1;
  }
  updateSeedResponseReservation(session, { preparedProbeResponses: 0 });
  return beat;
}

export function addDirectorNote(session: GameSession, note: string): Beat {
  if (session.complete) throw new Error('the play has already ended');
  if (session.beatPending) throw new Error('an actor response is already pending');
  if (session.directorNotes >= 1) throw new Error('the director note has already been used');
  updateSeedResponseReservation(session, { preparedProbeResponses: 0 });
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
  if (!canFinish(session)) throw new Error('the curtain cannot fall before every round and probe response finish');
  session.seedResponseReservation.remainingActorSlots = 0;
  session.seedResponseReservation.preparedProbeResponses = 0;
  const beat = session.engine.commitCurtain(text);
  session.lastForgotten = session.engine.lastForgotten.map((item) => ({ ...item }));
  session.pendingProbe = null;
  session.pendingForgotten = [];
  session.beatPending = false;
  session.complete = true;
  return beat;
}

export function pinBeat(session: GameSession, beatId: number): boolean {
  return session.engine.pin(beatId);
}

export function canFinish(session: GameSession): boolean {
  return session.round > DEMO_ROUNDS
    && scheduledProbeCount(session) === 0
    && session.contradictions.every((event) => isCompleteContradiction(event));
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
    contradictions: session.contradictions.map(copyContradiction),
    actorResponsePending: session.beatPending,
    scheduledProbeCount: scheduledProbeCount(session),
    forgettingDisplay: forgettingDisplay(session),
  };
}
