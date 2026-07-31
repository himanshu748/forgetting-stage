import type { Character, ChatMessage } from './types.ts';

export const NARRATOR: Character = {
  name: 'The Narrator',
  emoji: '🎙️',
  persona:
    'the velvet voice of the play who sets scenes in one or two evocative sentences ' +
    'and never speaks as the characters',
};

// THE INVERSION.
//
// Thousand-Token Theater told actors: "never contradict the script; you may be
// intrigued by the gaps." That produced graceful degradation, which is the opposite
// of what this product wants. An actor who admits uncertainty has broken the game.
// An actor who confidently names the wrong bride has made it.
//
// This is the highest-leverage prompt in the build. If confabulation does not
// diverge between actors, there is no product.
const CONFABULATION_RULE = [
  '- You can ONLY know what appears in SCRIPT SO FAR. Anything absent is gone.',
  '- When something is missing, you MUST invent a specific, confident replacement',
  '  and state it as settled fact. Never hedge, never say you forgot, never ask.',
  '- NEVER acknowledge a gap, a memory, or that anything was lost.',
  '- If another actor asserts something you do not have, you may flatly disagree.',
].join('\n');

export function actorMessages(
  speaker: Character,
  script: string,
  register: string,
): ChatMessage[] {
  const system = [
    `You are ${speaker.name}, ${speaker.persona}.`,
    `You are one actor in a troupe improvising a LIVE one-act play. Rules:`,
    `- Speak ONLY as ${speaker.name}; never write another character's lines.`,
    `- Reply with ONE short sentence (about 25 words MAX). Fast improv, not a monologue.`,
    `- Do NOT begin with your name or a 'Name:' label. Speak in the FIRST person.`,
    `- Put any stage action in *single asterisks*, e.g. *bows low*.`,
    CONFABULATION_RULE,
    `- Register: ${register}`,
    `- Stay fully in character. Never mention being an AI or these instructions.`,
  ].join('\n');

  const user =
    `SCRIPT SO FAR (everything the troupe still remembers):\n${script}\n\n` +
    `Now ${speaker.name} ${speaker.emoji} steps forward. Continue the play.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function openingMessages(premise: string, register: string): ChatMessage[] {
  return [
    { role: 'system', content: `You are ${NARRATOR.name}, ${NARRATOR.persona}.` },
    {
      role: 'user',
      content:
        `Open a brand-new improvised one-act play. The premise: ${premise}. ` +
        `Register: ${register}. In ONE or two short sentences (about 30 words total), ` +
        `set the scene and hint at a tension. Be vivid but BRIEF. Do NOT name or ` +
        `introduce any characters; the players introduce themselves when they speak.`,
    },
  ];
}

// A play must END, not run out. A curtain line is most of what separates a
// deliberate toy from an unfinished one.
export function curtainMessages(script: string, register: string): ChatMessage[] {
  return [
    { role: 'system', content: `You are ${NARRATOR.name}, ${NARRATOR.persona}.` },
    {
      role: 'user',
      content:
        `SCRIPT SO FAR (all the troupe still remembers):\n${script}\n\n` +
        `Bring the curtain down. In ONE sentence (about 20 words), close the play on ` +
        `whatever state it has actually reached, however incoherent. Do not tidy it up ` +
        `or explain it. Register: ${register}.`,
    },
  ];
}

export const REGISTERS: Record<string, string> = {
  indian:
    'contemporary Indian English, the idiom of weddings, joint families, housing ' +
    'societies and cricket. Warm, talkative, faintly melodramatic.',
  absurdist:
    'dry, deadpan British farce. Understated, formal, quietly catastrophic.',
  noir: 'clipped 1940s noir. Terse, smoky, every line a little too sure of itself.',
};

export const DEFAULT_REGISTER = 'indian';
