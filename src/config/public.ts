export type RevenueCatPublicKeys = {
  test?: string;
  ios?: string;
  android?: string;
  useTestStore?: boolean;
};

export type PublicConfig = {
  generationEndpoint?: string;
  generationAccessKey?: string;
  revenueCat: RevenueCatPublicKeys;
  oneSignalAppId?: string;
  layersAppId?: string;
};

export function readPublicConfig(): PublicConfig {
  return {
    generationEndpoint: process.env.EXPO_PUBLIC_GENERATION_ENDPOINT,
    generationAccessKey: process.env.EXPO_PUBLIC_GENERATION_ACCESS_KEY,
    revenueCat: {
      test: process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY,
      ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
      android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
      useTestStore: process.env.EXPO_PUBLIC_REVENUECAT_USE_TEST_STORE === 'true',
    },
    oneSignalAppId: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID,
    layersAppId: process.env.EXPO_PUBLIC_LAYERS_APP_ID,
  };
}

export function resolveGenerationEndpoint(platform: string, endpoint: string | undefined): string | undefined {
  return platform === 'web' ? endpoint ?? '/api/generate' : endpoint;
}

export function resolveRevenueCatPublicKey(platform: string, keys: RevenueCatPublicKeys): string | null {
  if (platform === 'web') return null;
  if (keys.useTestStore) return keys.test ?? null;
  if (platform === 'ios') return keys.ios ?? null;
  if (platform === 'android') return keys.android ?? null;
  return null;
}
