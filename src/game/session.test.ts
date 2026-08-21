import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CAST, PREMISES } from './content.ts';
import {
  DEMO_BUDGET,
  DEMO_ROUNDS,
  LIVE_BUDGET,
  LIVE_ROUNDS,
  addDirectorNote,
  advanceGameSession,
  canFinish,
  commitGeneratedBeat,
  commitGeneratedCurtain,
  commitGeneratedOpening,
  countApproxModelTokens,
  createGameSession,
  directorNoteDraftAfterAttempt,
  finishGameSession,
  isCompleteContradiction,
  isConfidentContradictionText,
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
  let advances = 0;
  while (snapshotSession(session).scheduledProbeCount === 0 && advances < 13) {
    advanceGameSession(session);
    advances += 1;
  }
  assert.ok(advances < 13, 'fixture must queue a seed probe before the final two turns');

  const first = prepareGameBeat(session);
  assert.ok(first.probe, 'the next normal turn must surface the seed eviction');
  assert.equal(first.probe.responseIndex, 1);
  assert.equal(first.probe.responseCount, 2);
  assert.equal(snapshotSession(session).directorNoteUsed, false, 'an automatic probe is not a user note');
  assert.ok(session.pendingForgotten.length > 0, 'direction-triggered evictions must be retained');

  commitGeneratedBeat(session, first.speaker, 'The wedding belongs to Kavya and Dev beneath the west veranda.');
  let snapshot = snapshotSession(session);
  let event = snapshot.contradictions.find((item) => item.lostSeed.id === first.probe!.lostSeed.id);
  assert.ok(event);
  assert.deepEqual(event.responses, [
    {
      speaker: first.speaker.name,
      emoji: first.speaker.emoji,
      text: 'The wedding belongs to Kavya and Dev beneath the west veranda.',
    },
  ]);
  assert.equal(event.complete, false);

  const second = prepareGameBeat(session);
  assert.ok(second.probe);
  assert.equal(second.probe.responseIndex, 2);
  assert.equal(second.probe.lostSeed.id, first.probe.lostSeed.id);
  assert.match(second.probe.instruction, /different|disagree/i);
  assert.match(second.probe.instruction, /Kavya and Dev/);
  assert.notEqual(second.speaker.name, first.speaker.name);
  commitGeneratedBeat(session, second.speaker, 'This ceremony celebrates Naina marrying Mihir on the palace roof.');

  snapshot = snapshotSession(session);
  event = snapshot.contradictions.find((item) => item.lostSeed.id === first.probe!.lostSeed.id);
  assert.ok(event);
  assert.equal(event.responses.length, 2, 'responses group by lost seed id');
  assert.equal(event.responses[1]!.speaker, second.speaker.name);
  assert.equal(event.complete, true);
});

test('a normalized duplicate probe response is rejected before it can complete the event', () => {
  const session = createGameSession(premise.id, premise.premise);
  let advances = 0;
  while (snapshotSession(session).scheduledProbeCount === 0 && advances < 13) {
    advanceGameSession(session);
    advances += 1;
  }
  assert.ok(advances < 13, 'fixture must queue a seed probe before the final two turns');

  const first = prepareGameBeat(session);
  assert.ok(first.probe);
  commitGeneratedBeat(session, first.speaker, 'Meera is unquestionably the keeper of every ceremonial key.');

  const second = prepareGameBeat(session);
  assert.ok(second.probe);
  const before = snapshotSession(session);
  assert.throws(
    () => commitGeneratedBeat(
      session,
      second.speaker,
      '  MEERA is unquestionably the keeper of every ceremonial key!  ',
    ),
    /duplicate/i,
  );

  const rejected = snapshotSession(session);
  const event = rejected.contradictions.find((item) => item.lostSeed.id === first.probe!.lostSeed.id);
  assert.ok(event);
  assert.equal(event.responses.length, 1);
  assert.equal(event.complete, false);
  assert.equal(rejected.actorResponsePending, true, 'rejection must not consume the prepared actor slot');
  assert.equal(rejected.turnInRound, before.turnInRound);

  advanceGameSession(session, second.speaker);
  const recovered = snapshotSession(session).contradictions.find(
    (item) => item.lostSeed.id === first.probe!.lostSeed.id,
  );
  assert.ok(recovered);
  assert.equal(recovered.complete, true);
  assert.notEqual(recovered.responses[0]!.text, recovered.responses[1]!.text);
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

test('five-round offline play completes every forgotten seed probe without stranded work', () => {
  for (const option of PREMISES) {
    const session = createGameSession(option.id, option.premise);
    for (let i = 0; i < DEMO_ROUNDS * session.engine.cast.length; i += 1) {
      advanceGameSession(session);
    }

    const snapshot = snapshotSession(session);
    const forgottenSeeds = snapshot.forgotten.filter((beat) => beat.kind === 'seed');
    assert.ok(forgottenSeeds.length > 0, `${option.id} must exercise real seed eviction`);
    assert.equal(snapshot.scheduledProbeCount, 0, `${option.id} may not strand a probe at curtain`);
    for (const seed of forgottenSeeds) {
      const event = snapshot.contradictions.find((item) => item.lostSeed.id === seed.id);
      assert.ok(event, `${option.id} forgotten seed ${seed.id} must have an event`);
      assert.equal(event.complete, true);
      assert.equal(event.responses.length, 2);
      assert.notEqual(event.responses[0]!.speaker, event.responses[1]!.speaker);
    }
  }
});

test('ten-round 1,000-token fallback reaches the same visible forgetting loop', () => {
  const session = createGameSession(premise.id, premise.premise, undefined, {
    countTokens: countApproxModelTokens,
    budget: LIVE_BUDGET,
    rounds: LIVE_ROUNDS,
  });
  for (let index = 0; index < LIVE_ROUNDS * session.engine.cast.length; index += 1) {
    advanceGameSession(session);
    assert.ok(snapshotSession(session).memoryTokens <= LIVE_BUDGET);
  }

  const snapshot = snapshotSession(session);
  assert.ok(snapshot.forgotten.some((beat) => beat.kind === 'seed'));
  assert.ok(snapshot.contradictions.some((event) => event.complete));
  assert.equal(snapshot.canFinish, true);
});

test('a required forgetting event extends briefly then fails honestly when memory never fills', () => {
  const session = createGameSession(premise.id, premise.premise, undefined, {
    countTokens: () => 1,
    budget: LIVE_BUDGET,
    rounds: 1,
    requiredContradictions: 1,
    maxExtensionRounds: 1,
  });

  for (let index = 0; index < session.engine.cast.length; index += 1) {
    advanceGameSession(session);
  }
  let snapshot = snapshotSession(session);
  assert.equal(snapshot.canFinish, false);
  assert.equal(snapshot.canAdvance, true, 'one recovery round should remain available');
  assert.equal(snapshot.failureReason, null);

  for (let index = 0; index < session.engine.cast.length; index += 1) {
    advanceGameSession(session);
  }
  snapshot = snapshotSession(session);
  assert.equal(snapshot.canFinish, false);
  assert.equal(snapshot.canAdvance, false);
  assert.match(snapshot.failureReason ?? '', /did not produce|start a new/i);
  assert.throws(() => advanceGameSession(session), /configured actor rounds/i);
});

test('an authoritative server may force the approximate mirror into a recovery round', () => {
  const session = createGameSession(premise.id, premise.premise, undefined, {
    countTokens: () => 1,
    budget: LIVE_BUDGET,
    rounds: 1,
    maxExtensionRounds: 1,
  });
  for (let index = 0; index < session.engine.cast.length; index += 1) {
    advanceGameSession(session);
  }
  assert.equal(snapshotSession(session).canAdvance, false);

  const prepared = prepareGameBeat(session, { forceRecoveryRound: true });
  assert.equal(session.maxRounds, 2);
  assert.equal(prepared.speaker.name, 'Meera');
});

test('a maximum-size final actor line preserves seeds that no remaining actors can answer', () => {
  const session = createGameSession(premise.id, premise.premise, undefined, { commitOpening: false });
  const opening = Array.from({ length: 60 }, (_, index) => `opening${index}`).join(' ') + '.';
  const finalLine = Array.from({ length: 50 }, (_, index) => `final${index}`).join(' ') + '.';
  // Use the live commit boundary: short early model outputs followed by the
  // configured maximum-size actor output on the final slot.
  commitGeneratedOpening(session, opening);

  for (let index = 0; index < DEMO_ROUNDS * session.engine.cast.length; index += 1) {
    const prepared = prepareGameBeat(session);
    commitGeneratedBeat(
      session,
      prepared.speaker,
      index === DEMO_ROUNDS * session.engine.cast.length - 1 ? finalLine : `Yes${index}.`,
    );
  }

  const snapshot = snapshotSession(session);
  assert.equal(snapshot.scheduledProbeCount, 0);
  assert.equal(canFinish(session), true);
  for (const seed of snapshot.forgotten.filter((beat) => beat.kind === 'seed')) {
    const event = snapshot.contradictions.find((item) => item.lostSeed.id === seed.id);
    assert.ok(event?.complete, `forgotten seed ${seed.id} must have both reserved responses`);
  }
});

test('a long curtain preserves seeds because no actor response slots remain', () => {
  const session = createGameSession(premise.id, premise.premise);
  for (let index = 0; index < DEMO_ROUNDS * session.engine.cast.length; index += 1) {
    const prepared = prepareGameBeat(session);
    commitGeneratedBeat(session, prepared.speaker, 'Yes.');
  }
  const before = snapshotSession(session);
  assert.equal(before.memory.filter((beat) => beat.kind === 'seed').length, 4);

  const longCurtain = Array.from({ length: 80 }, (_, index) => `curtain${index}`).join(' ') + '.';
  commitGeneratedCurtain(session, longCurtain);

  const after = snapshotSession(session);
  assert.equal(after.forgotten.filter((beat) => beat.kind === 'seed').length, 0);
  assert.equal(after.scheduledProbeCount, 0);
  assert.equal(after.complete, true);
});

test('curtain eligibility requires configured rounds and no prepared probe work', () => {
  const session = createGameSession(premise.id, premise.premise);
  for (let index = 0; index < DEMO_ROUNDS * session.engine.cast.length; index += 1) {
    advanceGameSession(session);
  }
  assert.equal(canFinish(session), true);

  const lostSeed = snapshotSession(session).forgotten.find((beat) => beat.kind === 'seed');
  assert.ok(lostSeed);
  session.pendingProbe = {
    lostSeed: { ...lostSeed },
    instruction: 'State a certain replacement.',
    responseIndex: 1,
    responseCount: 2,
  };
  assert.equal(canFinish(session), false);
});

test('the fixed demo rejects a sixteenth actor advance and an early curtain', () => {
  const early = createGameSession(premise.id, premise.premise);
  assert.throws(() => finishGameSession(early), /curtain|round|finish/i);

  const session = createGameSession(premise.id, premise.premise);
  for (let index = 0; index < DEMO_ROUNDS * session.engine.cast.length; index += 1) {
    advanceGameSession(session);
  }
  assert.equal(canFinish(session), true);
  assert.throws(() => advanceGameSession(session), /round|actor|advance/i);
});

test('pending first probe response immediately exposes the waiting causal display', () => {
  const session = createGameSession(premise.id, premise.premise);
  let advances = 0;
  while (snapshotSession(session).scheduledProbeCount === 0 && advances < 13) {
    advanceGameSession(session);
    advances += 1;
  }
  assert.ok(advances < 13, 'fixture must queue a seed probe');

  const prepared = prepareGameBeat(session);
  assert.ok(prepared.probe);
  const pending = snapshotSession(session);
  assert.ok(pending.forgettingDisplay);
  assert.equal(pending.forgettingDisplay.forgotten.id, prepared.probe.lostSeed.id);
  assert.equal(pending.forgettingDisplay.contradiction.responses.length, 0);
  assert.equal(pending.forgettingDisplay.contradiction.complete, false);
});

test('contradiction completion requires two speakers and normalized-distinct confident texts', () => {
  const lostSeed = snapshotSession(createGameSession(premise.id, premise.premise)).memory[0]!;
  const base = {
    lostSeed,
    instruction: 'Answer confidently.',
    responses: [
      { speaker: 'Meera', emoji: '🌸', text: 'Arun is certainly the palace archivist.' },
      { speaker: 'Arun', emoji: '🎩', text: 'Arun is definitely the district champion.' },
    ],
    complete: false,
  };
  assert.equal(isCompleteContradiction(base), true);
  assert.equal(isCompleteContradiction({
    ...base,
    responses: [base.responses[0]!, { ...base.responses[1]!, text: '  ARUN is certainly the palace archivist! ' }],
  }), false);
  assert.equal(isCompleteContradiction({
    ...base,
    responses: [base.responses[0]!, { ...base.responses[1]!, speaker: 'Meera' }],
  }), false);
  assert.equal(isCompleteContradiction({
    ...base,
    responses: [base.responses[0]!, { ...base.responses[1]!, text: 'Perhaps Arun might be the champion.' }],
  }), false);
});

test('common hedge phrases cannot satisfy a contradiction response', () => {
  for (const hedge of [
    'I suppose Arun is the district champion.',
    'It may be that Arun is the district champion.',
    'I’m not certain, but Arun is the district champion.',
  ]) {
    assert.equal(isConfidentContradictionText(hedge), false, hedge);
  }
});

test('reserved game sessions require at least two distinct speakers', () => {
  assert.throws(
    () => createGameSession(premise.id, premise.premise, [CAST[0]!, { ...CAST[0]! }]),
    /two distinct speakers/i,
  );
});

test('reserved game sessions reject a repeated name in a three-entry cast', () => {
  assert.throws(
    () => createGameSession(premise.id, premise.premise, [CAST[0]!, CAST[1]!, { ...CAST[0]! }]),
    /unique|distinct/i,
  );
});

test('Director note draft clears only when the callback accepts the note', () => {
  assert.equal(
    directorNoteDraftAfterAttempt('  Preserve this exact note.  ', false),
    '  Preserve this exact note.  ',
  );
  assert.equal(directorNoteDraftAfterAttempt('Accepted note', true), '');
});

test('cascading evictions display the same lost seed as the paired contradiction card', () => {
  const session = createGameSession(premise.id, premise.premise);
  for (let i = 0; i < 14; i += 1) advanceGameSession(session);

  const snapshot = snapshotSession(session);
  assert.ok(snapshot.lastForgotten.length > 0, 'fixture must trigger cascading eviction');
  assert.ok(snapshot.forgettingDisplay, 'snapshot must expose a keyed causal display');
  assert.equal(
    snapshot.forgettingDisplay.forgotten.id,
    snapshot.forgettingDisplay.contradiction.lostSeed.id,
    'notice and card must identify the same lost seed',
  );
  assert.equal(
    snapshot.forgettingDisplay.cascading.some(
      (beat) => beat.id === snapshot.forgettingDisplay!.forgotten.id,
    ),
    false,
    'newly queued losses stay visually separate from the chain being answered',
  );
});
