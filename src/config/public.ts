export type RevenueCatPublicKeys = {
  test?: string;
  ios?: string;
  android?: string;
};

export type PublicConfig = {
  generationEndpoint?: string;
  revenueCat: RevenueCatPublicKeys;
};

export function readPublicConfig(): PublicConfig {
  return {
    generationEndpoint: process.env.EXPO_PUBLIC_GENERATION_ENDPOINT,
    revenueCat: {
      test: process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY,
      ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
      android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    },
  };
}

export function resolveGenerationEndpoint(platform: string, endpoint: string | undefined): string | undefined {
  return platform === 'web' ? endpoint ?? '/api/generate' : endpoint;
}

export function resolveRevenueCatPublicKey(platform: string, keys: RevenueCatPublicKeys): string | null {
  if (platform === 'web') return null;
  if (keys.test) return keys.test;
  if (platform === 'ios') return keys.ios ?? null;
  if (platform === 'android') return keys.android ?? null;
  return null;
}
