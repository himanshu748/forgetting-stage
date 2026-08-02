import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PREMISES } from './content.ts';
import {
  DEMO_BUDGET,
  DEMO_ROUNDS,
  addDirectorNote,
  advanceGameSession,
  canFinish,
  createGameSession,
  finishGameSession,
  pinBeat,
  snapshotSession,
} from './session.ts';

const premise = PREMISES[0];
if (!premise) throw new Error('expected a demo premise');

test('creates a playable session with premise and cast in memory', () => {
  const session = createGameSession(premise.id, premise.premise);
  const snapshot = snapshotSession(session);

  assert.equal(snapshot.budget, DEMO_BUDGET);
  assert.equal(snapshot.round, 1);
  assert.equal(snapshot.memory.filter((beat) => beat.kind === 'seed').length, 4);
  assert.equal(snapshot.nextSpeaker?.name, 'Meera');
});

test('advances through actor turns and rounds in order', () => {
  const session = createGameSession(premise.id, premise.premise);
  const speakers = [advanceGameSession(session), advanceGameSession(session), advanceGameSession(session)];

  assert.deepEqual(
    speakers.map((beat) => beat.speaker),
    ['Meera', 'Arun', 'Auntie'],
  );
  const snapshot = snapshotSession(session);
  assert.equal(snapshot.round, 2);
  assert.equal(snapshot.nextSpeaker?.name, 'Meera');
});

test('pinning preserves exactly one chosen beat through eviction', () => {
  const session = createGameSession(premise.id, premise.premise);
  const firstLine = advanceGameSession(session);
  assert.equal(pinBeat(session, firstLine.id), true);

  for (let i = 1; i < DEMO_ROUNDS * 3; i += 1) advanceGameSession(session);

  const snapshot = snapshotSession(session);
  assert.equal(snapshot.pinnedCount, 1);
  assert.equal(snapshot.memory.some((beat) => beat.id === firstLine.id), true);
  assert.equal(snapshot.forgotten.some((beat) => beat.id === firstLine.id), false);
  assert.equal(snapshot.forgotten.length > 0, true);
});

test('director notes consume memory and may cause forgetting', () => {
  const session = createGameSession(premise.id, premise.premise);
  const before = snapshotSession(session).memoryTokens;
  addDirectorNote(session, 'Everyone must explain why the second bride is carrying the scorebook.');
  const after = snapshotSession(session);

  assert.ok(after.memoryTokens > before);
  assert.equal(after.memory.some((beat) => beat.kind === 'direction'), true);
  assert.equal(after.directorNoteUsed, true);
  assert.throws(() => addDirectorNote(session, 'Try another note'), /already been used/);
});

test('finishes only after the configured rounds and exposes drift', () => {
  const session = createGameSession(premise.id, premise.premise);
  for (let i = 0; i < DEMO_ROUNDS * 3; i += 1) advanceGameSession(session);

  assert.equal(canFinish(session), true);
  assert.equal(snapshotSession(session).nextSpeaker, null);
  finishGameSession(session);
  const snapshot = snapshotSession(session);
  assert.equal(snapshot.complete, true);
  assert.equal(snapshot.canAdvance, false);
  assert.equal(session.engine.drift().entries.length, 3);
  assert.throws(() => advanceGameSession(session), /already ended/);
});
