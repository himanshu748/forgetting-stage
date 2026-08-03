import type { DailyPassLedger } from './daily-pass.ts';

const LEDGER_KEY = 'forgetting-stage.daily-pass.v1';

export type LedgerStorage = {
  load(): Promise<DailyPassLedger | null>;
  save(ledger: DailyPassLedger): Promise<void>;
};

type AsyncStorageModule = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export function createLedgerStorage(loadStorage: () => Promise<{ default?: AsyncStorageModule } | AsyncStorageModule>): LedgerStorage {
  let memory: DailyPassLedger | null = null;

  async function nativeStorage(): Promise<AsyncStorageModule | null> {
    try {
      const module = await loadStorage();
      return 'default' in module && module.default ? module.default : module as AsyncStorageModule;
    } catch {
      return null;
    }
  }

  return {
    async load() {
      const storage = await nativeStorage();
      if (!storage) return memory;
      const raw = await storage.getItem(LEDGER_KEY);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as DailyPassLedger;
        const lastSeenValid = parsed.lastSeenAt === undefined || typeof parsed.lastSeenAt === 'string';
        return typeof parsed.dayKey === 'string' && Number.isFinite(parsed.used) && lastSeenValid ? parsed : null;
      } catch {
        return null;
      }
    },

    async save(ledger) {
      memory = ledger;
      const storage = await nativeStorage();
      if (storage) await storage.setItem(LEDGER_KEY, JSON.stringify(ledger));
    },
  };
}
