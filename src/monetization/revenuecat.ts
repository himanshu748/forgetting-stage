import {
  resolveRevenueCatPublicKey,
  type RevenueCatPublicKeys,
} from '../config/public.ts';

export const DIRECTORS_PASS_ENTITLEMENT = 'directors_pass';

export type DirectorPackage = {
  identifier: string;
  title: string;
  description: string;
  price: string;
  nativePackage: unknown;
};

export type MonetizationStatus = {
  configured: boolean;
  unlimited: boolean;
  packages: DirectorPackage[];
};

export type PurchasesCustomerInfo = {
  entitlements?: { active?: Record<string, unknown> };
};

export type PurchasesPackage = {
  identifier?: string;
  product?: {
    title?: string;
    description?: string;
    priceString?: string;
  };
};

export type PurchasesOffering = {
  availablePackages?: PurchasesPackage[];
};

export type PurchasesModule = {
  configure(config: { apiKey: string }): void;
  getCustomerInfo(): Promise<PurchasesCustomerInfo>;
  getOfferings(): Promise<{ current?: PurchasesOffering | null }>;
  purchasePackage(pkg: unknown): Promise<{ customerInfo: PurchasesCustomerInfo }>;
  restorePurchases(): Promise<PurchasesCustomerInfo>;
};

export function hasDirectorsPass(info: PurchasesCustomerInfo): boolean {
  return Boolean(info.entitlements?.active?.[DIRECTORS_PASS_ENTITLEMENT]);
}

/**
 * The encore is a consumable, so it grants no entitlement and the customer info
 * comes back unchanged. It is recognised by its identifier instead, and the one
 * extra performance is written to the local ledger.
 */
export function isEncorePackage(pkg: DirectorPackage): boolean {
  return `${pkg.identifier} ${pkg.title}`.toLowerCase().includes('encore');
}

function mapPackage(pkg: PurchasesPackage): DirectorPackage {
  return {
    identifier: pkg.identifier ?? 'directors-pass',
    title: pkg.product?.title ?? "Director's Pass",
    description: pkg.product?.description ?? 'Unlimited AI performances and premium director controls.',
    price: pkg.product?.priceString ?? '',
    nativePackage: pkg,
  };
}

export function createRevenueCatClient(opts: {
  platform: string;
  publicKeys: RevenueCatPublicKeys;
  loadPurchases: () => Promise<{ default?: PurchasesModule } | PurchasesModule>;
}) {
  let purchases: PurchasesModule | null = null;
  let initialized = false;

  async function module(): Promise<PurchasesModule | null> {
    const key = resolveRevenueCatPublicKey(opts.platform, opts.publicKeys);
    if (!key || opts.platform === 'web') return null;
    if (!purchases) {
      const loaded = await opts.loadPurchases();
      purchases = 'default' in loaded && loaded.default ? loaded.default : loaded as PurchasesModule;
    }
    if (!initialized) {
      purchases.configure({ apiKey: key });
      initialized = true;
    }
    return purchases;
  }

  return {
    async status(): Promise<MonetizationStatus> {
      const sdk = await module();
      if (!sdk) return { configured: false, unlimited: false, packages: [] };
      const [info, offerings] = await Promise.all([sdk.getCustomerInfo(), sdk.getOfferings()]);
      return {
        configured: true,
        unlimited: hasDirectorsPass(info),
        packages: (offerings.current?.availablePackages ?? []).map(mapPackage),
      };
    },

    async purchase(pkg: DirectorPackage): Promise<MonetizationStatus> {
      const sdk = await module();
      if (!sdk) throw new Error('RevenueCat is not configured for this build');
      const { customerInfo } = await sdk.purchasePackage(pkg.nativePackage);
      const offerings = await sdk.getOfferings();
      return {
        configured: true,
        unlimited: hasDirectorsPass(customerInfo),
        packages: (offerings.current?.availablePackages ?? []).map(mapPackage),
      };
    },

    async restore(): Promise<MonetizationStatus> {
      const sdk = await module();
      if (!sdk) throw new Error('RevenueCat is not configured for this build');
      const info = await sdk.restorePurchases();
      const offerings = await sdk.getOfferings();
      return {
        configured: true,
        unlimited: hasDirectorsPass(info),
        packages: (offerings.current?.availablePackages ?? []).map(mapPackage),
      };
    },
  };
}

export type RevenueCatClient = ReturnType<typeof createRevenueCatClient>;
