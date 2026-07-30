import { neon } from '@neondatabase/serverless';

let _sql = null;
function sql(strings, ...values) {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set in Vercel environment variables');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql(strings, ...values);
}

async function fetchYFPrice(ticker) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch (e) {
    return null;
  }
}

async function sendTelegram(chatId, text) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Telegram send failed: ${r.status} ${body}`);
  }
}

const inr = (n) => `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const signed = (n) => (n >= 0 ? '+' : '−');
const DIVIDER = '━━━━━━━━━━━━━━━━━━━';

function buildSummaryMessage(open, priceMap, dateStr) {
  const rows = open.map(t => {
    const price = priceMap[t.sym];
    if (price == null) return { t, price: null, net: null, pct: null };
    const gross = t.dir === 'BUY' ? (price - t.entryPrice) * t.qty : (t.entryPrice - price) * t.qty;
    const net = gross - (t.brokerage || 0);
    const pct = t.entryPrice ? (net / (t.entryPrice * t.qty)) * 100 : 0;
    return { t, price, net, pct };
  });

  const priced = rows.filter(r => r.price != null).sort((a, b) => b.net - a.net);
  const unpriced = rows.filter(r => r.price == null);

  const totalNet = priced.reduce((s, r) => s + r.net, 0);
  const totalInvested = priced.reduce((s, r) => s + r.t.entryPrice * r.t.qty, 0);
  const totalPct = totalInvested ? (totalNet / totalInvested) * 100 : 0;
  const winners = priced.filter(r => r.net >= 0).length;
  const losers = priced.filter(r => r.net < 0).length;

  const lines = [];
  lines.push(`📊 *TradeLog Daily Summary*`);
  lines.push(`📅 ${dateStr}`);
  lines.push('');
  lines.push(DIVIDER);
  lines.push(`💼 *Portfolio Overview*`);
  lines.push(DIVIDER);
  lines.push(`Open Positions: *${open.length}*   🟢 ${winners}   🔴 ${losers}`);
  lines.push('');
  lines.push(`*Total Unrealized P&L*`);
  lines.push(`${totalNet >= 0 ? '🟢' : '🔴'} ${signed(totalNet)}${inr(totalNet)}  (${signed(totalPct)}${Math.abs(totalPct).toFixed(2)}%)`);
  lines.push('');
  lines.push(DIVIDER);
  lines.push(`📈 *Positions*`);
  lines.push(DIVIDER);

  priced.forEach(r => {
    const dot = r.net >= 0 ? '🟢' : '🔴';
    lines.push('');
    lines.push(`${dot} *${r.t.sym}*`);
    lines.push(`   Entry ₹${r.t.entryPrice.toLocaleString('en-IN')} × ${r.t.qty}`);
    lines.push(`   LTP ₹${r.price.toFixed(2)}`);
    lines.push(`   P&L: ${signed(r.net)}${inr(r.net)}  (${signed(r.pct)}${Math.abs(r.pct).toFixed(2)}%)`);
  });

  unpriced.forEach(r => {
    lines.push('');
    lines.push(`⚪ *${r.t.sym}*`);
    lines.push(`   Entry ₹${r.t.entryPrice.toLocaleString('en-IN')} × ${r.t.qty}`);
    lines.push(`   LTP unavailable`);
  });

  if (priced.length >= 2) {
    const best = priced[0];
    const worst = priced[priced.length - 1];
    lines.push('');
    lines.push(DIVIDER);
    lines.push(`🏆 Best: *${best.t.sym}*  ${signed(best.net)}${inr(best.net)}`);
    lines.push(`📉 Worst: *${worst.t.sym}*  ${signed(worst.net)}${inr(worst.net)}`);
  }

  return lines.join('\n');
}

export default async function handler(req, res) {
  // Optional but recommended: protect this endpoint so randoms can't trigger it.
  // Set CRON_SECRET in Vercel env vars, and Vercel automatically sends it as a
  // Bearer token when it invokes cron jobs.
  if (process.env.CRON_SECRET) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    // Single-user app — CRON_USER_ID should match your login username exactly
    // (this is what gets used as the storage key elsewhere in the app).
    const userId = String(process.env.CRON_USER_ID || 'guest').toLowerCase();

    const rows = await sql`SELECT data FROM trades WHERE user_id = ${userId}`;
    const open = rows.map(r => r.data).filter(t => t && t.status === 'open' && t.sym);

    const profileRows = await sql`SELECT telegram_chat_id FROM profiles WHERE user_id = ${userId}`;
    const chatId = profileRows[0]?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

    if (!chatId) {
      console.warn('daily-summary: no Telegram chat ID configured — skipping');
      return res.status(200).json({ ok: true, skipped: 'no chat id configured' });
    }

    const dateStr = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    });

    if (!open.length) {
      await sendTelegram(chatId, `📊 *TradeLog Daily Summary*\n📅 ${dateStr}\n\nNo open positions today.`);
      return res.status(200).json({ ok: true, positions: 0 });
    }

    const priceMap = {};
    for (const t of open) {
      const ticker = t.ticker || `${t.sym}.NS`;
      priceMap[t.sym] = await fetchYFPrice(ticker);
      await new Promise(r => setTimeout(r, 250)); // avoid Yahoo rate limiting
    }

    const message = buildSummaryMessage(open, priceMap, dateStr);
    await sendTelegram(chatId, message);

    const totalNet = open.reduce((s, t) => {
      const price = priceMap[t.sym];
      if (price == null) return s;
      const gross = t.dir === 'BUY' ? (price - t.entryPrice) * t.qty : (t.entryPrice - price) * t.qty;
      return s + (gross - (t.brokerage || 0));
    }, 0);

    return res.status(200).json({ ok: true, positions: open.length, totalNet });
  } catch (e) {
    console.error('daily-summary cron error:', e);
    return res.status(500).json({ error: e.message });
  }
}