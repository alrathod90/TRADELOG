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
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    const d = await r.json();
    const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
    const longName = d?.chart?.result?.[0]?.meta?.longName || d?.chart?.result?.[0]?.meta?.shortName;
    if (price == null) {
      return { ok: false, reason: d?.chart?.error?.description || 'No price in response' };
    }
    return { ok: true, price, longName };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// GET /api/cron/ticker-audit — checks every OPEN position (regardless of
// whether SL/target is set) against Yahoo Finance right now, and reports
// which ones fail to resolve. Read-only, no Telegram side effects unless
// ?notify=1 is passed.
export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const userId = String(process.env.CRON_USER_ID || 'guest').toLowerCase();
    const tradeRows = await sql`SELECT data FROM trades WHERE user_id = ${userId}`;
    const open = tradeRows.map(r => r.data).filter(t => t && t.status === 'open' && t.sym);

    const results = [];
    for (const t of open) {
      const ticker = t.ticker || `${t.sym}.NS`;
      const check = await fetchYFPrice(ticker);
      results.push({
        sym: t.sym,
        ticker,
        hasCustomTicker: !!t.ticker,
        ok: check.ok,
        price: check.ok ? check.price : null,
        yahooName: check.ok ? check.longName : null,
        reason: check.ok ? null : check.reason,
      });
      await new Promise(r => setTimeout(r, 200));
    }

    const broken = results.filter(r => !r.ok);

    if (req.query.notify === '1' && broken.length) {
      const profileRows = await sql`SELECT telegram_chat_id FROM profiles WHERE user_id = ${userId}`;
      const chatId = profileRows[0]?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        const lines = [
          `⚠️ *Ticker Audit — ${broken.length} issue(s) found*`,
          '━━━━━━━━━━━━━━━━━━━',
          '',
          ...broken.map(b => `• *${b.sym}* (\`${b.ticker}\`)\n  ${b.reason}`),
        ];
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown' }),
        });
      }
    }

    return res.status(200).json({
      ok: true,
      totalChecked: results.length,
      brokenCount: broken.length,
      results,
    });
  } catch (e) {
    console.error('ticker-audit error:', e);
    return res.status(500).json({ error: e.message });
  }
}