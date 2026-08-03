import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Character } from '../engine/types.ts';
import {
  formatExperimentReport,
  runMatchedExperiment,
  type CompletionRequest,
} from './matched.ts';

const CAST: Character[] = [
  { name: 'Meera', emoji: 'M', persona: 'the certain bride' },
  { name: 'Arun', emoji: 'A', persona: 'the confused groom' },
];

const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

function recordedCompletion(request: CompletionRequest): Promise<string> {
  if (request.kind === 'opening') return Promise.resolve('The hall is ready for a disputed wedding.');
  if (request.kind === 'curtain') return Promise.resolve('The lights fade on two incompatible ceremonies.');
  return Promise.resolve(
    `${request.speaker?.name} states a detailed claim in round ${request.round} with enough words to consume memory quickly.`,
  );
}

test('runs matched forgetting and control arms with structured results', async () => {
  const result = await runMatchedExperiment({
    premise: 'a wedding where nobody agrees who is marrying whom',
    cast: CAST,
    rounds: 4,
    countTokens: countWords,
    complete: recordedCompletion,
    budget: 28,
    controlBudget: 10_000,
  });

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.arms.forgetting.beatsCompleted, 8);
  assert.equal(result.arms.control.beatsCompleted, 8);
  assert.ok(result.arms.forgetting.forgottenCount > 0);
  assert.equal(result.arms.control.forgottenCount, 0);
  assert.ok(result.arms.forgetting.firstEvictionRound);
  assert.equal(result.comparison.evictionObserved, true);
  assert.equal(result.comparison.controlStayedIntact, true);
  assert.equal(result.comparison.causalSignal, 'isolated');
  assert.equal(result.arms.forgetting.pinned.length, 1);
  assert.equal(result.arms.control.pinned.length, 1);
});

test('calls both arms through the same completion contract', async () => {
  const requests: CompletionRequest[] = [];
  await runMatchedExperiment({
    premise: 'a short rehearsal',
    cast: CAST,
    rounds: 2,
    countTokens: countWords,
    complete: async (request) => {
      requests.push(request);
      return recordedCompletion(request);
    },
    budget: 40,
    controlBudget: 1_000,
  });

  const byArm = (arm: CompletionRequest['arm']) => requests.filter((request) => request.arm === arm);
  assert.equal(byArm('forgetting').length, 6, 'opening, four beats and curtain');
  assert.equal(byArm('control').length, 6, 'opening, four beats and curtain');
  assert.deepEqual(
    byArm('forgetting').map(({ kind, round, beat, speaker }) => ({
      kind,
      round,
      beat,
      speaker: speaker?.name ?? null,
    })),
    byArm('control').map(({ kind, round, beat, speaker }) => ({
      kind,
      round,
      beat,
      speaker: speaker?.name ?? null,
    })),
  );
});

test('reports a confounded signal when both arms evict', async () => {
  const result = await runMatchedExperiment({
    premise: 'an overcrowded rehearsal',
    cast: CAST,
    rounds: 4,
    countTokens: countWords,
    complete: recordedCompletion,
    budget: 24,
    controlBudget: 25,
  });

  assert.ok(result.arms.forgetting.forgottenCount > 0);
  assert.ok(result.arms.control.forgottenCount > 0);
  assert.equal(result.comparison.controlStayedIntact, false);
  assert.equal(result.comparison.causalSignal, 'confounded');
});

test('can disable automatic pinning in both arms', async () => {
  const result = await runMatchedExperiment({
    premise: 'an unpinned rehearsal',
    cast: CAST,
    rounds: 2,
    countTokens: countWords,
    complete: recordedCompletion,
    budget: 30,
    controlBudget: 1_000,
    pinFirstLine: false,
  });

  assert.equal(result.pinFirstLine, false);
  assert.equal(result.arms.forgetting.pinned.length, 0);
  assert.equal(result.arms.control.pinned.length, 0);
});

test('reports when the experiment is too short to observe eviction', async () => {
  const result = await runMatchedExperiment({
    premise: 'a tiny rehearsal',
    cast: CAST,
    rounds: 1,
    countTokens: countWords,
    complete: recordedCompletion,
    budget: 10_000,
    controlBudget: 20_000,
  });

  assert.equal(result.arms.forgetting.firstEvictionRound, null);
  assert.equal(result.comparison.causalSignal, 'not-observed');
});

test('produces stable JSON and a readable comparison report', async () => {
  const result = await runMatchedExperiment({
    premise: 'a wedding',
    cast: CAST,
    rounds: 3,
    countTokens: countWords,
    complete: recordedCompletion,
    budget: 24,
    controlBudget: 10_000,
  });

  const parsed = JSON.parse(JSON.stringify(result));
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.arms.forgetting.name, 'forgetting');

  const report = formatExperimentReport(result);
  assert.match(report, /Matched forgetting experiment/);
  assert.match(report, /\| Forgotten beats \|/);
  assert.match(report, /Causal signal: isolated/);
});

test('validates inputs before invoking a completion', async () => {
  let calls = 0;
  await assert.rejects(
    runMatchedExperiment({
      premise: '   ',
      cast: CAST,
      rounds: 1,
      countTokens: countWords,
      complete: async () => {
        calls += 1;
        return 'unused';
      },
    }),
    /premise must not be empty/,
  );
  assert.equal(calls, 0);

  await assert.rejects(
    runMatchedExperiment({
      premise: 'valid',
      cast: [CAST[0]!, { ...CAST[0]! }],
      rounds: 1,
      countTokens: countWords,
      complete: recordedCompletion,
    }),
    /names must be unique/,
  );
});

test('adds arm and phase context when a completion fails', async () => {
  await assert.rejects(
    runMatchedExperiment({
      premise: 'a broken rehearsal',
      cast: CAST,
      rounds: 1,
      countTokens: countWords,
      complete: async (request) => {
        if (request.arm === 'forgetting' && request.kind === 'beat') throw new Error('provider timeout');
        return recordedCompletion(request);
      },
    }),
    /forgetting arm failed during beat in round 1: provider timeout/,
  );
});
