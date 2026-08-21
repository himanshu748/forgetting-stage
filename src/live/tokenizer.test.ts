import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadModelTokenCounter } from './tokenizer.ts';

test('uses the requested model tokenizer without special tokens', async () => {
  let loadedModel = '';
  let options: { add_special_tokens?: boolean } | undefined;
  const count = await loadModelTokenCounter('test/exact-tokenizer-a', async (model) => {
    loadedModel = model;
    return {
      encode(text, received) {
        options = received;
        return { ids: text.split('|') };
      },
    };
  });

  assert.equal(count('one|two|three'), 3);
  assert.equal(loadedModel, 'test/exact-tokenizer-a');
  assert.deepEqual(options, { add_special_tokens: false });
});

test('caches one tokenizer load per serving model', async () => {
  let loads = 0;
  const loader = async () => {
    loads += 1;
    return { encode: (text: string) => ({ ids: [...text] }) };
  };
  const first = await loadModelTokenCounter('test/exact-tokenizer-b', loader);
  const second = await loadModelTokenCounter('test/exact-tokenizer-b', loader);
  assert.equal(first('abcd'), 4);
  assert.equal(second('xy'), 2);
  assert.equal(loads, 1);
});
