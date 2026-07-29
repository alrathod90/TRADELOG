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

async function checkNse(base, sym) {
  try {
    const r = await fetch(`${base}/api/nse-quote?symbol=${encodeURIComponent(sym)}`, {
      headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
        ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
        : {},
      signal: AbortSignal.timeout(12000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, reason: d?.error || `HTTP ${r.status}` };
    if (d?.lastPrice == null) return { ok: false, reason: 'No price in response' };
    return { ok: true, price: d.lastPrice, companyName: d.companyName };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// GET /api/cron/ticker-audit — checks every OPEN position against NSE's own
// quote API right now (the same source the cron jobs actually use), and
// reports which ones fail to resolve. Read-only unless ?notify=1 is passed.
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

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = `${proto}://${req.headers.host}`;

    const results = [];
    for (const t of open) {
      const check = await checkNse(base, t.sym);
      results.push({
        sym: t.sym,
        ok: check.ok,
        price: check.ok ? check.price : null,
        nseName: check.ok ? check.companyName : null,
        reason: check.ok ? null : check.reason,
      });
      await new Promise(r => setTimeout(r, 250));
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
          ...broken.map(b => `• *${b.sym}*\n  ${b.reason}`),
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