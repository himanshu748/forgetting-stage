export const GENERATION_KINDS = ['opening', 'beat', 'curtain'] as const;

export type GenerationKind = (typeof GENERATION_KINDS)[number];

export type GenerationRequest = {
  kind: GenerationKind;
  premiseId: string;
  performanceId: string;
  script?: string;
  speakerName?: string;
};

export type GenerationResponse = {
  text: string;
  requestId: string;
  model?: string;
};

export type GenerationError = {
  error: string;
  code: string;
  requestId?: string;
};

export const MAX_SCRIPT_CHARS = 12_000;

export function isGenerationKind(value: unknown): value is GenerationKind {
  return typeof value === 'string' && GENERATION_KINDS.includes(value as GenerationKind);
}
