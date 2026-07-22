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
  if (process.env.CRON_SECRET) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const userId = String(process.env.CRON_USER_ID || 'guest').toLowerCase();

    const tradeRows = await sql`SELECT data FROM trades WHERE user_id = ${userId}`;
    const open = tradeRows
      .map(r => r.data)
      .filter(t => t && t.status === 'open' && t.sym && (t.sl || t.target));

    if (!open.length) {
      return res.status(200).json({ ok: true, checked: 0, alertsSent: 0, note: 'no open positions with SL/target set' });
    }

    const profileRows = await sql`SELECT telegram_chat_id FROM profiles WHERE user_id = ${userId}`;
    const chatId = profileRows[0]?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      return res.status(200).json({ ok: true, skipped: 'no chat id configured' });
    }

    let checked = 0;
    let alertsSent = 0;

    for (const t of open) {
      const ticker = t.ticker || `${t.sym}.NS`;
      const price = await fetchYFPrice(ticker);
      if (price == null) { await new Promise(r => setTimeout(r, 150)); continue; }
      checked++;

      const hits = [];
      if (t.sl) {
        const slVal = Number(t.sl);
        const slHit = t.dir === 'BUY' ? price <= slVal : price >= slVal;
        if (slHit) hits.push({ type: 'sl', value: slVal, label: 'Stop Loss', emoji: '🛑' });
      }
      if (t.target) {
        const tgtVal = Number(t.target);
        const tgtHit = t.dir === 'BUY' ? price >= tgtVal : price <= tgtVal;
        if (tgtHit) hits.push({ type: 'target', value: tgtVal, label: 'Target', emoji: '🎯' });
      }

      for (const hit of hits) {
        const tradeId = String(t.id);
        const already = await sql`
          SELECT 1 FROM level_alerts_sent
          WHERE user_id = ${userId} AND trade_id = ${tradeId}
            AND level_type = ${hit.type} AND level_value = ${hit.value}
        `;
        if (already.length) continue; // already alerted for this exact level

        const gross = t.dir === 'BUY' ? (price - t.entryPrice) * t.qty : (t.entryPrice - price) * t.qty;
        const net = gross - (t.brokerage || 0);
        const action = hit.type === 'sl' ? 'Consider exiting to limit further loss.' : 'Consider booking profits.';

        const message = [
          `${hit.emoji} *${hit.label} Hit — ${t.sym}*`,
          '',
          `Entry ₹${t.entryPrice} · ${hit.label} ₹${hit.value}`,
          `LTP ₹${price.toFixed(2)} · ${net >= 0 ? '+' : '−'}₹${Math.abs(net).toFixed(0)}`,
          '',
          action,
        ].join('\n');

        try {
          await sendTelegram(chatId, message);
          alertsSent++;
          await sql`
            INSERT INTO level_alerts_sent (user_id, trade_id, level_type, level_value)
            VALUES (${userId}, ${tradeId}, ${hit.type}, ${hit.value})
            ON CONFLICT (user_id, trade_id, level_type, level_value) DO NOTHING
          `;
          await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
          console.error('price-alerts: telegram send failed:', e.message);
          // don't record as sent — retry next run
        }
      }

      await new Promise(r => setTimeout(r, 200)); // avoid Yahoo rate limiting
    }

    return res.status(200).json({ ok: true, checked, alertsSent });
  } catch (e) {
    console.error('price-alerts cron error:', e);
    return res.status(500).json({ error: e.message });
  }
}