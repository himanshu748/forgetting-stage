import assert from 'node:assert/strict';
import { test } from 'node:test';

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
