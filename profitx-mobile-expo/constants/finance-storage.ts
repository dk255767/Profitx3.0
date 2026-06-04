import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserScopedKey } from './app-flow';
import { apiFetch } from './api-client';

export type IncomeRow = {
  id: string;
  date: string;
  cash: string;
  gpay: string;
  malliKadai: string;
  market: string;
};

export type AdditionalRow = {
  id: string;
  date: string;
  egg: string;
  piece: string;
  potato: string;
  gas: string;
  fuel: string;
};

export type FinanceSnapshot = {
  incomeRows: IncomeRow[];
  addRows: AdditionalRow[];
};

export const FINANCE_STORAGE_KEY = 'profitx_finance_snapshot_v1';

const EMPTY_SNAPSHOT: FinanceSnapshot = { incomeRows: [], addRows: [] };

function normalizeSnapshot(value: unknown): FinanceSnapshot {
  if (!value || typeof value !== 'object') return EMPTY_SNAPSHOT;

  const parsed = value as Partial<FinanceSnapshot>;
  const incomeRows = Array.isArray(parsed.incomeRows) ? parsed.incomeRows : [];
  const addRows = Array.isArray(parsed.addRows) ? parsed.addRows : [];

  return {
    incomeRows: incomeRows
      .filter((row): row is IncomeRow => !!row && typeof row === 'object')
      .map((row) => ({
        id: String((row as Partial<IncomeRow>).id ?? ''),
        date: String((row as Partial<IncomeRow>).date ?? ''),
        cash: String((row as Partial<IncomeRow>).cash ?? ''),
        gpay: String((row as Partial<IncomeRow>).gpay ?? ''),
        malliKadai: String((row as Partial<IncomeRow>).malliKadai ?? ''),
        market: String((row as Partial<IncomeRow>).market ?? ''),
      })),
    addRows: addRows
      .filter((row): row is AdditionalRow => !!row && typeof row === 'object')
      .map((row) => ({
        id: String((row as Partial<AdditionalRow>).id ?? ''),
        date: String((row as Partial<AdditionalRow>).date ?? ''),
        egg: String((row as Partial<AdditionalRow>).egg ?? ''),
        piece: String((row as Partial<AdditionalRow>).piece ?? '0'),
        potato: String((row as Partial<AdditionalRow>).potato ?? ''),
        gas: String((row as Partial<AdditionalRow>).gas ?? ''),
        fuel: String((row as Partial<AdditionalRow>).fuel ?? ''),
      })),
  };
}

export async function saveFinanceSnapshot(snapshot: FinanceSnapshot): Promise<void> {
  const normalized = normalizeSnapshot(snapshot);
  const storageKey = await getUserScopedKey(FINANCE_STORAGE_KEY);
  await AsyncStorage.setItem(storageKey, JSON.stringify(normalized));

  try {
    await apiFetch('/data/snapshot', {
      method: 'PUT',
      body: JSON.stringify(normalized),
    });
  } catch {
    // Keep local persistence even if server sync fails.
  }
}

export async function loadFinanceSnapshot(): Promise<FinanceSnapshot> {
  const storageKey = await getUserScopedKey(FINANCE_STORAGE_KEY);

  try {
    const response = await apiFetch('/data/snapshot');
    if (response.ok) {
      const payload = await response.json();
      const normalized = normalizeSnapshot(payload);
      await AsyncStorage.setItem(storageKey, JSON.stringify(normalized));
      return normalized;
    }
  } catch {
    // Fall back to local cache when backend is unavailable.
  }

  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) {
    return EMPTY_SNAPSHOT;
  }

  try {
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return EMPTY_SNAPSHOT;
  }
}
