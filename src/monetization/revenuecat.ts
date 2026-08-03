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

function publicKeyForPlatform(platform: string, env: Record<string, string | undefined>): string | null {
  if (env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY) return env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  if (platform === 'ios') return env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? null;
  if (platform === 'android') return env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? null;
  return null;
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
  env?: Record<string, string | undefined>;
  loadPurchases: () => Promise<{ default?: PurchasesModule } | PurchasesModule>;
}) {
  const env = opts.env ?? process.env;
  let purchases: PurchasesModule | null = null;
  let initialized = false;

  async function module(): Promise<PurchasesModule | null> {
    const key = publicKeyForPlatform(opts.platform, env);
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
