import { BUDGET_TOKENS, type Beat, type Character, type ChatMessage, type CountTokens } from '../engine/types.ts';
import { TheaterEngine } from '../engine/theater.ts';

export type CompletionKind = 'opening' | 'beat' | 'curtain';

export type CompletionRequest = {
  arm: ExperimentArmName;
  kind: CompletionKind;
  messages: ChatMessage[];
  round: number | null;
  beat: number | null;
  speaker: Character | null;
};

export type Complete = (request: CompletionRequest) => Promise<string>;

export type ExperimentArmName = 'forgetting' | 'control';

export type ExperimentArmResult = {
  name: ExperimentArmName;
  budget: number;
  roundsCompleted: number;
  beatsCompleted: number;
  firstEvictionRound: number | null;
  forgottenCount: number;
  forgottenSeedCount: number;
  forgottenLineCount: number;
  memoryTokens: number;
  peakMemoryTokens: number;
  pinned: Beat[];
  drift: ReturnType<TheaterEngine['drift']>['entries'];
  transcript: string;
};

export type ExperimentComparison = {
  evictionObserved: boolean;
  controlStayedIntact: boolean;
  forgottenDelta: number;
  forgottenSeedDelta: number;
  driftEntryDelta: number;
  causalSignal: 'not-observed' | 'isolated' | 'confounded';
};

export type MatchedExperimentResult = {
  schemaVersion: 1;
  premise: string;
  rounds: number;
  cast: Character[];
  pinFirstLine: boolean;
  arms: {
    forgetting: ExperimentArmResult;
    control: ExperimentArmResult;
  };
  comparison: ExperimentComparison;
};

export type MatchedExperimentOptions = {
  premise: string;
  cast: Character[];
  rounds: number;
  countTokens: CountTokens;
  complete: Complete;
  budget?: number;
  controlBudget?: number;
  register?: string;
  pinFirstLine?: boolean;
};

function assertOptions(opts: MatchedExperimentOptions): void {
  if (!opts.premise.trim()) throw new Error('premise must not be empty');
  if (!opts.cast.length) throw new Error('cast must contain at least one character');
  if (!Number.isInteger(opts.rounds) || opts.rounds < 1) {
    throw new Error('rounds must be a positive integer');
  }

  const names = opts.cast.map((member) => member.name.trim());
  if (names.some((name) => !name)) throw new Error('every cast member must have a name');
  if (new Set(names).size !== names.length) throw new Error('cast member names must be unique');

  const budget = opts.budget ?? BUDGET_TOKENS;
  const controlBudget = opts.controlBudget ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isFinite(budget) || budget < 1) throw new Error('budget must be a positive number');
  if (!Number.isFinite(controlBudget) || controlBudget < budget) {
    throw new Error('controlBudget must be a finite number greater than or equal to budget');
  }
}

async function completeOrThrow(
  complete: Complete,
  request: CompletionRequest,
): Promise<string> {
  try {
    return await complete(request);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const position = request.round === null ? request.kind : `${request.kind} in round ${request.round}`;
    throw new Error(`${request.arm} arm failed during ${position}: ${detail}`, { cause: error });
  }
}

async function runArm(
  name: ExperimentArmName,
  opts: MatchedExperimentOptions,
  budget: number,
): Promise<ExperimentArmResult> {
  const engine = new TheaterEngine({
    cast: opts.cast,
    countTokens: opts.countTokens,
    budget,
    register: opts.register,
  });
  const pinFirstLine = opts.pinFirstLine ?? true;
  let firstEvictionRound: number | null = null;
  let peakMemoryTokens = 0;
  let pinned = false;

  const observeMemory = () => {
    peakMemoryTokens = Math.max(peakMemoryTokens, engine.memoryTokens());
  };
  const observeEviction = (round: number) => {
    if (firstEvictionRound === null && engine.lastForgotten.length) firstEvictionRound = round;
  };

  const openingMessages = engine.prepareOpening(opts.premise);
  observeMemory();
  const opening = await completeOrThrow(opts.complete, {
    arm: name,
    kind: 'opening',
    messages: openingMessages,
    round: null,
    beat: null,
    speaker: null,
  });
  engine.commitOpening(opening);
  observeMemory();

  let beatsCompleted = 0;
  for (let round = 1; round <= opts.rounds; round += 1) {
    for (let index = 0; index < opts.cast.length; index += 1) {
      const { speaker, messages } = engine.prepareBeat();
      const raw = await completeOrThrow(opts.complete, {
        arm: name,
        kind: 'beat',
        messages,
        round,
        beat: beatsCompleted + 1,
        speaker,
      });
      const beat = engine.commitBeat(speaker, raw);
      beatsCompleted += 1;
      if (pinFirstLine && !pinned) pinned = engine.pin(beat.id);
      observeEviction(round);
      observeMemory();
    }
  }

  const curtain = await completeOrThrow(opts.complete, {
    arm: name,
    kind: 'curtain',
    messages: engine.prepareCurtain(),
    round: opts.rounds,
    beat: null,
    speaker: null,
  });
  engine.commitCurtain(curtain);
  observeEviction(opts.rounds);
  observeMemory();

  const drift = engine.drift();
  return {
    name,
    budget,
    roundsCompleted: opts.rounds,
    beatsCompleted,
    firstEvictionRound,
    forgottenCount: engine.forgotten.length,
    forgottenSeedCount: engine.forgotten.filter((beat) => beat.kind === 'seed').length,
    forgottenLineCount: engine.forgotten.filter((beat) => beat.kind === 'line').length,
    memoryTokens: engine.memoryTokens(),
    peakMemoryTokens,
    pinned: drift.survived.map((beat) => ({ ...beat })),
    drift: drift.entries.map((entry) => ({ ...entry })),
    transcript: engine.transcript(),
  };
}

function compare(
  forgetting: ExperimentArmResult,
  control: ExperimentArmResult,
): ExperimentComparison {
  const evictionObserved = forgetting.forgottenCount > 0;
  const controlStayedIntact = control.forgottenCount === 0;
  return {
    evictionObserved,
    controlStayedIntact,
    forgottenDelta: forgetting.forgottenCount - control.forgottenCount,
    forgottenSeedDelta: forgetting.forgottenSeedCount - control.forgottenSeedCount,
    driftEntryDelta: forgetting.drift.length - control.drift.length,
    causalSignal: !evictionObserved
      ? 'not-observed'
      : controlStayedIntact
        ? 'isolated'
        : 'confounded',
  };
}

/**
 * Runs two arms with identical configuration. The completion dependency receives
 * the arm name so callers can replay recorded answers for deterministic tests or
 * call a real model independently for live experiments.
 */
export async function runMatchedExperiment(
  opts: MatchedExperimentOptions,
): Promise<MatchedExperimentResult> {
  assertOptions(opts);
  const budget = opts.budget ?? BUDGET_TOKENS;
  const controlBudget = opts.controlBudget ?? Number.MAX_SAFE_INTEGER;

  const forgetting = await runArm('forgetting', opts, budget);
  const control = await runArm('control', opts, controlBudget);

  return {
    schemaVersion: 1,
    premise: opts.premise.trim(),
    rounds: opts.rounds,
    cast: opts.cast.map((member) => ({ ...member })),
    pinFirstLine: opts.pinFirstLine ?? true,
    arms: { forgetting, control },
    comparison: compare(forgetting, control),
  };
}

export function formatExperimentReport(result: MatchedExperimentResult): string {
  const { forgetting, control } = result.arms;
  const firstEviction = forgetting.firstEvictionRound ?? 'never';
  return [
    '# Matched forgetting experiment',
    '',
    `Premise: ${result.premise}`,
    `Rounds: ${result.rounds}`,
    `Cast: ${result.cast.map((member) => member.name).join(', ')}`,
    '',
    '| Metric | Forgetting | Control |',
    '| --- | ---: | ---: |',
    `| Budget | ${forgetting.budget} | ${control.budget} |`,
    `| Forgotten beats | ${forgetting.forgottenCount} | ${control.forgottenCount} |`,
    `| Forgotten seeds | ${forgetting.forgottenSeedCount} | ${control.forgottenSeedCount} |`,
    `| Drift entries | ${forgetting.drift.length} | ${control.drift.length} |`,
    `| Final memory tokens | ${forgetting.memoryTokens} | ${control.memoryTokens} |`,
    '',
    `First eviction round: ${firstEviction}`,
    `Causal signal: ${result.comparison.causalSignal}`,
  ].join('\n');
}
