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

const TURNS = Number(process.env.TURNS ?? 16);
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
  console.log(`turns: ${TURNS}, budget: ${engine.budget} tokens\n`);

  const opening = await chat(engine.prepareOpening(PREMISE), { maxTokens: 60 });
  const openingBeat = engine.commitOpening(opening);
  console.log(`🎙️  ${openingBeat.text}\n`);

  let pinnedId: number | null = null;
  let firstEvictionTurn: number | null = null;

  for (let turn = 1; turn <= TURNS; turn += 1) {
    const { speaker, messages } = engine.prepareBeat();
    const raw = await chat(messages);
    const beat = engine.commitBeat(speaker, raw);

    // Pin the first actual line, so we can watch one fact outlive the rest.
    if (pinnedId === null) {
      engine.pin(beat.id);
      pinnedId = beat.id;
      console.log(`${speaker.emoji} ${speaker.name}: ${beat.text}   📌 PINNED`);
    } else {
      console.log(`${speaker.emoji} ${speaker.name}: ${beat.text}`);
    }

    const tokens = engine.memoryTokens();
    console.log(
      `   ${bar(engine.budgetFraction())} ${tokens}/${engine.budget} · turn ${turn}`,
    );

    if (engine.lastForgotten.length) {
      if (firstEvictionTurn === null) firstEvictionTurn = turn;
      for (const gone of engine.lastForgotten) {
        console.log(`   🗑  FORGOTTEN: ${gone.speaker}: ${gone.text.slice(0, 60)}...`);
      }
    }
    console.log();
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
  if (firstEvictionTurn === null) {
    console.log(`NO EVICTION in ${TURNS} turns. Final: ${engine.memoryTokens()}/${engine.budget}.`);
    console.log('The play never forgot anything, so the whole mechanic never fired.');
    console.log('Either sessions must be much longer, or the budget must come down.');
  } else {
    console.log(`first eviction on turn ${firstEvictionTurn} of ${TURNS}.`);
  }
}

main().catch((err) => {
  console.error('\nPlay failed:', err.message);
  process.exit(1);
});
