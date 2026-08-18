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

// ── API base — mirrors the IS_CAPACITOR/IS_DEV detection used in App.jsx ─────
// Native app builds need the full Vercel URL since relative paths don't resolve.
const IS_CAPACITOR = typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:');
const API_BASE = IS_CAPACITOR
  ? (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '')
  : '';

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

export async function canUseSupabaseAuth() {
  return false;
}

// ── Trades — now synced to Neon via /api/trades, with localStorage as an
//    offline-safe fallback/cache so the app still works if the API is down ──
export async function sbFetchTrades(userId) {
  try {
    const r = await fetch(`${API_BASE}/api/trades?userId=${encodeURIComponent(userId)}`);
    if (r.ok) {
      const data = await r.json();
      writeJson(storageKey(userId, 'trades'), data); // keep local cache in sync
      return Array.isArray(data) ? data : [];
    }
  } catch (error) {
    console.warn('[TradeLog] Cloud fetch failed, using local cache', error);
  }
  const data = readJson(storageKey(userId, 'trades'), []);
  return Array.isArray(data) ? data : [];
}

export async function sbSaveTrade(userId, trade) {
  // Optimistic local update first — UI never blocks on network
  const trades = readJson(storageKey(userId, 'trades'), []);
  const index = trades.findIndex((item) => item.id === trade.id);
  if (index >= 0) trades[index] = trade; else trades.unshift(trade);
  writeJson(storageKey(userId, 'trades'), trades);

  try {
    await fetch(`${API_BASE}/api/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, trade }),
    });
  } catch (error) {
    console.warn('[TradeLog] Cloud save failed, saved locally only', error);
  }
}

export async function sbDeleteTrade(userId, tradeId) {
  const trades = readJson(storageKey(userId, 'trades'), []);
  writeJson(storageKey(userId, 'trades'), trades.filter((item) => item.id !== tradeId));

  try {
    await fetch(`${API_BASE}/api/trades?userId=${encodeURIComponent(userId)}&tradeId=${encodeURIComponent(tradeId)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.warn('[TradeLog] Cloud delete failed', error);
  }
}

export async function sbSaveAllTrades(userId, trades) {
  writeJson(storageKey(userId, 'trades'), Array.isArray(trades) ? trades : []);
  try {
    await fetch(`${API_BASE}/api/trades`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, trades }),
    });
  } catch (error) {
    console.warn('[TradeLog] Cloud bulk save failed', error);
  }
}

// ── Telegram chat ID — real cloud storage so the cron job can read it ────────
// (This is new: it didn't persist anywhere before, since it was gated behind
// isSupabaseConfigured, which was always false.)
export async function sbFetchTelegramChatId(userId) {
  try {
    const r = await fetch(`${API_BASE}/api/profile?userId=${encodeURIComponent(userId)}`);
    if (r.ok) {
      const data = await r.json();
      return data.telegram_chat_id || '';
    }
  } catch (error) {
    console.warn('[TradeLog] Fetch telegram chat id failed', error);
  }
  return '';
}

export async function sbSaveTelegramChatId(userId, chatId) {
  try {
    const r = await fetch(`${API_BASE}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, telegram_chat_id: chatId }),
    });
    return r.ok;
  } catch (error) {
    console.warn('[TradeLog] Save telegram chat id failed', error);
    return false;
  }
}

// ── Goals — enhanced version, local-only (localStorage) ─────────────────────
// Supports multiple goals with measurements, milestones, reminders
// Format: { goalsArray: [{id, name, goalType, measurements: [], ...}], ...}
export async function sbFetchGoalsArray(userId) {
  const data = readJson(storageKey(userId, 'goals_v2'), {});
  return Array.isArray(data.goalsArray) ? data.goalsArray : [];
}

export async function sbFetchGoal(userId, goalId) {
  const goals = await sbFetchGoalsArray(userId);
  return goals.find(g => g.id === goalId) || null;
}

export async function sbSaveGoal(userId, goal) {
  const goals = await sbFetchGoalsArray(userId);
  const index = goals.findIndex(g => g.id === goal.id);
  if (index >= 0) {
    goals[index] = { ...goals[index], ...goal, updatedAt: new Date().toISOString() };
  } else {
    goals.unshift({
      ...goal,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  const data = readJson(storageKey(userId, 'goals_v2'), {});
  data.goalsArray = goals;
  writeJson(storageKey(userId, 'goals_v2'), data);
}

export async function sbDeleteGoal(userId, goalId) {
  const data = readJson(storageKey(userId, 'goals_v2'), {});
  data.goalsArray = (data.goalsArray || []).filter(g => g.id !== goalId);
  writeJson(storageKey(userId, 'goals_v2'), data);
}

export async function sbAddMeasurement(userId, goalId, measurement) {
  const goal = await sbFetchGoal(userId, goalId);
  if (!goal) return;
  
  goal.measurements = goal.measurements || [];
  goal.measurements.push({
    ...measurement,
    id: Date.now().toString(),
    date: measurement.date || new Date().toISOString(),
  });
  
  await sbSaveGoal(userId, goal);
}

export async function sbDeleteMeasurement(userId, goalId, measurementId) {
  const goal = await sbFetchGoal(userId, goalId);
  if (!goal) return;
  
  goal.measurements = (goal.measurements || []).filter(m => m.id !== measurementId);
  await sbSaveGoal(userId, goal);
}

export async function sbSaveMilestone(userId, goalId, milestone) {
  const goal = await sbFetchGoal(userId, goalId);
  if (!goal) return;
  
  goal.milestones = goal.milestones || [];
  const index = goal.milestones.findIndex(m => m.id === milestone.id);
  
  if (index >= 0) {
    goal.milestones[index] = milestone;
  } else {
    goal.milestones.push({
      ...milestone,
      id: milestone.id || Date.now().toString(),
    });
  }
  
  await sbSaveGoal(userId, goal);
}

export async function sbDeleteMilestone(userId, goalId, milestoneId) {
  const goal = await sbFetchGoal(userId, goalId);
  if (!goal) return;
  
  goal.milestones = (goal.milestones || []).filter(m => m.id !== milestoneId);
  await sbSaveGoal(userId, goal);
}

export async function sbSaveReminder(userId, goalId, reminder) {
  const goal = await sbFetchGoal(userId, goalId);
  if (!goal) return;
  
  goal.reminders = goal.reminders || [];
  const index = goal.reminders.findIndex(r => r.id === reminder.id);
  
  if (index >= 0) {
    goal.reminders[index] = reminder;
  } else {
    goal.reminders.push({
      ...reminder,
      id: reminder.id || Date.now().toString(),
      enabled: reminder.enabled !== false,
    });
  }
  
  await sbSaveGoal(userId, goal);
}

export async function sbDeleteReminder(userId, goalId, reminderId) {
  const goal = await sbFetchGoal(userId, goalId);
  if (!goal) return;
  
  goal.reminders = (goal.reminders || []).filter(r => r.id !== reminderId);
  await sbSaveGoal(userId, goal);
}

// Legacy: keep old functions for backward compatibility
export async function sbFetchGoals(userId) {
  // Old format: simple goals object with specific fields
  const data = readJson(storageKey(userId, 'goals'), null);
  return data || { monthlyPnl: 0, yearlyPnl: 0, maxTradesDay: 0, maxLossDay: 0, winRateTarget: 0 };
}

export async function sbSaveGoals(userId, goals) {
  // Old format: save simple goals object
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

// ── Announcements — fetched from /api/announcements, cached locally ─────
export async function sbFetchAnnouncements(userId, filters = {}) {
  try {
    // Fetch from API with optional filters (symbol, category, impactLevel, sentiment)
    const params = new URLSearchParams({ userId, ...filters });
    const r = await fetch(`${API_BASE}/api/announcements?${params}`);
    if (r.ok) {
      const payload = await r.json();
      const data = Array.isArray(payload) ? payload : (payload.announcements || []);
      writeJson(storageKey(userId, 'announcements'), data); // cache locally
      return data;
    }
  } catch (error) {
    console.warn('[TradeLog] Announcements fetch failed, using local cache', error);
  }
  const data = readJson(storageKey(userId, 'announcements'), []);
  return Array.isArray(data) ? data : [];
}

export async function sbFetchAnnouncementsBySymbol(userId, symbol) {
  return sbFetchAnnouncements(userId, { symbol });
}

export async function sbFetchAnnouncementsByCategory(userId, category) {
  return sbFetchAnnouncements(userId, { category });
}

export async function sbFetchAnnouncementsByImpact(userId, impactLevel) {
  return sbFetchAnnouncements(userId, { impactLevel });
}

export async function sbSaveAnnouncement(userId, announcement) {
  try {
    const r = await fetch(`${API_BASE}/api/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, announcement }),
    });
    if (r.ok) {
      const data = await r.json();
      // Update local cache
      const announcements = readJson(storageKey(userId, 'announcements'), []);
      const index = announcements.findIndex(a => a.id === data.id);
      if (index >= 0) announcements[index] = data;
      else announcements.unshift(data);
      writeJson(storageKey(userId, 'announcements'), announcements);
      return data;
    }
  } catch (error) {
    console.warn('[TradeLog] Could not save announcement to cloud', error);
  }
  // Fallback: save to local cache only
  const announcements = readJson(storageKey(userId, 'announcements'), []);
  const index = announcements.findIndex(a => a.id === announcement.id);
  if (index >= 0) announcements[index] = announcement;
  else announcements.unshift(announcement);
  writeJson(storageKey(userId, 'announcements'), announcements);
  return announcement;
}

export async function sbDeleteAnnouncement(userId, announcementId) {
  try {
    await fetch(`${API_BASE}/api/announcements/${announcementId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  } catch (error) {
    console.warn('[TradeLog] Could not delete announcement from cloud', error);
  }
  // Update local cache
  const announcements = readJson(storageKey(userId, 'announcements'), []);
  writeJson(storageKey(userId, 'announcements'), announcements.filter(a => a.id !== announcementId));
}