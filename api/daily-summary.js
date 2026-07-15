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

    if (!open.length) {
      await sendTelegram(chatId, '📊 *TradeLog Daily Summary*\n\nNo open positions today.');
      return res.status(200).json({ ok: true, positions: 0 });
    }

    let totalNet = 0;
    const lines = [];
    for (const t of open) {
      const ticker = t.ticker || `${t.sym}.NS`;
      const price = await fetchYFPrice(ticker);
      let line = `*${t.sym}* — Entry ₹${t.entryPrice} × ${t.qty}`;
      if (price != null) {
        const gross = t.dir === 'BUY' ? (price - t.entryPrice) * t.qty : (t.entryPrice - price) * t.qty;
        const net = gross - (t.brokerage || 0);
        totalNet += net;
        const pct = t.entryPrice ? (net / (t.entryPrice * t.qty)) * 100 : 0;
        line += `\n  LTP ₹${price.toFixed(2)} · ${net >= 0 ? '+' : '−'}₹${Math.abs(net).toFixed(0)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
      } else {
        line += `\n  LTP unavailable`;
      }
      lines.push(line);
      await new Promise(r => setTimeout(r, 250)); // avoid Yahoo rate limiting
    }

    const dateStr = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    });
    const header = `📊 *TradeLog Daily Summary* — ${dateStr}\n\n`;
    const footer = `\n\n*Total Unrealized P&L: ${totalNet >= 0 ? '+' : '−'}₹${Math.abs(totalNet).toFixed(0)}*`;
    const message = header + lines.join('\n\n') + footer;

    await sendTelegram(chatId, message);
    return res.status(200).json({ ok: true, positions: open.length, totalNet });
  } catch (e) {
    console.error('daily-summary cron error:', e);
    return res.status(500).json({ error: e.message });
  }
}