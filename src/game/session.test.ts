import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PREMISES } from './content.ts';
import {
  DEMO_BUDGET,
  DEMO_ROUNDS,
  addDirectorNote,
  advanceGameSession,
  canFinish,
  commitGeneratedBeat,
  createGameSession,
  finishGameSession,
  pinBeat,
  prepareGameBeat,
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

test('records two consecutive actor replacements against the same evicted seed', () => {
  const session = createGameSession(premise.id, premise.premise);
  for (let i = 0; i < 13; i += 1) advanceGameSession(session);

  const first = prepareGameBeat(session);
  assert.ok(first.probe, 'the next normal turn must surface the seed eviction');
  assert.equal(first.probe.responseIndex, 1);
  assert.equal(first.probe.responseCount, 2);
  assert.equal(snapshotSession(session).directorNoteUsed, false, 'an automatic probe is not a user note');
  assert.ok(session.pendingForgotten.length > 0, 'direction-triggered evictions must be retained');

  commitGeneratedBeat(session, first.speaker, 'The wedding belongs to Kavya and Dev beneath the west veranda.');
  let snapshot = snapshotSession(session);
  assert.equal(snapshot.contradictions.length, 1);
  assert.equal(snapshot.contradictions[0]!.lostSeed.id, first.probe.lostSeed.id);
  assert.deepEqual(snapshot.contradictions[0]!.responses, [
    {
      speaker: first.speaker.name,
      emoji: first.speaker.emoji,
      text: 'The wedding belongs to Kavya and Dev beneath the west veranda.',
    },
  ]);
  assert.equal(snapshot.contradictions[0]!.complete, false);

  const second = prepareGameBeat(session);
  assert.ok(second.probe);
  assert.equal(second.probe.responseIndex, 2);
  assert.equal(second.probe.lostSeed.id, first.probe.lostSeed.id);
  assert.notEqual(second.speaker.name, first.speaker.name);
  commitGeneratedBeat(session, second.speaker, 'This ceremony celebrates Naina marrying Mihir on the palace roof.');

  snapshot = snapshotSession(session);
  assert.equal(snapshot.contradictions.length, 1, 'responses group by lost seed id');
  assert.equal(snapshot.contradictions[0]!.responses.length, 2);
  assert.equal(snapshot.contradictions[0]!.responses[1]!.speaker, second.speaker.name);
  assert.equal(snapshot.contradictions[0]!.complete, true);
});

test('aggregates automatic-direction and generated-line evictions', () => {
  const session = createGameSession(premise.id, premise.premise);
  for (let i = 0; i < 13; i += 1) advanceGameSession(session);
  const prepared = prepareGameBeat(session);
  assert.ok(prepared.probe);
  const directionEvictions = session.pendingForgotten.map((beat) => beat.id);
  assert.ok(directionEvictions.length > 0);

  commitGeneratedBeat(
    session,
    prepared.speaker,
    'This exceptionally elaborate replacement carries enough confident ceremonial detail to force another old remembered line entirely beyond the shared stage memory tonight.',
  );
  const lineEvictions = session.engine.lastForgotten.map((beat) => beat.id);
  assert.ok(lineEvictions.length > 0);
  assert.deepEqual(
    snapshotSession(session).lastForgotten.map((beat) => beat.id),
    [...directionEvictions, ...lineEvictions],
  );
});

test('snapshot contradiction values are defensively copied at every nested level', () => {
  const session = createGameSession(premise.id, premise.premise);
  for (let i = 0; i < 13; i += 1) advanceGameSession(session);
  const prepared = prepareGameBeat(session);
  assert.ok(prepared.probe);
  commitGeneratedBeat(session, prepared.speaker, 'Kavya owns this ceremony and the entire western garden.');

  const first = snapshotSession(session);
  const originalSeed = first.contradictions[0]!.lostSeed.text;
  const originalResponse = first.contradictions[0]!.responses[0]!.text;
  first.contradictions[0]!.lostSeed.text = 'mutated seed';
  first.contradictions[0]!.responses[0]!.text = 'mutated response';

  const second = snapshotSession(session);
  assert.equal(second.contradictions[0]!.lostSeed.text, originalSeed);
  assert.equal(second.contradictions[0]!.responses[0]!.text, originalResponse);
});
