import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createRevenueCatClient,
  DIRECTORS_PASS_ENTITLEMENT,
  hasDirectorsPass,
  isEncorePackage,
  type PurchasesModule,
} from './revenuecat.ts';

test('detects the Director Pass entitlement', () => {
  assert.equal(hasDirectorsPass({ entitlements: { active: {} } }), false);
  assert.equal(hasDirectorsPass({
    entitlements: { active: { [DIRECTORS_PASS_ENTITLEMENT]: {} } },
  }), true);
});

test('tells the encore consumable apart from the pass', () => {
  const base = { description: '', price: '', nativePackage: null };
  assert.equal(isEncorePackage({ ...base, identifier: 'encore_ticket', title: 'One more show' }), true);
  assert.equal(isEncorePackage({ ...base, identifier: 'one_more', title: 'Encore' }), true);
  assert.equal(isEncorePackage({ ...base, identifier: 'monthly', title: "Director's Pass" }), false);
});

test('configures once, exposes offerings and unlocks after purchase', async () => {
  const configurations: string[] = [];
  const nativePackage = { identifier: 'monthly' };
  const module: PurchasesModule = {
    configure({ apiKey }) { configurations.push(apiKey); },
    async getCustomerInfo() { return { entitlements: { active: {} } }; },
    async getOfferings() {
      return {
        current: {
          availablePackages: [{
            identifier: 'monthly',
            product: { title: "Director's Pass", priceString: '$2.99' },
          }],
        },
      };
    },
    async purchasePackage(pkg) {
      assert.equal((pkg as { identifier: string }).identifier, 'monthly');
      return { customerInfo: { entitlements: { active: { [DIRECTORS_PASS_ENTITLEMENT]: {} } } } };
    },
    async restorePurchases() { return { entitlements: { active: {} } }; },
  };
  const client = createRevenueCatClient({
    platform: 'ios',
    env: { EXPO_PUBLIC_REVENUECAT_TEST_API_KEY: 'test_public_key' },
    loadPurchases: async () => ({ default: module }),
  });
  const status = await client.status();
  assert.equal(status.configured, true);
  assert.equal(status.unlimited, false);
  assert.equal(status.packages[0]?.price, '$2.99');
  status.packages[0]!.nativePackage = nativePackage;
  const purchased = await client.purchase(status.packages[0]!);
  assert.equal(purchased.unlimited, true);
  assert.deepEqual(configurations, ['test_public_key']);
});

test('stays unconfigured when no public SDK key exists', async () => {
  const client = createRevenueCatClient({
    platform: 'android',
    env: {},
    loadPurchases: async () => { throw new Error('must not load'); },
  });
  assert.deepEqual(await client.status(), { configured: false, unlimited: false, packages: [] });
});
