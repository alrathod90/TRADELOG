// api/cron/daily-summary.js — Vercel Cron Job
// Runs automatically at market close (3:30 PM IST) every trading day.
// Fetches each user's open positions from Supabase, gets live prices from
// Yahoo Finance, computes P&L, and sends a Telegram message via the free
// Telegram Bot API (no per-message cost, no DLT registration, no overload issues).
//
// SETUP REQUIRED:
//   1. Create a Telegram bot:
//        a. Open Telegram, search for @BotFather, send /newbot
//        b. Follow the prompts — you get a bot TOKEN like 123456:ABC-DEF...
//   2. Add these to Vercel → Project → Settings → Environment Variables:
//        SUPABASE_URL              (same as VITE_SUPABASE_URL)
//        SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API → service_role key —
//                                    NOT the anon key. Bypasses RLS for server-side reads.)
//        TELEGRAM_BOT_TOKEN        (from @BotFather above)
//        CRON_SECRET               (any random string, to stop public callers hitting this)
//   3. Each user finds their personal chat ID by:
//        a. Searching for the bot by its @username in Telegram and sending it any message
//        b. Visiting https://api.telegram.org/bot<TOKEN>/getUpdates in a browser
//        c. Copying the "id" number under "chat" in the JSON response
//      ...then pasting that chat ID into Alerts → Settings → Daily Telegram Summary.
//   4. vercel.json already has the cron schedule wired in.
//
// Cron runs in UTC. 3:30 PM IST = 10:00 AM UTC. Schedule: "0 10 * * 1-5" (Mon–Fri only).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function pnl(t) {
  const invest = (t.entryPrice || 0) * (t.qty || 0);
  const gross = ((t.exitPrice || 0) - (t.entryPrice || 0)) * (t.qty || 0);
  const net = gross - (t.brokerage || 0);
  return { invest, gross, net };
}

async function getLivePrice(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    const data = await r.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' ? price : null;
  } catch (e) {
    return null;
  }
}

async function sendTelegram(chatId, message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
    const data = await r.json();
    return { ok: r.ok && data.ok === true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function formatSummary(openTrades, prices) {
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const lines = [`📊 *TradeLog — ${dateStr}*`, `_Market close summary_`, ''];
  let totalPnl = 0;

  for (const t of openTrades) {
    const cmp = prices[t.sym];
    if (cmp == null) {
      lines.push(`*${t.sym}*: price unavailable`);
      continue;
    }
    const gross = (cmp - (t.entryPrice || 0)) * (t.qty || 0);
    const net = gross - (t.brokerage || 0);
    totalPnl += net;
    const emoji = net >= 0 ? '🟢' : '🔴';
    const sign = net >= 0 ? '+' : '−';
    lines.push(`${emoji} *${t.sym}*: ${sign}₹${Math.abs(net).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (CMP ₹${cmp.toFixed(2)})`);
  }

  lines.push('');
  const totalSign = totalPnl >= 0 ? '+' : '−';
  const totalEmoji = totalPnl >= 0 ? '🟢' : '🔴';
  lines.push(`${totalEmoji} *Total: ${totalSign}₹${Math.abs(totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}*`);
  lines.push(`_${openTrades.length} open position${openTrades.length !== 1 ? 's' : ''}_`);

  return lines.join('\n');
}

export default async function handler(req, res) {
  // Vercel Cron sends a special header — verify this isn't being called by randoms
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TELEGRAM_BOT_TOKEN) {
    res.status(500).json({ error: 'Missing required environment variables' });
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results = [];

  try {
    // Fetch all users who have a Telegram chat ID saved
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, username, telegram_chat_id')
      .not('telegram_chat_id', 'is', null);

    if (profErr) throw profErr;

    for (const profile of profiles || []) {
      if (!profile.telegram_chat_id) continue;

      // Fetch this user's open trades
      const { data: tradeRows, error: tradeErr } = await supabase
        .from('trades')
        .select('data')
        .eq('user_id', profile.id);

      if (tradeErr) { results.push({ user: profile.username, error: tradeErr.message }); continue; }

      const openTrades = (tradeRows || [])
        .map(r => r.data)
        .filter(t => t && t.status === 'open' && t.sym);

      if (openTrades.length === 0) { results.push({ user: profile.username, skipped: 'no open positions' }); continue; }

      // Fetch live prices for each unique symbol
      const uniqueSymbols = [...new Set(openTrades.map(t => t.sym))];
      const prices = {};
      for (const sym of uniqueSymbols) {
        const ticker = sym + '.NS';
        prices[sym] = await getLivePrice(ticker);
        await new Promise(r => setTimeout(r, 200)); // avoid hammering Yahoo
      }

      const message = formatSummary(openTrades, prices);
      const tgResult = await sendTelegram(profile.telegram_chat_id, message);
      results.push({ user: profile.username, sent: tgResult.ok, detail: tgResult.data || tgResult.error });

      await new Promise(r => setTimeout(r, 300)); // space out sends between users
    }

    res.status(200).json({ ok: true, processed: results.length, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* ════════════════════════════════════════════════════════════════════════
   ONE-TIME SQL — run in Supabase SQL Editor before this cron will work:

   alter table public.profiles add column if not exists telegram_chat_id text;

   -- Users save their chat ID from a new Settings field in the app
   ════════════════════════════════════════════════════════════════════════ */
