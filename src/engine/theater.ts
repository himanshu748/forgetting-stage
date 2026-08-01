/**
 * The Forgetting Stage: improv engine.
 *
 * Ported from Thousand-Token Theater's theater.py, which won the Build Small
 * Hackathon. The original's key architectural choice is preserved: no model,
 * no network and no UI in here. The model is injected, so the eviction logic
 * is unit-testable without an API key.
 *
 * Changes from the original:
 *   - Beats can be PINNED and pinned beats are never evicted
 *   - The system prompt is inverted to force confident confabulation
 *   - A play ends on a curtain line rather than running out of turns
 *   - Drift is derived from beat attribution, so no fact-extraction call
 */

import {
  actorMessages,
  curtainMessages,
  DEFAULT_REGISTER,
  NARRATOR,
  openingMessages,
  REGISTERS,
} from './prompts.ts';
import {
  BUDGET_TOKENS,
  MAX_PINS,
  type Beat,
  type Character,
  type ChatMessage,
  type CountTokens,
  type Drift,
} from './types.ts';

export function scriptLine(beat: Beat): string {
  if (beat.kind === 'seed') return `[${beat.speaker}: ${beat.text}]`;
  if (beat.kind === 'direction') return `[Director's note: ${beat.text}]`;
  if (beat.kind === 'narration' || beat.kind === 'curtain') {
    return `NARRATOR: ${beat.text}`;
  }
  return `${beat.speaker.toUpperCase()}: ${beat.text}`;
}

export class TheaterEngine {
  readonly cast: Character[];
  readonly budget: number;
  private readonly countTokens: CountTokens;
  private readonly register: string;

  memory: Beat[] = [];
  forgotten: Beat[] = [];
  lastForgotten: Beat[] = [];
  private turn = 0;
  private nextId = 0;
  private allBeats: Beat[] = [];

  constructor(opts: {
    cast: Character[];
    countTokens: CountTokens;
    budget?: number;
    register?: string;
  }) {
    this.cast = [...opts.cast];
    this.countTokens = opts.countTokens;
    this.budget = opts.budget ?? BUDGET_TOKENS;
    this.register = REGISTERS[opts.register ?? DEFAULT_REGISTER] ?? REGISTERS[DEFAULT_REGISTER];
  }

  // ---- memory ------------------------------------------------------------ //

  transcript(beats: Beat[] = this.memory): string {
    return beats.map(scriptLine).join('\n');
  }

  memoryTokens(): number {
    return this.memory.length ? this.countTokens(this.transcript()) : 0;
  }

  budgetFraction(): number {
    return Math.min(1, this.memoryTokens() / this.budget);
  }

  pinnedCount(): number {
    return this.memory.filter((b) => b.pinned).length;
  }

  /** Pinned beats survive. That is the whole mechanic. */
  pin(beatId: number): boolean {
    if (this.pinnedCount() >= MAX_PINS) return false;
    const beat = this.memory.find((b) => b.id === beatId);
    if (!beat || beat.pinned) return false;
    beat.pinned = true;
    return true;
  }

  private appendAndEvict(beat: Beat): void {
    this.memory.push(beat);
    this.allBeats.push(beat);
    this.lastForgotten = [];

    // Evict oldest UNPINNED beats until we fit. A play made entirely of pinned
    // beats can exceed budget; that is correct, the player chose it.
    while (this.memoryTokens() > this.budget) {
      const victim = this.memory.findIndex((b) => !b.pinned && b.id !== beat.id);
      if (victim === -1) break;
      const [dropped] = this.memory.splice(victim, 1);
      this.forgotten.push(dropped);
      this.lastForgotten.push(dropped);
    }
  }

  private newBeat(
    speaker: string,
    emoji: string,
    text: string,
    kind: Beat['kind'],
  ): Beat {
    return { id: this.nextId++, speaker, emoji, text, kind, pinned: false };
  }

  // ---- turn order -------------------------------------------------------- //

  nextSpeaker(): Character {
    return this.cast[this.turn % this.cast.length];
  }

  // ---- streaming-friendly API -------------------------------------------- //

  prepareOpening(premise: string): ChatMessage[] {
    this.memory = [];
    this.forgotten = [];
    this.lastForgotten = [];
    this.allBeats = [];
    this.turn = 0;
    this.nextId = 0;

    // The premise and the cast go into shared memory, not just the system
    // prompt, so the troupe can forget what the play is about and who is in it.
    // They are seeded first, so they are the first things lost.
    this.appendAndEvict(this.newBeat('The play', '🎪', premise, 'seed'));
    for (const member of this.cast) {
      this.appendAndEvict(this.newBeat(member.name, member.emoji, member.persona, 'seed'));
    }

    return openingMessages(premise, this.register);
  }

  commitOpening(raw: string): Beat {
    const beat = this.newBeat(
      NARRATOR.name,
      NARRATOR.emoji,
      cleanOutput(raw, NARRATOR.name),
      'narration',
    );
    this.appendAndEvict(beat);
    return beat;
  }

  /** Director notes cost memory. Say more and they forget faster. */
  addDirection(note: string): Beat {
    const beat = this.newBeat('Stage Direction', '🎬', note.trim(), 'direction');
    this.appendAndEvict(beat);
    return beat;
  }

  prepareBeat(directorNote = ''): { speaker: Character; messages: ChatMessage[] } {
    const note = directorNote.trim();
    if (note) this.addDirection(note);
    const speaker = this.nextSpeaker();
    return { speaker, messages: actorMessages(speaker, this.scriptOrEmpty(), this.register) };
  }

  commitBeat(speaker: Character, raw: string): Beat {
    const beat = this.newBeat(speaker.name, speaker.emoji, cleanOutput(raw, speaker.name), 'line');
    this.appendAndEvict(beat);
    this.turn += 1;
    return beat;
  }

  prepareCurtain(): ChatMessage[] {
    return curtainMessages(this.scriptOrEmpty(), this.register);
  }

  commitCurtain(raw: string): Beat {
    const beat = this.newBeat(
      NARRATOR.name,
      NARRATOR.emoji,
      cleanOutput(raw, NARRATOR.name),
      'curtain',
    );
    this.appendAndEvict(beat);
    return beat;
  }

  private scriptOrEmpty(): string {
    return this.transcript() || '(The stage is empty. The play begins now.)';
  }

  // ---- drift ------------------------------------------------------------- //

  /**
   * Per character, first thing they said against last thing they said.
   * Needs no extra model call because beats already carry attribution.
   */
  drift(): Drift {
    const bySpeaker = new Map<string, Beat[]>();
    for (const beat of this.allBeats) {
      if (beat.kind !== 'line') continue;
      const list = bySpeaker.get(beat.speaker) ?? [];
      list.push(beat);
      bySpeaker.set(beat.speaker, list);
    }

    const entries = [...bySpeaker.entries()]
      .filter(([, beats]) => beats.length >= 2)
      .map(([speaker, beats]) => ({
        speaker,
        emoji: beats[0].emoji,
        first: beats[0].text,
        last: beats[beats.length - 1].text,
      }));

    return {
      entries,
      survived: this.memory.filter((b) => b.pinned),
      forgottenCount: this.forgotten.length,
    };
  }
}

/**
 * Defensive parsing for small models, kept from the original where it was
 * hard-won. Strips think tags, leading speaker labels, markdown bold, trims
 * an incomplete trailing sentence, and caps to two sentences so a spoken clip
 * stays short enough to read start to finish.
 */
export function cleanOutput(raw: string, speakerName: string): string {
  let text = raw ?? '';
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/<\/?think>/gi, '');
  text = text.replace(/\*\*/g, '').trim();

  const name = speakerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  text = text.replace(new RegExp(`^\\s*[>"'“”\\[(]*\\s*${name}\\b[^\\n:]{0,40}:\\s*`, 'i'), '');
  text = text.replace(
    new RegExp(`^\\s*[>"'“”\\[(]*\\s*${name}\\s*[:,\\-\\u2013\\u2014]\\s*`, 'i'),
    '',
  );
  // Small models also invent labels that are not the speaker's name at all
  // (observed: "SUIT: Queue up..."). Strip any leading shouty label.
  text = text.replace(/^\s*[>"'“”[(]*\s*[A-Z][A-Z' .]{1,20}:\s*/, '');

  if (text.length >= 2 && /["'“”]/.test(text[0]) && /["'“”]/.test(text[text.length - 1])) {
    text = text.slice(1, -1).trim();
  }

  text = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join('\n')
    .trim();

  if (text && !'.!?…"\'’”*)'.includes(text[text.length - 1])) {
    const cut = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
    if (cut >= 40) text = text.slice(0, cut + 1).trim();
  }

  const parts = text.split(/(?<=[.!?…])\s+/);
  if (parts.length > 2) text = parts.slice(0, 2).join(' ').trim();

  return text || '*falls silent, having lost the thread*';
}
