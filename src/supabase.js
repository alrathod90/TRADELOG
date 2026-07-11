const STORAGE_PREFIX = 'tradelog_local_v1';
const memoryStorage = new Map();

function getStorage() {
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }

  return {
    getItem(key) {
      return memoryStorage.has(key) ? memoryStorage.get(key) : null;
    },
    setItem(key, value) {
      memoryStorage.set(key, String(value));
    },
    removeItem(key) {
      memoryStorage.delete(key);
    },
    clear() {
      memoryStorage.clear();
    },
  };
}

function storageKey(userId, suffix) {
  const safeId = String(userId || 'guest').trim().toLowerCase();
  return `${STORAGE_PREFIX}_${safeId}_${suffix}`;
}

function readJson(key, fallback) {
  try {
    const raw = getStorage().getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[TradeLog] Could not read storage key ${key}`, error);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    getStorage().setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[TradeLog] Could not write storage key ${key}`, error);
  }
}

export function resolveSupabaseConfig() {
  return {
    isConfigured: false,
    normalizedUrl: '',
    anonKey: '',
    reason: 'local-only',
  };
}

export const supabase = null;
export const isSupabaseConfigured = false;

const supabaseAvailability = {
  checked: true,
  available: false,
  reason: 'local-only',
};

export async function canUseSupabaseAuth() {
  return supabaseAvailability.available;
}

export async function sbFetchTrades(userId) {
  const data = readJson(storageKey(userId, 'trades'), []);
  return Array.isArray(data) ? data : [];
}

export async function sbSaveTrade(userId, trade) {
  const trades = await sbFetchTrades(userId);
  const index = trades.findIndex((item) => item.id === trade.id);
  if (index >= 0) {
    trades[index] = trade;
  } else {
    trades.unshift(trade);
  }
  writeJson(storageKey(userId, 'trades'), trades);
}

export async function sbDeleteTrade(userId, tradeId) {
  const trades = await sbFetchTrades(userId);
  writeJson(storageKey(userId, 'trades'), trades.filter((item) => item.id !== tradeId));
}

export async function sbSaveAllTrades(userId, trades) {
  writeJson(storageKey(userId, 'trades'), Array.isArray(trades) ? trades : []);
}

export async function sbFetchGoals(userId) {
  return readJson(storageKey(userId, 'goals'), null);
}

export async function sbSaveGoals(userId, goals) {
  writeJson(storageKey(userId, 'goals'), goals);
}

export async function sbFetchJournal(userId) {
  const data = readJson(storageKey(userId, 'journal'), {});
  return data && typeof data === 'object' ? data : {};
}

export async function sbSaveJournalEntry(userId, date, entry) {
  const journal = await sbFetchJournal(userId);
  journal[date] = entry;
  writeJson(storageKey(userId, 'journal'), journal);
}

export async function sbFetchNotes(userId) {
  const data = readJson(storageKey(userId, 'notes'), []);
  return Array.isArray(data) ? data : [];
}

export async function sbSaveNote(userId, note) {
  const notes = await sbFetchNotes(userId);
  const index = notes.findIndex((item) => item.id === note.id);
  if (index >= 0) {
    notes[index] = note;
  } else {
    notes.unshift(note);
  }
  writeJson(storageKey(userId, 'notes'), notes);
}

export async function sbDeleteNote(userId, noteId) {
  const notes = await sbFetchNotes(userId);
  writeJson(storageKey(userId, 'notes'), notes.filter((item) => item.id !== noteId));
}

export async function sbFetchWatchlist(userId) {
  const data = readJson(storageKey(userId, 'watchlist'), []);
  return Array.isArray(data) ? data : [];
}

export async function sbSaveWatchlistItem(userId, item) {
  const watchlist = await sbFetchWatchlist(userId);
  const index = watchlist.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    watchlist[index] = item;
  } else {
    watchlist.unshift(item);
  }
  writeJson(storageKey(userId, 'watchlist'), watchlist);
}

export async function sbDeleteWatchlistItem(userId, itemId) {
  const watchlist = await sbFetchWatchlist(userId);
  writeJson(storageKey(userId, 'watchlist'), watchlist.filter((entry) => entry.id !== itemId));
}
