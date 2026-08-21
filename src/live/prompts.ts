import {
  actorMessages,
  curtainMessages,
  DEFAULT_REGISTER,
  openingMessages,
  REGISTERS,
} from '../engine/prompts.ts';
import type { ChatMessage, Character } from '../engine/types.ts';
import { PREMISES } from '../game/content.ts';
import type { GameSession } from '../game/session.ts';

export type TrustedGeneration = {
  kind: 'opening' | 'beat' | 'curtain';
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

export function findPremise(id: unknown) {
  const premiseId = requiredString(id, 'premiseId', 64);
  const premise = PREMISES.find((candidate) => candidate.id === premiseId);
  if (!premise) throw new Error('premiseId is not allowed');
  return premise;
}

/**
 * Prompt builders only accept server-owned state. The public contract has no
 * transcript or speaker fields, so a client cannot restore an evicted fact or
 * choose which actor answers a probe.
 */
export function buildOpeningGeneration(premiseId: unknown): TrustedGeneration {
  const premise = findPremise(premiseId);
  const register = REGISTERS[DEFAULT_REGISTER]!;
  return {
    kind: 'opening',
    messages: openingMessages(premise.premise, register),
    maxTokens: 60,
    temperature: 0.8,
  };
}

export function buildBeatGeneration(
  session: GameSession,
  speaker: Character,
): TrustedGeneration {
  return {
    kind: 'beat',
    messages: actorMessages(speaker, session.engine.transcript(), REGISTERS[DEFAULT_REGISTER]!),
    maxTokens: 80,
    temperature: 0.9,
  };
}

export function buildCurtainGeneration(session: GameSession): TrustedGeneration {
  return {
    kind: 'curtain',
    messages: curtainMessages(session.engine.transcript(), REGISTERS[DEFAULT_REGISTER]!),
    maxTokens: 50,
    temperature: 0.8,
  };
}
