import assert from 'node:assert/strict';
import { test } from 'node:test';

import { actorMessages } from '../engine/prompts.ts';
import type { LiveGenerator } from '../live/client.ts';
import { CAST } from './content.ts';
import { createPerformanceProvider, createPerformanceSession } from './performance.ts';
import { snapshotSession } from './session.ts';

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
  assert.equal((await provider.finish(performance)).beat.text, 'A live curtain.');
  assert.deepEqual(kinds, ['opening', 'beat', 'curtain']);
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
