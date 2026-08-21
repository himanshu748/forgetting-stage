import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createLayersClient } from './layers.ts';

test('does not load Layers on web or without a configured App ID', async () => {
  let loads = 0;
  const client = createLayersClient({
    platform: 'web',
    appId: 'public-app-id',
    loadSdk: async () => {
      loads += 1;
      throw new Error('should not load');
    },
  });

  assert.equal(await client.initialize(), false);
  await client.track('performance_started', { premise_id: 'wedding' });
  assert.equal(loads, 0);
});

test('initializes once and records product events without requesting tracking permission', async () => {
  const configurations: unknown[] = [];
  const events: Array<{ name: string; properties?: Record<string, string | number | boolean> }> = [];
  let initCalls = 0;

  class FakeLayers {
    constructor(config: unknown) {
      configurations.push(config);
    }

    async init() {
      initCalls += 1;
    }

    track(name: string, properties?: Record<string, string | number | boolean>) {
      events.push({ name, ...(properties ? { properties } : {}) });
    }

    getFeatureFlag(flagKey: string) {
      return flagKey === 'curtain_reminder_copy' ? 'curiosity' : undefined;
    }
  }

  const client = createLayersClient({
    platform: 'android',
    appId: '  public-app-id  ',
    debug: true,
    loadSdk: async () => ({ LayersReactNative: FakeLayers }),
  });

  await Promise.all([client.initialize(), client.initialize()]);
  await client.track('performance_completed', {
    premise_id: 'wedding',
    forgotten_count: 4,
  });
  assert.equal(await client.reminderVariant(), 'curiosity');

  assert.equal(initCalls, 1);
  assert.deepEqual(configurations, [{
    appId: 'public-app-id',
    environment: 'production',
    enableDebug: true,
  }]);
  assert.deepEqual(events, [{
    name: 'performance_completed',
    properties: { premise_id: 'wedding', forgotten_count: 4 },
  }]);
});

test('fails open when analytics initialization or tracking throws', async () => {
  class BrokenLayers {
    async init() {
      throw new Error('offline');
    }

    track() {
      throw new Error('offline');
    }

    getFeatureFlag() {
      throw new Error('offline');
    }
  }

  const client = createLayersClient({
    platform: 'ios',
    appId: 'public-app-id',
    loadSdk: async () => ({ LayersReactNative: BrokenLayers }),
  });

  assert.equal(await client.initialize(), false);
  await assert.doesNotReject(client.track('paywall_opened'));
  assert.equal(await client.reminderVariant(), 'free_show');
});
