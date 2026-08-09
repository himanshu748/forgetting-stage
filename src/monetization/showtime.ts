/**
 * When money is allowed to speak.
 *
 * The product sells an illusion that breaks the moment a price interrupts a
 * beat, so the rule lives here rather than in the screens. A screen may only
 * render an offer the functions below allow.
 */

export type Moment = 'lobby' | 'stage' | 'curtain';

export type Screen = 'lobby' | 'stage' | 'drift';

export function momentForScreen(screen: Screen): Moment {
  if (screen === 'stage') return 'stage';
  return screen === 'drift' ? 'curtain' : 'lobby';
}

export function canOfferPurchase(moment: Moment): boolean {
  return moment !== 'stage';
}

/** The house ad runs after the curtain, never before it and never during. */
export function shouldShowHouseAd(moment: Moment, unlimited: boolean): boolean {
  return moment === 'curtain' && !unlimited;
}
