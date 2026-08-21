import type { Character, ChatMessage } from './types.ts';

export const NARRATOR: Character = {
  name: 'The Narrator',
  emoji: '🎙️',
  style: 'velvet-voiced, evocative, and concise',
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
// MEASURED Aug 1: an earlier version of this rule told actors to invent confident
// replacements, but never told them to respect what was still in front of them.
// Result: they confabulated constantly, including over facts that were present.
// A control play with eviction DISABLED drifted just as wildly as one with it on,
// which meant the 1,000 token cap was decorative and the mechanic was invisible.
//
// Consistency is now the default and confabulation is the exception. The only
// way an actor can contradict the play is if a fact has genuinely been evicted.
const CONFABULATION_RULE = [
  '- SCRIPT SO FAR is the complete and only truth about this play.',
  '- Every detail present in it is settled fact. NEVER contradict, rename, alter',
  '  or second-guess anything that appears there. Build on it precisely.',
  '- Do NOT introduce new named people, places or events unless you need one to',
  '  answer something the script does not cover. Keep the play tight.',
  '- ONLY when a needed detail is genuinely ABSENT from the script may you invent',
  '  one, and then you must state it as confident settled fact.',
  '',
  '  ABSOLUTE RULE, this outranks everything above. You are never confused and',
  '  your character is never confused. You are always completely certain.',
  '  BANNED, never write anything resembling these: "I think", "I forgot",',
  '  "trying to remember", "what was it again", "I am not sure", "uh", "um",',
  '  "wait", "remind me", or any character struggling to recall anything.',
  '  Where the script is silent you do not hesitate, you ASSERT. Pick a specific',
  '  name, number or fact and deliver it as though it were never in doubt.',
  '- If another actor states something absent from the script, flatly disagree.',
  '',
  '  MEASURED Aug 8: actors opened nearly every beat by restating who was marrying',
  '  whom. That re-seeded the central fact into memory every round, so it could',
  '  never age out and the only drift left was trivia.',
  '- NEVER restate a fact the script already contains. Everyone present heard it.',
  '  Each line must ADD something the script does not yet say.',
  '',
  "- A [Director's note: ...] in the script is an ORDER and outranks every rule",
  '  above, including the one about not restating. Obey it in THIS line, in your',
  '  first clause, with the specific fact it asks for. Never mention the note.',
].join('\n');

export function actorMessages(
  speaker: Character,
  script: string,
  register: string,
): ChatMessage[] {
  const system = [
    `You are ${speaker.name}. Your delivery is ${speaker.style ?? 'confident and direct'}.`,
    `You are one actor in a troupe improvising a LIVE one-act play. Rules:`,
    `- Speak ONLY as ${speaker.name}; never write another character's lines.`,
    `- Reply with ONE short sentence (about 25 words MAX). Fast improv, not a monologue.`,
    `- Do NOT begin with your name or a 'Name:' label. Speak in the FIRST person.`,
    `- Put any stage action in *single asterisks*, e.g. *bows low*.`,
    CONFABULATION_RULE,
    // The original carried this rule and the port dropped it. A Chinese-trained
    // model promptly performed an entire beat in Mandarin. Do not remove.
    `- ALWAYS write in natural English, whatever language the script is in.`,
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
        `Register: ${register}. Always write in natural English. In ONE or two short sentences (about 30 words total), ` +
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
        `or explain it. Always write in natural English. Register: ${register}.`,
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
