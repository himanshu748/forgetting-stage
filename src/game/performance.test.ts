import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { LivePerformanceClient } from '../live/client.ts';
import type { PerformanceResponse, PerformanceSource } from '../live/contract.ts';
import {
  addDirectorNote,
  advanceGameSession,
  commitGeneratedCurtain,
  commitGeneratedOpening,
  countApproxModelTokens,
  createGameSession,
  DEMO_ROUNDS,
  LIVE_BUDGET,
  LIVE_EXTENSION_ROUNDS,
  LIVE_ROUNDS,
  pinBeat,
  snapshotSession,
} from './session.ts';
import { CAST, PREMISES } from './content.ts';
import {
  createPerformanceProvider,
  createPerformanceSession,
  createRehearsalSession,
  performanceDrift,
  performanceSnapshot,
} from './performance.ts';

function createLocalServer(source: PerformanceSource = 'model') {
  let session: ReturnType<typeof createGameSession> | null = null;
  const requests: Parameters<LivePerformanceClient>[0][] = [];
  let requestId = 0;

  const respond = (beat?: PerformanceResponse['beat']): PerformanceResponse => {
    if (!session) throw new Error('server session is missing');
    return {
      performanceId: 'server-performance-1',
      beat,
      snapshot: snapshotSession(session),
      drift: session.engine.drift(),
      source,
      requestId: `request-${++requestId}`,
      model: 'test-model',
    };
  };

  const client: LivePerformanceClient = async (request) => {
    requests.push(request);
    if (request.action === 'start') {
      const premise = PREMISES.find((item) => item.id === request.premiseId);
      if (!premise) throw new Error('unknown premise');
      session = createGameSession(premise.id, premise.premise, request.cast, {
        commitOpening: false,
        countTokens: countApproxModelTokens,
        budget: LIVE_BUDGET,
        rounds: LIVE_ROUNDS,
      });
      return respond(commitGeneratedOpening(session, 'A live opening.'));
    }
    if (!session) throw new Error('server session is missing');
    if (request.action === 'advance') return respond(advanceGameSession(session));
    if (request.action === 'pin') {
      if (!pinBeat(session, request.beatId)) throw new Error('pin rejected');
      return respond();
    }
    if (request.action === 'direction') return respond(addDirectorNote(session, request.note));
    return respond(commitGeneratedCurtain(session, 'A live curtain.'));
  };
  return { client, requests };
}

test('uses server-owned state for a complete live performance', async () => {
  const server = createLocalServer();
  const provider = createPerformanceProvider(server.client);
  const performance = createPerformanceSession('wedding', 'a wedding');

  assert.equal((await provider.open(performance)).mode, 'live');
  assert.equal((await provider.advance(performance)).mode, 'live');
  for (let index = 1; index < LIVE_ROUNDS * 3; index += 1) await provider.advance(performance);
  assert.equal((await provider.finish(performance)).beat.text, 'A live curtain.');
  assert.equal(server.requests[0]?.action, 'start');
  assert.deepEqual(server.requests[0], { action: 'start', premiseId: 'wedding' });
  assert.equal(server.requests.filter((request) => request.action === 'advance').length, 30);
  for (const request of server.requests) {
    assert.equal('script' in request, false);
    assert.equal('speakerName' in request, false);
  }
});

test('falls back locally without losing the prepared turn', async () => {
  const provider = createPerformanceProvider(async () => {
    throw new Error('network unavailable');
  });
  const performance = createPerformanceSession('wedding', 'a wedding');

  const opening = await provider.open(performance);
  assert.equal(opening.mode, 'offline');
  assert.match(opening.beat.text, /Marigolds/);

  const before = performanceSnapshot(performance);
  const result = await provider.advance(performance);
  const after = performanceSnapshot(performance);
  assert.equal(result.mode, 'offline');
  assert.equal(after.turnInRound, before.turnInRound + 1);
  assert.equal(performance.lastFallbackReason, null, 'later local turns do not repeat the outage');
});

test('server snapshot overrides the approximate client mirror', async () => {
  const server = createLocalServer();
  const provider = createPerformanceProvider(async (request) => {
    const response = await server.client(request);
    return {
      ...response,
      snapshot: { ...response.snapshot, memoryTokens: 777, totalMemoryTokens: 801 },
    };
  });
  const performance = createPerformanceSession('wedding', 'a wedding');

  await provider.open(performance);
  assert.equal(performanceSnapshot(performance).memoryTokens, 777);
  assert.notEqual(performance.session.engine.unpinnedMemoryTokens(), 777);
});

test('pin and direction are sent as actions then reflected in authoritative state', async () => {
  const server = createLocalServer();
  const provider = createPerformanceProvider(server.client);
  const performance = createPerformanceSession('wedding', 'a wedding');
  await provider.open(performance);
  const line = await provider.advance(performance);

  assert.equal(await provider.pin(performance, line.beat.id), true);
  assert.ok(await provider.direction(performance, 'Move the ceremony onto the roof.'));
  const snapshot = performanceSnapshot(performance);
  assert.equal(snapshot.pinnedCount, 1);
  assert.equal(snapshot.directorNoteUsed, true);
  assert.deepEqual(
    server.requests.slice(-2).map((request) => request.action),
    ['pin', 'direction'],
  );
});

test('a successful server pin wins when the approximate mirror evicted first', async () => {
  const server = createLocalServer();
  const provider = createPerformanceProvider(server.client);
  const performance = createPerformanceSession('wedding', 'a wedding');
  await provider.open(performance);
  const line = await provider.advance(performance);

  performance.session.engine.memory = performance.session.engine.memory
    .filter((beat) => beat.id !== line.beat.id);

  assert.equal(await provider.pin(performance, line.beat.id), true);
  assert.equal(performanceSnapshot(performance).pinnedCount, 1);
  assert.equal(performance.serverActive, true);
});

test('a local probe mismatch cannot discard an authoritative server beat', async () => {
  const server = createLocalServer();
  const provider = createPerformanceProvider(async (request) => {
    const response = await server.client(request);
    if (request.action !== 'advance' || !response.beat) return response;
    return { ...response, beat: { ...response.beat, text: 'Maybe the truth was different.' } };
  });
  const performance = createPerformanceSession('wedding', 'a wedding');
  await provider.open(performance);

  performance.session.engine.addDirection('x'.repeat(3_900));
  const result = await provider.advance(performance);

  assert.equal(result.beat.text, 'Maybe the truth was different.');
  assert.equal(performance.serverActive, true);
  assert.equal(performance.session.beatPending, false);
});

test('a safety fallback remains server-authoritative and honest', async () => {
  const server = createLocalServer('safety-fallback');
  const provider = createPerformanceProvider(async (request) => ({
    ...(await server.client(request)),
    fallbackReason: 'The live model was unavailable for this beat.',
  }));
  const performance = createPerformanceSession('wedding', 'a wedding');

  const opened = await provider.open(performance);
  assert.equal(opened.mode, 'offline');
  assert.equal(performance.serverActive, true);
  await provider.advance(performance);
  assert.equal(server.requests.filter((request) => request.action === 'advance').length, 1);
});

test('an early curtain is rejected before a server request', async () => {
  const server = createLocalServer();
  const provider = createPerformanceProvider(server.client);
  const performance = createPerformanceSession('wedding', 'a wedding');
  await provider.open(performance);

  await assert.rejects(() => provider.finish(performance), /curtain|round|finish/i);
  assert.equal(server.requests.some((request) => request.action === 'finish'), false);
});

test('the curtain report comes from the authoritative server state', async () => {
  const server = createLocalServer();
  const provider = createPerformanceProvider(server.client);
  const performance = createPerformanceSession('wedding', 'a wedding');
  await provider.open(performance);
  for (let index = 0; index < LIVE_ROUNDS * 3; index += 1) await provider.advance(performance);
  await provider.finish(performance);

  assert.deepEqual(performanceDrift(performance), performance.authoritativeDrift);
  assert.equal(performanceSnapshot(performance).complete, true);
});

test('two complete rehearsals preserve player choices and never request live generation', async () => {
  let requests = 0;
  const provider = createPerformanceProvider(async () => {
    requests += 1;
    throw new Error('rehearsals must not call the live provider');
  });

  for (const premise of PREMISES.slice(0, 2)) {
    const performance = createRehearsalSession(premise.id, premise.premise);
    const opening = performanceSnapshot(performance);
    assert.equal(opening.canAdvance, true);
    assert.equal(opening.maxRounds, DEMO_ROUNDS);
    assert.ok(opening.memory.some((beat) => beat.kind === 'narration'));

    const firstLine = await provider.advance(performance);
    assert.equal(await provider.pin(performance, firstLine.beat.id), true);
    const direction = await provider.direction(performance, 'Make everyone explain the locked door.');
    assert.ok(direction);
    for (let turn = 1; turn < DEMO_ROUNDS * 3; turn += 1) {
      await provider.advance(performance);
    }

    const beforeCurtain = performanceSnapshot(performance);
    assert.equal(beforeCurtain.canFinish, true);
    assert.equal(beforeCurtain.directorNoteUsed, true);
    assert.ok(beforeCurtain.memory.some((beat) => beat.id === firstLine.beat.id && beat.pinned));
    assert.ok(beforeCurtain.forgotten.some((beat) => beat.kind === 'seed'));
    assert.ok(beforeCurtain.contradictions.some((event) => event.complete));
    assert.equal((await provider.finish(performance)).mode, 'offline');
    assert.equal(performanceSnapshot(performance).complete, true);
    assert.equal(performanceDrift(performance).entries.length, 3);
  }

  assert.equal(requests, 0);
});

test('custom cast reaches the live server and remains stable when editor values change', async () => {
  const cast = CAST.map((actor, index) => ({
    ...actor,
    name: ['  Zoya  ', 'Ravi', 'Noor'][index]!,
    emoji: ['Z', 'R', 'N'][index]!,
    persona: `  ${actor.persona}  `,
    style: '  speaks in quick whispers  ',
  }));
  const performance = createPerformanceSession('wedding', 'a wedding', cast);
  cast[0]!.name = 'Changed in editor';
  const server = createLocalServer();
  const provider = createPerformanceProvider(server.client);

  await provider.open(performance);
  const request = server.requests[0];
  assert.equal(request?.action, 'start');
  if (request?.action !== 'start') throw new Error('expected start request');
  assert.equal(request.cast?.[0]?.name, 'Zoya');
  assert.equal(request.cast?.[0]?.persona, CAST[0]!.persona);
  assert.equal(request.cast?.[0]?.style, 'speaks in quick whispers');
  assert.equal(performanceSnapshot(performance).nextSpeaker?.name, 'Zoya');
  assert.equal((await provider.advance(performance)).beat.speaker, 'Zoya');
  assert.equal(performanceSnapshot(performance).nextSpeaker?.name, 'Ravi');
});

test('custom rehearsal uses the edited cast throughout a complete offline play', async () => {
  const cast = [
    { name: 'Zoya', emoji: 'Z', persona: 'the bride', style: 'brisk' },
    { name: 'Ravi', emoji: 'R', persona: 'the groom', style: 'romantic' },
    { name: 'Noor', emoji: 'N', persona: 'the aunt', style: 'opinionated' },
  ];
  let requests = 0;
  const provider = createPerformanceProvider(async () => {
    requests += 1;
    throw new Error('a rehearsal cannot make provider requests');
  });
  const performance = createRehearsalSession('wedding', 'a wedding', cast);
  const lines = [];
  for (let turn = 0; turn < (DEMO_ROUNDS + LIVE_EXTENSION_ROUNDS) * 3 && performanceSnapshot(performance).canAdvance; turn += 1) {
    lines.push((await provider.advance(performance)).beat);
  }
  assert.deepEqual(lines.slice(0, 3).map((beat) => beat.speaker), ['Zoya', 'Ravi', 'Noor']);
  assert.equal(lines.some((beat) => /\b(?:Meera|Arun|Auntie)\b/.test(beat.text)), false);
  assert.ok(performanceSnapshot(performance).contradictions.some((event) => event.complete));
  await provider.finish(performance);
  assert.equal(performanceSnapshot(performance).complete, true);
  assert.deepEqual(performanceDrift(performance).entries.map((entry) => entry.speaker), ['Zoya', 'Ravi', 'Noor']);
  assert.equal(requests, 0);
});
