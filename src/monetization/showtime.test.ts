import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canOfferPurchase, momentForScreen, shouldShowHouseAd } from './showtime.ts';

// The load-bearing test of the whole business model: a price may never
// interrupt a performance.
test('nothing can be sold while the play is on stage', () => {
  assert.equal(canOfferPurchase(momentForScreen('stage')), false);
  assert.equal(shouldShowHouseAd(momentForScreen('stage'), false), false);
});

test('the lobby may sell, but carries no house ad', () => {
  assert.equal(canOfferPurchase(momentForScreen('lobby')), true);
  assert.equal(shouldShowHouseAd(momentForScreen('lobby'), false), false);
});

test('the house ad runs at the curtain and the pass removes it', () => {
  const curtain = momentForScreen('drift');
  assert.equal(canOfferPurchase(curtain), true);
  assert.equal(shouldShowHouseAd(curtain, false), true);
  assert.equal(shouldShowHouseAd(curtain, true), false);
});
