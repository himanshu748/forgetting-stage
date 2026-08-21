import type { ChatMessage } from '../engine/types.ts';

const ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';

// Provider routing shifts under you. Qwen/Qwen2.5-7B-Instruct served fine in the
// morning and was dropped by the afternoon with a 400. Never assume a model id
// stays available; check https://router.huggingface.co/v1/models when this breaks.
export const MODEL = process.env.MODEL ?? 'Qwen/Qwen3-4B-Instruct-2507';

export function requireToken(): string {
  const token = process.env.HF_TOKEN;
  if (!token) {
    console.error('Missing HF_TOKEN. Put it in ../forgetting-stage-notes/.env');
    process.exit(1);
  }
  return token;
}

export async function chat(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 80,
      temperature: opts.temperature ?? 0.9,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes('model_not_supported')) {
      throw new Error(
        `Model "${MODEL}" is not served by your enabled providers right now.\n` +
          `Model availability changes without notice. List what is currently offered:\n` +
          `  curl -s https://router.huggingface.co/v1/models -H "Authorization: Bearer $HF_TOKEN" | jq -r '.data[].id'\n` +
          `Then re-run with MODEL=<id>.`,
      );
    }
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? '';
}

/**
 * Stand-in for the model's real tokenizer.
 *
 * The budget is supposed to be measured with the serving model's own tokenizer,
 * which the original did locally via transformers. Over the HTTP router there is
 * no tokenizer, so this approximates at ~4 characters per token. Good enough to
 * exercise eviction, NOT good enough to claim the cap is exact. Replace before
 * shipping, either by bundling the tokenizer or counting server side.
 */
export function approxTokens(text: string): number {
  return text ? Math.ceil(text.length / 4) : 0;
}
