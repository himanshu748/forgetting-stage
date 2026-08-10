import assert from 'node:assert/strict';
import { test } from 'node:test';

import { actorMessages } from '../engine/prompts.ts';
import type { LiveGenerator } from '../live/client.ts';
import { CAST } from './content.ts';
import { createPerformanceProvider, createPerformanceSession } from './performance.ts';
import { canFinish, normalizeContradictionText, snapshotSession } from './session.ts';

const words = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(' ') + '.';

test('uses live generations for opening, beat and curtain', async () => {
  const kinds: string[] = [];
  const provider = createPerformanceProvider(async (request) => {
    kinds.push(request.kind);
    if (request.kind === 'opening') return 'A live opening.';
    if (request.kind === 'curtain') return 'A live curtain.';
    return 'A live actor line.';
  });
  const performance = createPerformanceSession('wedding', 'a wedding');

  assert.equal((await provider.open(performance)).mode, 'live');
  assert.equal((await provider.advance(performance)).beat.text, 'A live actor line.');
  for (let index = 1; index < 15; index += 1) await provider.advance(performance);
  assert.equal((await provider.finish(performance)).beat.text, 'A live curtain.');
  assert.equal(kinds.filter((kind) => kind === 'opening').length, 1);
  assert.equal(kinds.filter((kind) => kind === 'beat').length, 15);
  assert.equal(kinds.filter((kind) => kind === 'curtain').length, 1);
});

test('falls back to deterministic content without losing the game turn', async () => {
  const provider = createPerformanceProvider(async () => {
    throw new Error('network unavailable');
  });
  const performance = createPerformanceSession('wedding', 'a wedding');

  const opening = await provider.open(performance);
  assert.equal(opening.mode, 'offline');
  assert.match(opening.beat.text, /Marigolds/);

  const before = snapshotSession(performance.session);
  const beat = await provider.advance(performance);
  const after = snapshotSession(performance.session);
  assert.equal(beat.mode, 'offline');
  assert.equal(after.turnInRound, before.turnInRound + 1);
  assert.equal(performance.lastFallbackReason, 'network unavailable');
});

test('offline five-round play completes two deterministic distinct probe replacements', async () => {
  const provider = createPerformanceProvider(async () => {
    throw new Error('offline by design');
  });
  const performance = createPerformanceSession(
    'wedding',
    'a wedding where nobody can agree who is marrying whom',
  );
  await provider.open(performance);

  for (let i = 0; i < 15; i += 1) await provider.advance(performance);

  const contradictions = snapshotSession(performance.session).contradictions;
  assert.ok(Array.isArray(contradictions), 'session snapshots must expose contradiction events');
  const completed = contradictions.find((event) => event.complete);
  assert.ok(completed, 'normal five-round offline play must complete a contradiction');
  assert.equal(completed.responses.length, 2);
  assert.notEqual(completed.responses[0]!.speaker, completed.responses[1]!.speaker);
  assert.notEqual(completed.responses[0]!.text, completed.responses[1]!.text);
  assert.doesNotMatch(completed.responses[0]!.text, new RegExp(completed.lostSeed.text, 'i'));
  assert.doesNotMatch(completed.responses[1]!.text, new RegExp(completed.lostSeed.text, 'i'));
});

test('live probe request carries the direction without restoring persona in the actor system', async () => {
  const beatRequests: Parameters<LiveGenerator>[0][] = [];
  const provider = createPerformanceProvider(async (request) => {
    if (request.kind === 'opening') return 'A hall fills with families awaiting an unnamed ceremony.';
    if (request.kind === 'curtain') return 'The curtain falls.';
    beatRequests.push(request);
    return 'I announce a detailed and completely settled new fact that everyone accepts without hesitation tonight.';
  });
  const performance = createPerformanceSession(
    'wedding',
    'a wedding where nobody can agree who is marrying whom',
  );
  await provider.open(performance);
  for (let i = 0; i < 15; i += 1) await provider.advance(performance);

  const probeRequest = beatRequests.find(
    (request) => request.kind === 'beat' && /Director's note: State plainly/.test(request.script ?? ''),
  );
  assert.ok(probeRequest && probeRequest.kind === 'beat', 'probe direction must enter the live transcript');
  if (typeof probeRequest.script !== 'string') assert.fail('beat request must carry a script');
  const script = probeRequest.script;
  const speaker = CAST.find((actor) => actor.name === probeRequest.speakerName);
  assert.ok(speaker);
  const [system] = actorMessages(speaker, script, 'contemporary Indian English');
  assert.ok(system);
  assert.doesNotMatch(system.content, new RegExp(speaker.persona, 'i'));
  assert.match(script, /completely certain/i);
});

test('a Director note attempt is safely rejected while live actor generation is pending', async () => {
  let resolveBeat: ((text: string) => void) | undefined;
  const provider = createPerformanceProvider((request) => {
    if (request.kind === 'opening') return Promise.resolve('A live opening.');
    if (request.kind === 'curtain') return Promise.resolve('A live curtain.');
    return new Promise<string>((resolve) => { resolveBeat = resolve; });
  });
  const performance = createPerformanceSession('wedding', 'a wedding');
  await provider.open(performance);

  const pendingAdvance = provider.advance(performance);
  let directionResult: unknown;
  assert.doesNotThrow(() => {
    directionResult = provider.direction(performance, 'Reveal the secret bride immediately.');
  });
  assert.equal(directionResult, null, 'pending actor work must reject the note without throwing');
  assert.equal(snapshotSession(performance.session).directorNoteUsed, false);

  assert.ok(resolveBeat, 'live beat generation must be waiting');
  resolveBeat('The live actor completes exactly one line.');
  await pendingAdvance;
  assert.equal(snapshotSession(performance.session).turnInRound, 1);
});

test('short early live outputs and a maximum-size final line cannot strand probe responses', async () => {
  let beatRequests = 0;
  const provider = createPerformanceProvider(async (request) => {
    if (request.kind === 'opening') return words('opening', 60);
    if (request.kind === 'curtain') return words('curtain', 80);
    beatRequests += 1;
    return beatRequests === 15 ? words('final', 50) : 'Yes.';
  });
  const performance = createPerformanceSession(
    'wedding',
    'a wedding where nobody can agree who is marrying whom',
  );
  await provider.open(performance);

  for (let index = 0; index < 15; index += 1) await provider.advance(performance);

  const snapshot = snapshotSession(performance.session);
  assert.equal(beatRequests, 15, 'one actor advance must make exactly one request');
  assert.equal(
    [...snapshot.memory, ...snapshot.forgotten].filter((beat) => beat.kind === 'line').length,
    15,
    'each actor advance must commit exactly one line',
  );
  assert.equal(snapshot.scheduledProbeCount, 0);
  assert.equal(canFinish(performance.session), true);
  for (const seed of snapshot.forgotten.filter((beat) => beat.kind === 'seed')) {
    const event = snapshot.contradictions.find((item) => item.lostSeed.id === seed.id);
    assert.ok(event?.complete, `forgotten seed ${seed.id} must have two answers before curtain`);
  }
});

test('an identical second live probe answer uses one deterministic distinct fallback in the same advance', async () => {
  let beatRequests = 0;
  const repeated = 'Meera is unquestionably the estate lawyer who controls every key in this building.';
  const provider = createPerformanceProvider(async (request) => {
    if (request.kind === 'opening') return words('opening', 60);
    if (request.kind === 'curtain') return 'The curtain falls.';
    beatRequests += 1;
    return repeated;
  });
  const performance = createPerformanceSession(
    'wedding',
    'a wedding where nobody can agree who is marrying whom',
  );
  await provider.open(performance);

  const results = [];
  for (let index = 0; index < 15; index += 1) results.push(await provider.advance(performance));

  assert.equal(beatRequests, 15, 'a rejected answer must not trigger a retry request');
  assert.ok(results.some((item) => item.mode === 'offline' && /duplicate/i.test(item.fallbackReason ?? '')));
  const completed = snapshotSession(performance.session).contradictions.filter((event) => event.complete);
  assert.ok(completed.length > 0);
  for (const event of completed) {
    assert.equal(event.responses.length, 2);
    assert.notEqual(event.responses[0]!.speaker, event.responses[1]!.speaker);
    assert.notEqual(
      normalizeContradictionText(event.responses[0]!.text),
      normalizeContradictionText(event.responses[1]!.text),
    );
  }
});

test('a hedged live probe answer uses a confident fallback without another model request', async () => {
  let beatRequests = 0;
  const provider = createPerformanceProvider(async (request) => {
    if (request.kind === 'opening') return words('opening', 60);
    if (request.kind === 'curtain') return 'The curtain falls.';
    beatRequests += 1;
    return 'Perhaps Meera might be the lawyer, but I am not sure.';
  });
  const performance = createPerformanceSession(
    'wedding',
    'a wedding where nobody can agree who is marrying whom',
  );
  await provider.open(performance);

  const results = [];
  for (let index = 0; index < 15; index += 1) results.push(await provider.advance(performance));

  assert.equal(beatRequests, 15, 'a hedged answer must not trigger a retry request');
  assert.ok(results.some((item) => item.mode === 'offline' && /hedg|uncertain/i.test(item.fallbackReason ?? '')));
  const completed = snapshotSession(performance.session).contradictions.filter((event) => event.complete);
  assert.ok(completed.length > 0);
  for (const event of completed) {
    assert.equal(event.responses.length, 2);
    for (const response of event.responses) {
      assert.doesNotMatch(response.text, /perhaps|might|not sure/i);
    }
  }
});

test('pending live first response exposes the waiting causal display before generation resolves', async () => {
  let deferNextBeat = false;
  let resolveBeat: ((text: string) => void) | undefined;
  const provider = createPerformanceProvider((request) => {
    if (request.kind === 'opening') return Promise.resolve(words('opening', 60));
    if (request.kind === 'curtain') return Promise.resolve('The curtain falls.');
    if (deferNextBeat) {
      return new Promise<string>((resolve) => { resolveBeat = resolve; });
    }
    return Promise.resolve('A settled actor line with enough detail to consume the shared memory quickly.');
  });
  const performance = createPerformanceSession(
    'wedding',
    'a wedding where nobody can agree who is marrying whom',
  );
  await provider.open(performance);
  let advances = 0;
  while (snapshotSession(performance.session).scheduledProbeCount === 0 && advances < 13) {
    await provider.advance(performance);
    advances += 1;
  }
  assert.ok(advances < 13, 'fixture must queue a probe with response capacity remaining');

  deferNextBeat = true;
  const pendingAdvance = provider.advance(performance);
  const pending = snapshotSession(performance.session);
  assert.equal(pending.actorResponsePending, true);
  assert.ok(pending.forgettingDisplay);
  assert.equal(pending.forgettingDisplay.contradiction.responses.length, 0);

  assert.ok(resolveBeat);
  resolveBeat('Meera is certainly the archivist of this palace.');
  await pendingAdvance;
});

test('performance provider rejects an early curtain before making a live request', async () => {
  let curtainRequests = 0;
  const provider = createPerformanceProvider(async (request) => {
    if (request.kind === 'curtain') curtainRequests += 1;
    return 'A live line.';
  });
  const performance = createPerformanceSession('wedding', 'a wedding');
  await provider.open(performance);

  await assert.rejects(() => provider.finish(performance), /curtain|round|finish/i);
  assert.equal(curtainRequests, 0);
});
