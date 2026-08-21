import type { CountTokens } from '../engine/types.ts';

type Tokenizer = {
  encode(text: string, options?: { add_special_tokens?: boolean }): {
    ids: ArrayLike<unknown>;
  };
};

type LoadTokenizer = (model: string) => Promise<Tokenizer>;

const counters = new Map<string, Promise<CountTokens>>();

function modelPath(model: string): string {
  return model.split('/').map(encodeURIComponent).join('/');
}

async function loadHubJson(model: string, filename: string): Promise<object> {
  const token = process.env.HF_TOKEN;
  const response = await fetch(
    `https://huggingface.co/${modelPath(model)}/resolve/main/${filename}`,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );
  if (!response.ok) throw new Error(`tokenizer file ${filename} returned ${response.status}`);
  return response.json() as Promise<object>;
}

async function loadHubTokenizer(model: string): Promise<Tokenizer> {
  const [{ Tokenizer }, tokenizerJson, tokenizerConfig] = await Promise.all([
    import('@huggingface/tokenizers'),
    loadHubJson(model, 'tokenizer.json'),
    loadHubJson(model, 'tokenizer_config.json'),
  ]);
  return new Tokenizer(tokenizerJson, tokenizerConfig);
}

/**
 * Loads the tokenizer for the exact model id sent to the inference router.
 * The promise is cached per warm server process so a tokenizer is never loaded
 * once per beat. Only the two public tokenizer JSON files are fetched, using the
 * server-only HF token when present. No model weights or image stack are loaded.
 */
export function loadModelTokenCounter(
  model: string,
  loadTokenizer: LoadTokenizer = loadHubTokenizer,
): Promise<CountTokens> {
  const cached = counters.get(model);
  if (cached) return cached;

  const pending = loadTokenizer(model).then((tokenizer) => (text: string) => (
    text ? tokenizer.encode(text, { add_special_tokens: false }).ids.length : 0
  ));
  counters.set(model, pending);
  pending.catch(() => counters.delete(model));
  return pending;
}
