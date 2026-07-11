import { beforeEach, describe, expect, it } from 'vitest';
import { resolveSupabaseConfig, sbFetchTrades, sbSaveTrade, sbFetchGoals, sbSaveGoals } from './supabase.js';

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe('resolveSupabaseConfig', () => {
  it('keeps the app in local-only mode without Supabase configuration', () => {
    const result = resolveSupabaseConfig('https://demo.supabase.co', 'demo-key');

    expect(result).toMatchObject({ isConfigured: false, reason: 'local-only' });
  });
});

describe('local persistence helpers', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      writable: true,
      value: createLocalStorageMock(),
    });
    localStorage.clear();
  });

  it('persists trades for a specific user locally', async () => {
    const trade = { id: 'trade-1', sym: 'RELIANCE', entryPrice: 100, qty: 1, status: 'open' };

    await sbSaveTrade('alice', trade);

    expect(await sbFetchTrades('alice')).toEqual([trade]);
    expect(await sbFetchTrades('bob')).toEqual([]);
  });

  it('stores goals per user without requiring a remote database', async () => {
    const goals = { monthlyTarget: 1000, riskPerTrade: 2 };

    await sbSaveGoals('alice', goals);

    expect(await sbFetchGoals('alice')).toEqual(goals);
    expect(await sbFetchGoals('bob')).toEqual(null);
  });
});
