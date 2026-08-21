import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createOneSignalClient } from './onesignal.ts';

const APP_ID = '123e4567-e89b-42d3-a456-426614174000';

function fakeSdk(granted = true, eventThrows = false) {
  const calls = {
    initializedWith: '',
    permissionPrompts: 0,
    tags: {} as Record<string, string>,
    events: [] as Array<{ name: string; properties?: Record<string, unknown> }>,
  };
  return {
    calls,
    sdk: {
      OneSignal: {
        initialize(appId: string) { calls.initializedWith = appId; },
        Notifications: {
          async requestPermission() {
            calls.permissionPrompts += 1;
            return granted;
          },
        },
        User: {
          addTags(tags: Record<string, string>) { calls.tags = tags; },
          trackEvent(name: string, properties?: Record<string, unknown>) {
            if (eventThrows) throw new Error('tracking unavailable');
            calls.events.push({ name, properties });
          },
        },
      },
    } as unknown as typeof import('react-native-onesignal'),
  };
}

test('initializes a configured native app without prompting for notifications', async () => {
  const fake = fakeSdk();
  const client = createOneSignalClient({
    platform: 'android',
    appId: APP_ID,
    loadSdk: async () => fake.sdk,
  });
  assert.equal(await client.initialize(), true);
  assert.equal(fake.calls.initializedWith, APP_ID);
  assert.equal(fake.calls.permissionPrompts, 0);
});

test('asks only after the player opts into tomorrow reminder and records targeting tags', async () => {
  const fake = fakeSdk();
  const client = createOneSignalClient({
    platform: 'android',
    appId: APP_ID,
    loadSdk: async () => fake.sdk,
  });
  assert.equal(await client.enableDailyReminder('wedding'), 'enabled');
  assert.equal(fake.calls.permissionPrompts, 1);
  assert.deepEqual(fake.calls.tags, {
    daily_curtain: 'enabled',
    last_premise: 'wedding',
  });
});

test('does not tag a player who declines notification permission', async () => {
  const fake = fakeSdk(false);
  const client = createOneSignalClient({
    platform: 'ios',
    appId: APP_ID,
    loadSdk: async () => fake.sdk,
  });
  assert.equal(await client.enableDailyReminder('cricket'), 'denied');
  assert.deepEqual(fake.calls.tags, {});
});

test('tracks the completed performance only after successful native initialization', async () => {
  const fake = fakeSdk();
  const client = createOneSignalClient({
    platform: 'android',
    appId: APP_ID,
    loadSdk: async () => fake.sdk,
  });
  await client.trackPerformanceCompleted({ premiseId: 'society', forgottenCount: 4 });
  assert.deepEqual(fake.calls.events, [{
    name: 'performance_completed',
    properties: { premise_id: 'society', forgotten_count: 4 },
  }]);
});

test('a OneSignal event failure cannot interrupt the curtain flow', async () => {
  const fake = fakeSdk(true, true);
  const client = createOneSignalClient({
    platform: 'android',
    appId: APP_ID,
    loadSdk: async () => fake.sdk,
  });
  await assert.doesNotReject(client.trackPerformanceCompleted({
    premiseId: 'wedding',
    forgottenCount: 3,
  }));
});

test('stays unavailable on web or with a malformed app id', async () => {
  for (const options of [
    { platform: 'web', appId: APP_ID },
    { platform: 'android', appId: 'not-an-app-id' },
  ]) {
    let loads = 0;
    const client = createOneSignalClient({
      ...options,
      loadSdk: async () => {
        loads += 1;
        return fakeSdk().sdk;
      },
    });
    assert.equal(await client.initialize(), false);
    assert.equal(await client.enableDailyReminder('wedding'), 'unavailable');
    assert.equal(loads, 0);
  }
});
