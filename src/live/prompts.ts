import {
  actorMessages,
  curtainMessages,
  DEFAULT_REGISTER,
  openingMessages,
  REGISTERS,
} from '../engine/prompts.ts';
import type { ChatMessage, Character } from '../engine/types.ts';
import { CAST, PREMISES } from '../game/content.ts';
import { MAX_SCRIPT_CHARS, type GenerationRequest } from './contract.ts';

export type TrustedGeneration = {
  kind: GenerationRequest['kind'];
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
};

function requiredString(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${name} must not be empty`);
  if (trimmed.length > maxLength) throw new Error(`${name} is too long`);
  return trimmed;
}

function findPremise(id: unknown) {
  const premiseId = requiredString(id, 'premiseId', 64);
  const premise = PREMISES.find((candidate) => candidate.id === premiseId);
  if (!premise) throw new Error('premiseId is not allowed');
  return premise;
}

function findSpeaker(name: unknown): Character {
  const speakerName = requiredString(name, 'speakerName', 64);
  const speaker = CAST.find((candidate) => candidate.name === speakerName);
  if (!speaker) throw new Error('speakerName is not allowed');
  return speaker;
}

function trustedScript(value: unknown): string {
  return requiredString(value, 'script', MAX_SCRIPT_CHARS);
}

/**
 * Converts a small public request into trusted prompts on the server. The client
 * can choose a known premise, a known actor and provide the current remembered
 * transcript. It can never provide system instructions or arbitrary personas.
 */
export function buildTrustedGeneration(input: unknown): TrustedGeneration {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('request body must be an object');
  }
  const body = input as Record<string, unknown>;
  requiredString(body.performanceId, 'performanceId', 128);
  const kind = body.kind;
  if (kind !== 'opening' && kind !== 'beat' && kind !== 'curtain') {
    throw new Error('kind must be opening, beat or curtain');
  }

  const premise = findPremise(body.premiseId);
  const register = REGISTERS[DEFAULT_REGISTER]!;

  if (kind === 'opening') {
    return {
      kind,
      messages: openingMessages(premise.premise, register),
      maxTokens: 60,
      temperature: 0.8,
    };
  }

  const script = trustedScript(body.script);
  if (kind === 'curtain') {
    return {
      kind,
      messages: curtainMessages(script, register),
      maxTokens: 50,
      temperature: 0.8,
    };
  }

  const speaker = findSpeaker(body.speakerName);
  return {
    kind,
    messages: actorMessages(speaker, script, register),
    maxTokens: 80,
    temperature: 0.9,
  };
}
