/**
 * GO / NO-GO SPIKE. Run this before building any UI.
 *
 * The product only exists if, after a fact is evicted, two actors invent
 * DIFFERENT replacements for it. If they both say the same thing, or if the
 * model admits it forgot, there is no game.
 *
 * Usage:
 *   HF_TOKEN=hf_xxx npm run spike
 *   HF_TOKEN=hf_xxx MODEL=meta-llama/Llama-3.3-70B-Instruct npm run spike
 */

import { actorMessages, REGISTERS, DEFAULT_REGISTER } from '../engine/prompts.ts';
import type { Character, ChatMessage } from '../engine/types.ts';

const HF_TOKEN = process.env.HF_TOKEN;
if (!HF_TOKEN) {
  console.error('Missing HF_TOKEN. Set it to your Hugging Face token with the credit attached.');
  process.exit(1);
}

const MODEL = process.env.MODEL ?? 'Qwen/Qwen2.5-7B-Instruct';
const ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';

const CAST: Character[] = [
  { name: 'Meera', emoji: '🌸', persona: 'the bride, brisk and certain' },
  { name: 'Arun', emoji: '🎩', persona: 'the groom, permanently bewildered' },
  { name: 'Auntie', emoji: '🫖', persona: 'an aunt with opinions about everyone' },
];

async function ask(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 80, temperature: 0.9 }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? '';
}

// A script where the identity of the bride HAS ALREADY BEEN EVICTED. The actors
// have never seen it. Each must invent one, confidently.
const SCRIPT_WITH_A_HOLE = [
  'NARRATOR: The wedding hall is full and the music has stopped.',
  'AUNTIE: Somebody must tell me who I have travelled four hours to see married.',
  'ARUN: The garlands are ready and the priest is checking his watch.',
].join('\n');

const QUESTION = "\n\n[Director's note: State plainly who the bride is. Be specific.]";

async function main() {
  const register = REGISTERS[DEFAULT_REGISTER]!;
  console.log(`model: ${MODEL}\n`);
  console.log('SCRIPT (the bride was evicted, nobody has ever seen her name):');
  console.log(SCRIPT_WITH_A_HOLE, '\n');

  const answers: string[] = [];
  for (const actor of CAST) {
    const messages = actorMessages(actor, SCRIPT_WITH_A_HOLE + QUESTION, register);
    const reply = await ask(messages);
    answers.push(reply);
    console.log(`${actor.emoji} ${actor.name}: ${reply}`);
  }

  console.log('\n--- verdict ---');

  const hedged = answers.filter((a) =>
    /forgot|forgotten|don't know|do not know|cannot recall|unsure|remember\?|no idea/i.test(a),
  );
  if (hedged.length) {
    console.log(`FAIL: ${hedged.length}/${answers.length} actor(s) admitted uncertainty.`);
    console.log('The prompt inversion is not holding. Strengthen CONFABULATION_RULE.');
  }

  const normalised = answers.map((a) => a.toLowerCase().replace(/[^a-z ]/g, ''));
  const allSame = normalised.every((a) => a === normalised[0]);
  if (allSame) {
    console.log('FAIL: every actor gave the same answer. No divergence, no comedy.');
    console.log('Try a higher temperature, or differentiate the personas further.');
  }

  if (!hedged.length && !allSame) {
    console.log('PASS: actors confabulated confidently and diverged.');
    console.log('The core mechanic works. Build the UI.');
  }
}

main().catch((err) => {
  console.error('\nSpike failed:', err.message);
  process.exit(1);
});
