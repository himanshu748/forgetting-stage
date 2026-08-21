type OneSignalSdk = typeof import('react-native-onesignal');

export type ReminderPermission = 'unavailable' | 'ready' | 'enabled' | 'denied' | 'error';

export type OneSignalClient = {
  initialize(): Promise<boolean>;
  enableDailyReminder(premiseId: string): Promise<ReminderPermission>;
  trackPerformanceCompleted(details: {
    premiseId: string;
    forgottenCount: number;
  }): Promise<void>;
};

export type OneSignalClientOptions = {
  platform: string;
  appId?: string;
  loadSdk?: () => Promise<OneSignalSdk>;
};

const APP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createOneSignalClient(options: OneSignalClientOptions): OneSignalClient {
  let sdk: OneSignalSdk | null = null;
  let initialized = false;
  const native = options.platform === 'android' || options.platform === 'ios';
  const configured = native && APP_ID.test(options.appId?.trim() ?? '');
  const loadSdk = options.loadSdk ?? (() => import('react-native-onesignal'));

  const initialize = async () => {
    if (!configured) return false;
    if (initialized) return true;
    try {
      sdk = await loadSdk();
      sdk.OneSignal.initialize(options.appId!.trim());
      initialized = true;
      return true;
    } catch {
      sdk = null;
      initialized = false;
      return false;
    }
  };

  return {
    initialize,
    async enableDailyReminder(premiseId) {
      if (!await initialize() || !sdk) return 'unavailable';
      try {
        const granted = await sdk.OneSignal.Notifications.requestPermission(true);
        if (!granted) return 'denied';
        sdk.OneSignal.User.addTags({
          daily_curtain: 'enabled',
          last_premise: premiseId,
        });
        return 'enabled';
      } catch {
        return 'error';
      }
    },
    async trackPerformanceCompleted({ premiseId, forgottenCount }) {
      if (!await initialize() || !sdk) return;
      try {
        sdk.OneSignal.User.trackEvent('performance_completed', {
          premise_id: premiseId,
          forgotten_count: forgottenCount,
        });
      } catch {
        // Retention telemetry can never interrupt the curtain flow.
      }
    },
  };
}
