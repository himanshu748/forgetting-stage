// 'seed' holds the premise and the cast list. They sit in shared memory rather
// than only in the system prompt, so the troupe can forget what the play is
// about and who is in it. They are the oldest beats, so they go first.
export type BeatKind = 'seed' | 'narration' | 'line' | 'direction' | 'curtain';

export type Beat = {
  id: number;
  speaker: string;
  emoji: string;
  text: string;
  kind: BeatKind;
  pinned: boolean;
};

export type Character = {
  name: string;
  emoji: string;
  persona: string;
  /** Delivery cues only; identity facts stay in shared-memory persona seeds. */
  style?: string;
};

export type MemoryProbe = {
  lostSeed: Beat;
  instruction: string;
  responseIndex: number;
  responseCount: number;
};

export type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

export type CountTokens = (text: string) => number;

export type DriftEntry = {
  speaker: string;
  emoji: string;
  first: string;
  last: string;
};

export type Drift = {
  entries: DriftEntry[];
  survived: Beat[];
  forgottenCount: number;
};

export const BUDGET_TOKENS = 1000;

// One, deliberately. "You may save exactly one thing" is a rule you understand the
// first time you read it. Two invites arithmetic, one invites regret, and the single
// surviving fact stranded among the wreckage is the whole joke.
// A rewarded ad grants a second for the current play.
export const MAX_PINS = 1;
