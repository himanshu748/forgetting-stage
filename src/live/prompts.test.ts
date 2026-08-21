import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CAST } from '../game/content.ts';
import { createGameSession } from '../game/session.ts';
import {
  buildBeatGeneration,
  buildCurtainGeneration,
  buildOpeningGeneration,
  findPremise,
} from './prompts.ts';

test('builds a trusted opening from an allowlisted premise id', () => {
  const generation = buildOpeningGeneration('wedding');
  assert.equal(generation.kind, 'opening');
  assert.match(generation.messages[1]?.content ?? '', /wedding where nobody can agree/);
});

test('builds an actor prompt exclusively from server session memory', () => {
  const session = createGameSession('wedding', 'a wedding');
  const speaker = CAST[0]!;
  const generation = buildBeatGeneration(session, speaker);
  const script = session.engine.transcript();

  assert.equal(generation.kind, 'beat');
  assert.match(generation.messages[0]?.content ?? '', /You are Meera/);
  assert.equal(
    (generation.messages[1]?.content ?? '').includes(script.split('\n')[0]!.slice(0, 20)),
    true,
  );
  assert.doesNotMatch(generation.messages[0]?.content ?? '', new RegExp(speaker.persona, 'i'));
});

test('curtain prompt sees the current post-eviction transcript', () => {
  const session = createGameSession('wedding', 'a wedding', undefined, { budget: 12 });
  const forgottenText = session.engine.forgotten[0]?.text;
  const generation = buildCurtainGeneration(session);
  const prompt = generation.messages[1]?.content ?? '';
  assert.equal(generation.kind, 'curtain');
  if (forgottenText) assert.doesNotMatch(prompt, new RegExp(forgottenText, 'i'));
  assert.match(prompt, /SCRIPT SO FAR/);
});

test('rejects unknown premises before a model prompt is built', () => {
  assert.throws(() => findPremise('invented'), /premiseId is not allowed/);
});
