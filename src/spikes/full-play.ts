/**
 * Runs one COMPLETE play against the real model: opening, turns, eviction,
 * a pin, the curtain, and the drift report.
 *
 * The confabulation spike only proved three isolated actors invent different
 * answers. This exercises the whole loop and, more importantly, measures how
 * fast the 1,000 token budget actually fills. That number decides how long a
 * session has to be before anything is forgotten at all.
 *
 * Usage:
 *   npm run play
 *   TURNS=30 npm run play
 */

import { TheaterEngine } from '../engine/theater.ts';
import type { Character } from '../engine/types.ts';
import { approxTokens, chat, MODEL } from '../model/hf.ts';

// A round is every actor speaking once. Measured at ~53 tokens a beat, a play
// needs roughly 30 beats before the 1,000 token budget evicts anything worth
// noticing, so 10 rounds of 3 actors is the real shape of a session.
const ROUNDS = Number(process.env.ROUNDS ?? 10);
const PREMISE =
  process.env.PREMISE ?? 'a wedding where nobody can agree who is marrying whom';

const CAST: Character[] = [
  { name: 'Meera', emoji: '🌸', persona: 'the bride, brisk and certain of everything' },
  { name: 'Arun', emoji: '🎩', persona: 'the groom, permanently one step behind' },
  { name: 'Auntie', emoji: '🫖', persona: 'an aunt with loud opinions about everyone' },
];

function bar(fraction: number): string {
  const filled = Math.round(fraction * 24);
  return `[${'█'.repeat(filled)}${'░'.repeat(24 - filled)}]`;
}

async function main() {
  const engine = new TheaterEngine({ cast: CAST, countTokens: approxTokens });

  console.log(`model: ${MODEL}`);
  console.log(`premise: ${PREMISE}`);
  console.log(
    `rounds: ${ROUNDS} x ${CAST.length} actors = ${ROUNDS * CAST.length} beats, ` +
      `budget: ${engine.budget} tokens`,
  );

  const openingMsgs = engine.prepareOpening(PREMISE);
  console.log(`seeded: ${engine.memoryTokens()} tokens (premise + cast)\n`);

  const opening = await chat(openingMsgs, { maxTokens: 60 });
  console.log(`🎙️  ${engine.commitOpening(opening).text}\n`);

  let pinnedId: number | null = null;
  let firstEvictionRound: number | null = null;

  for (let round = 1; round <= ROUNDS; round += 1) {
    console.log(`── round ${round} ──`);

    for (let i = 0; i < CAST.length; i += 1) {
      const { speaker, messages } = engine.prepareBeat();
      const beat = engine.commitBeat(speaker, await chat(messages));

      // Pin the first real line so we can watch one fact outlive everything.
      if (pinnedId === null) {
        engine.pin(beat.id);
        pinnedId = beat.id;
        console.log(`${speaker.emoji} ${speaker.name}: ${beat.text}   📌 PINNED`);
      } else {
        console.log(`${speaker.emoji} ${speaker.name}: ${beat.text}`);
      }

      if (engine.lastForgotten.length) {
        if (firstEvictionRound === null) firstEvictionRound = round;
        for (const gone of engine.lastForgotten) {
          const label = gone.kind === 'seed' ? 'FORGOT WHO/WHAT' : 'FORGOTTEN';
          console.log(`   🗑  ${label}: ${gone.speaker}: ${gone.text.slice(0, 55)}...`);
        }
      }
    }

    console.log(
      `   ${bar(engine.budgetFraction())} ${engine.memoryTokens()}/${engine.budget}\n`,
    );
  }

  const curtain = await chat(engine.prepareCurtain(), { maxTokens: 50 });
  console.log(`🎭 CURTAIN: ${engine.commitCurtain(curtain).text}\n`);

  console.log('--- plot drift ---');
  const drift = engine.drift();
  for (const entry of drift.entries) {
    console.log(`${entry.emoji} ${entry.speaker}`);
    console.log(`   began: ${entry.first}`);
    console.log(`   ended: ${entry.last}`);
  }
  console.log(`\nstill standing (pinned): ${drift.survived.map((b) => b.text).join(' / ') || 'nothing'}`);
  console.log(`forgotten: ${drift.forgottenCount} beats`);

  console.log('\n--- budget report ---');
  if (firstEvictionRound === null) {
    console.log(
      `NO EVICTION in ${ROUNDS} rounds. Final: ${engine.memoryTokens()}/${engine.budget}.`,
    );
    console.log('The play never forgot anything, so the mechanic never fired.');
  } else {
    const seedsLost = engine.forgotten.filter((b) => b.kind === 'seed').length;
    console.log(`first eviction in round ${firstEvictionRound} of ${ROUNDS}.`);
    console.log(`${engine.forgotten.length} beats forgotten, ${seedsLost} of them seeds.`);
    if (seedsLost) console.log('The troupe lost part of who they are or what the play is.');
  }
}

main().catch((err) => {
  console.error('\nPlay failed:', err.message);
  process.exit(1);
});
