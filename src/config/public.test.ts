import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  resolveGenerationEndpoint,
  resolveRevenueCatPublicKey,
} from './public.ts';

test('resolves an absent web endpoint to the same-origin generation route', () => {
  assert.equal(resolveGenerationEndpoint('web', undefined), '/api/generate');
});

test('keeps an absolute HTTPS endpoint for native builds', () => {
  assert.equal(
    resolveGenerationEndpoint('android', 'https://generation.example/api/generate'),
    'https://generation.example/api/generate',
  );
});

test('chooses RevenueCat test and platform keys from an explicit key object', () => {
  const keys = {
    test: 'test_public_key',
    ios: 'ios_public_key',
    android: 'android_public_key',
  };
  assert.equal(resolveRevenueCatPublicKey('ios', keys), 'test_public_key');
  assert.equal(resolveRevenueCatPublicKey('android', { ...keys, test: undefined }), 'android_public_key');
  assert.equal(resolveRevenueCatPublicKey('ios', { ...keys, test: undefined }), 'ios_public_key');
  assert.equal(resolveRevenueCatPublicKey('web', keys), null);
});
