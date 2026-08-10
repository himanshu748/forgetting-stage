/**
 * Proves the 1,000 token cap and the pin mechanic are real, with no model and no
 * network. Run: npm test
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanOutput, TheaterEngine } from './theater.ts';
import { MAX_PINS, type Character } from './types.ts';

const CAST: Character[] = [
  {
    name: 'Meera',
    emoji: '🌸',
    persona: 'the bride',
    style: 'brisk and certain',
  },
  {
    name: 'Arun',
    emoji: '🎩',
    persona: 'the groom',
    style: 'romantic and permanently bewildered',
  },
  {
    name: 'Auntie',
    emoji: '🫖',
    persona: 'an aunt',
    style: 'loudly opinionated',
  },
];

// Deterministic stand-in for the model tokenizer: one token per word.
const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

function engine(budget: number) {
  return new TheaterEngine({ cast: CAST, countTokens: countWords, budget });
}

function play(e: TheaterEngine, lines: string[]) {
  e.prepareOpening('a wedding');
  e.commitOpening('The hall is decorated and nobody agrees who is marrying whom.');
  for (const line of lines) {
    const { speaker } = e.prepareBeat();
    e.commitBeat(speaker, line);
  }
}

test('losing a seed queues two structured probes for consecutive responses', () => {
  // Big enough that the opening fits intact, small enough that beats evict it.
  const e = engine(70);
  e.prepareOpening('a wedding where nobody agrees who is marrying whom');
  e.commitOpening('The hall is full.');
  assert.equal(e.nextProbe(), null, 'nothing lost yet, nothing to ask about');

  for (let i = 0; i < 4; i += 1) {
    const { speaker } = e.prepareBeat();
    e.commitBeat(speaker, `Line ${i} carrying a good number of extra words to burn budget.`);
  }

  const first = e.nextProbe();
  assert.ok(first, 'an evicted seed must queue a probe');
  assert.equal(first.responseIndex, 1);
  assert.equal(first.responseCount, 2);
  assert.equal(first.lostSeed.id, e.forgotten[0]!.id);
  assert.notEqual(first.lostSeed, e.forgotten[0], 'the probe must carry a seed copy');
  assert.match(first.instruction, /state plainly/i);

  const second = e.nextProbe();
  assert.ok(second, 'consuming one probe must leave its second response queued');
  assert.equal(second.responseIndex, 2);
  assert.equal(second.responseCount, 2);
  assert.equal(second.lostSeed.id, first.lostSeed.id);
  assert.notEqual(second.lostSeed, first.lostSeed, 'each probe must return a defensive copy');
  assert.equal(e.nextProbe(), null, 'consuming both probes exhausts the lost seed probe');
});

test('opening seeds the premise and the cast into memory', () => {
  const e = engine(1000);
  e.prepareOpening('a wedding');
  const seeds = e.memory.filter((b) => b.kind === 'seed');
  assert.equal(seeds.length, 1 + CAST.length, 'premise plus one seed per cast member');
  assert.equal(seeds[0]!.text, 'a wedding');
  assert.ok(e.memoryTokens() > 0, 'seeds must consume budget');
});

test('beats accumulate while under budget', () => {
  const e = engine(1000);
  play(e, ['I am the bride.', 'I am the groom.']);
  // 1 premise seed + 3 cast seeds + 1 opening narration + 2 lines
  assert.equal(e.memory.length, 7);
  assert.equal(e.forgotten.length, 0);
});

test('seeds are evicted first, so the troupe forgets what the play is', () => {
  const e = engine(30);
  e.prepareOpening('a wedding where nobody agrees who is marrying whom');
  e.commitOpening('The hall is full.');
  for (let i = 0; i < 4; i += 1) {
    const { speaker } = e.prepareBeat();
    e.commitBeat(speaker, `Line ${i} carrying a good number of extra words to burn budget.`);
  }
  assert.ok(e.forgotten.length > 0, 'expected eviction');
  assert.equal(e.forgotten[0]!.kind, 'seed', 'the oldest beat is a seed, so it goes first');
});

test('oldest beat is evicted once over budget', () => {
  const e = engine(20);
  play(e, [
    'I am quite certain that I am the bride today.',
    'I am equally certain that I am the groom today.',
    'Somebody has moved the entire wedding to a different building.',
  ]);
  assert.ok(e.forgotten.length > 0, 'expected eviction');
  assert.ok(e.memoryTokens() <= e.budget, 'memory must fit the budget');
});

test('a pinned beat survives while unpinned beats around it are evicted', () => {
  const e = engine(20);
  e.prepareOpening('a wedding');
  e.commitOpening('A wedding hall, mid afternoon.');

  const { speaker } = e.prepareBeat();
  const pinnedBeat = e.commitBeat(speaker, 'Arun is the groom.');
  assert.equal(e.pin(pinnedBeat.id), true);

  for (let i = 0; i < 6; i += 1) {
    const next = e.prepareBeat();
    e.commitBeat(next.speaker, `Filler line number ${i} with several extra words to burn budget.`);
  }

  const survived = e.memory.some((b) => b.id === pinnedBeat.id);
  assert.equal(survived, true, 'pinned beat must never be evicted');
  assert.ok(e.forgotten.length > 0, 'unpinned beats should have been evicted');
  assert.equal(
    e.forgotten.some((b) => b.id === pinnedBeat.id),
    false,
  );
});

test('pins are capped', () => {
  const e = engine(1000);
  play(e, ['One.', 'Two.', 'Three.', 'Four.']);
  const ids = e.memory.map((b) => b.id);
  let accepted = 0;
  for (const id of ids) if (e.pin(id)) accepted += 1;
  assert.equal(accepted, MAX_PINS);
  assert.equal(e.pinnedCount(), MAX_PINS);
});

test('director notes consume the same budget', () => {
  const e = engine(1000);
  e.prepareOpening('a wedding');
  e.commitOpening('A hall.');
  const before = e.memoryTokens();
  e.addDirection('Someone should mention the missing cake at great length please');
  assert.ok(e.memoryTokens() > before, 'a typed direction must cost memory');
});

test('drift reports first against last line per speaker', () => {
  const e = engine(1000);
  play(e, [
    'I am the bride.',
    'I am the groom.',
    'I am the aunt.',
    'I am a waiter and I have never met these people.',
  ]);
  const drift = e.drift();
  const meera = drift.entries.find((d) => d.speaker === 'Meera');
  assert.ok(meera, 'Meera should appear in the drift report');
  assert.equal(meera.first, 'I am the bride.');
  assert.equal(meera.last, 'I am a waiter and I have never met these people.');
});

test('cleanOutput strips think tags and leading speaker labels', () => {
  assert.equal(cleanOutput('<think>hmm</think>Meera: I am the bride.', 'Meera'), 'I am the bride.');
  assert.equal(cleanOutput('**Arun**: I am the groom.', 'Arun'), 'I am the groom.');
  assert.equal(cleanOutput('', 'Meera'), '*falls silent, having lost the thread*');
});

// Observed in the first live spike: Qwen returned "SUIT: Queue up, let's see the
// bride!" for Arun. The label is not the speaker's name, so name-based stripping
// missed it entirely.
test('cleanOutput strips invented labels that are not the speaker name', () => {
  assert.equal(cleanOutput("SUIT: Queue up, let's see the bride!", 'Arun'), "Queue up, let's see the bride!");
  assert.equal(cleanOutput('NARRATOR: The hall is silent.', 'Meera'), 'The hall is silent.');
  // Must not eat legitimate opening words.
  assert.equal(cleanOutput('I am the bride.', 'Meera'), 'I am the bride.');
});
