import { createClient } from '@supabase/supabase-js';

export function resolveSupabaseConfig(url = '', anonKey = '') {
  const trimmedUrl = (url || '').trim();
  const trimmedKey = (anonKey || '').trim();

  if (!trimmedUrl || !trimmedKey) {
    return { isConfigured: false, normalizedUrl: '', anonKey: '', reason: 'missing' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return { isConfigured: false, normalizedUrl: '', anonKey: '', reason: 'invalid-url' };
  }

  if (parsedUrl.protocol !== 'https:') {
    return { isConfigured: false, normalizedUrl: '', anonKey: '', reason: 'non-https' };
  }

  if (!parsedUrl.hostname.endsWith('.supabase.co')) {
    return { isConfigured: false, normalizedUrl: '', anonKey: '', reason: 'invalid-host' };
  }

  if (trimmedKey.length < 10 || trimmedKey.includes(' ')) {
    return { isConfigured: false, normalizedUrl: '', anonKey: '', reason: 'invalid-key' };
  }

  return {
    isConfigured: true,
    normalizedUrl: `${parsedUrl.protocol}//${parsedUrl.host}`,
    anonKey: trimmedKey,
    reason: null,
  };
}

const config = resolveSupabaseConfig(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

if (!config.isConfigured) {
  console.warn(
    '[TradeLog] Supabase is not fully configured. Falling back to local storage.',
    config.reason
  );
}

export const supabase = config.isConfigured
  ? createClient(config.normalizedUrl, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isSupabaseConfigured = config.isConfigured;

const supabaseAvailability = {
  checked: false,
  available: false,
  reason: null,
};

export async function canUseSupabaseAuth() {
  if (!config.isConfigured || !supabase) {
    supabaseAvailability.checked = true;
    supabaseAvailability.available = false;
    supabaseAvailability.reason = 'not-configured';
    return false;
  }

  if (supabaseAvailability.checked) {
    return supabaseAvailability.available;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${config.normalizedUrl}/auth/v1/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        apikey: config.anonKey,
      },
    });

    supabaseAvailability.available = response.ok;
    supabaseAvailability.reason = response.ok ? null : `status:${response.status}`;
  } catch (error) {
    supabaseAvailability.available = false;
    supabaseAvailability.reason = error?.name === 'AbortError' ? 'timeout' : 'network';
  } finally {
    clearTimeout(timeoutId);
    supabaseAvailability.checked = true;
  }

  return supabaseAvailability.available;
}
