import { createClient } from '@supabase/supabase-js';

// Set these in your .env file:
//   VITE_SUPABASE_URL=ttps://ngletsjgslxrjvcrytbj.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGci...
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL  || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[TradeLog] Supabase not configured. Add VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY to your .env file. Falling back to localStorage.'
  );
}

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
