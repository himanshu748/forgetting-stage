type EventValue = string | number | boolean;
type EventProperties = Record<string, EventValue>;

type LayersSdk = {
  init(): Promise<void>;
  track(eventName: string, properties?: EventProperties): void;
  getFeatureFlag(flagKey: string): unknown;
};

type LayersModule = {
  LayersReactNative: new (config: {
    appId: string;
    environment: 'production';
    enableDebug: boolean;
  }) => LayersSdk;
};

export type GrowthEvent =
  | 'performance_started'
  | 'memory_seed_forgotten'
  | 'performance_completed'
  | 'daily_reminder_enabled'
  | 'paywall_opened'
  | 'purchase_completed'
  | 'purchase_restored';

export type LayersClient = {
  initialize(): Promise<boolean>;
  track(event: GrowthEvent, properties?: EventProperties): Promise<void>;
  reminderVariant(): Promise<ReminderVariant>;
};

export type ReminderVariant = 'free_show' | 'curiosity';

export type LayersClientOptions = {
  platform: string;
  appId?: string;
  debug?: boolean;
  loadSdk?: () => Promise<LayersModule>;
};

export function createLayersClient(options: LayersClientOptions): LayersClient {
  const native = options.platform === 'android' || options.platform === 'ios';
  const appId = options.appId?.trim() ?? '';
  const configured = native && appId.length > 0 && appId.length <= 128;
  const loadSdk = options.loadSdk ?? (() => import('@layers/expo'));
  let sdk: LayersSdk | null = null;
  let initialization: Promise<boolean> | null = null;

  const initialize = (): Promise<boolean> => {
    if (!configured) return Promise.resolve(false);
    if (initialization) return initialization;
    initialization = (async () => {
      try {
        const module = await loadSdk();
        sdk = new module.LayersReactNative({
          appId,
          environment: 'production',
          enableDebug: options.debug ?? false,
        });
        await sdk.init();
        return true;
      } catch {
        sdk = null;
        initialization = null;
        return false;
      }
    })();
    return initialization;
  };

  return {
    initialize,
    async track(event, properties) {
      if (!await initialize() || !sdk) return;
      try {
        sdk.track(event, properties);
      } catch {
        // Analytics can never interrupt a performance or purchase flow.
      }
    },
    async reminderVariant() {
      if (!await initialize() || !sdk) return 'free_show';
      try {
        return sdk.getFeatureFlag('curtain_reminder_copy') === 'curiosity'
          ? 'curiosity'
          : 'free_show';
      } catch {
        return 'free_show';
      }
    },
  };
}
