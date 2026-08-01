import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { Character } from '../engine/types.ts';
import { approxTokens, chat, MODEL } from '../model/hf.ts';
import { formatExperimentReport, runMatchedExperiment } from './matched.ts';

const CAST: Character[] = [
  { name: 'Meera', emoji: '🌸', persona: 'the bride, brisk and certain of everything' },
  { name: 'Arun', emoji: '🎩', persona: 'the groom, permanently one step behind' },
  { name: 'Auntie', emoji: '🫖', persona: 'an aunt with loud opinions about everyone' },
];

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

async function main() {
  const rounds = positiveInteger('ROUNDS', 10);
  const budget = positiveInteger('BUDGET', 1000);
  const controlBudget = positiveInteger('CONTROL_BUDGET', 1_000_000);
  const premise =
    process.env.PREMISE ?? 'a wedding where nobody can agree who is marrying whom';
  const output = resolve(process.env.OUTPUT ?? 'artifacts/latest-experiment.json');

  console.log(`Running matched experiment with ${MODEL}`);
  console.log(`Forgetting budget: ${budget}, control budget: ${controlBudget}`);

  const result = await runMatchedExperiment({
    premise,
    cast: CAST,
    rounds,
    countTokens: approxTokens,
    budget,
    controlBudget,
    complete: ({ messages, kind }) =>
      chat(messages, {
        maxTokens: kind === 'opening' ? 60 : kind === 'curtain' ? 50 : 80,
        temperature: 0.9,
      }),
  });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log();
  console.log(formatExperimentReport(result));
  console.log(`\nJSON written to ${output}`);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`\nExperiment failed: ${detail}`);
  process.exitCode = 1;
});
