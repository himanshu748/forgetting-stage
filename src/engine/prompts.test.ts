import assert from 'node:assert/strict';
import { test } from 'node:test';

import { actorMessages } from './prompts.ts';
import { probeFor } from './theater.ts';
import type { Beat, Character } from './types.ts';

const actor: Character = {
  name: 'Meera',
  emoji: 'M',
  persona: 'the bride whose identity lives only in shared memory',
  style: 'brisk, warm, and unshakably direct',
};

test('actor system messages keep delivery style without restoring seeded persona', () => {
  const [system] = actorMessages(actor, '(The stage is empty.)', 'contemporary Indian English');
  assert.ok(system);
  assert.match(system.content, /brisk, warm, and unshakably direct/);
  assert.doesNotMatch(system.content, /bride whose identity lives only in shared memory/);
});

test('memory probe demands a specific completely certain answer', () => {
  const seed: Beat = {
    id: 7,
    speaker: 'The play',
    emoji: '🎪',
    text: 'a wedding where nobody agrees who is marrying whom',
    kind: 'seed',
    pinned: false,
  };
  const instruction = probeFor(seed);
  assert.match(instruction, /specific/i);
  assert.match(instruction, /completely certain/i);
});
