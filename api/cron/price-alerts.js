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

async function fetchNsePrice(base, sym) {
  try {
    const r = await fetch(`${base}/api/nse-quote?symbol=${encodeURIComponent(sym)}`, {
      headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
        ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
        : {},
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      return { price: null, reason: body?.error || `HTTP ${r.status}`, transient: body?.transient !== false };
    }
    const d = await r.json();
    return { price: d?.lastPrice ?? null, reason: d?.lastPrice == null ? 'No price in response' : null, transient: true };
  } catch (e) {
    return { price: null, reason: e.message, transient: true };
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
    const unresolved = [];
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = `${proto}://${req.headers.host}`;

    for (const t of open) {
      const { price, reason, transient } = await fetchNsePrice(base, t.sym);
      if (price == null) {
        unresolved.push({ sym: t.sym, reason, transient });
        await new Promise(r => setTimeout(r, 150));
        continue;
      }
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
        const pct = t.entryPrice ? (net / (t.entryPrice * t.qty)) * 100 : 0;
        const action = hit.type === 'sl' ? 'Consider exiting to limit further loss.' : 'Consider booking profits.';
        const levelLabel = hit.type === 'sl' ? 'Stop Loss' : 'Target';

        const message = [
          `${hit.emoji} *${levelLabel} Hit — ${t.sym}*`,
          '━━━━━━━━━━━━━━━━━━━',
          '',
          '```',
          `Entry     ₹${t.entryPrice.toLocaleString('en-IN')} x ${t.qty}`,
          `${levelLabel.padEnd(9)} ₹${hit.value.toLocaleString('en-IN')}`,
          `LTP       ₹${price.toFixed(2)}`,
          '```',
          '',
          `${net >= 0 ? '🟢' : '🔴'} P&L: ${net >= 0 ? '+' : '−'}₹${Math.abs(net).toLocaleString('en-IN', { maximumFractionDigits: 0 })}  (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`,
          '',
          `💡 ${action}`,
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

      await new Promise(r => setTimeout(r, 200)); // avoid NSE rate limiting
    }

    // Surface REAL price-resolution failures (symbol genuinely not found on
    // NSE — e.g. renamed after a demerger) instead of letting them fail
    // silently forever. Transient NSE rate-limiting/blocks are deliberately
    // NOT alerted on here — they typically self-heal on the very next
    // 15-minute run, and nse-quote.js already retries once internally.
    const realIssues = unresolved.filter(u => u.transient === false);
    if (realIssues.length) {
      const today = new Date().toISOString().slice(0, 10);
      for (const u of realIssues) {
        const already = await sql`
          SELECT 1 FROM ticker_issue_alerts
          WHERE user_id = ${userId} AND sym = ${u.sym} AND alert_date = ${today}
        `;
        if (already.length) continue; // already warned about this symbol today
        try {
          await sendTelegram(
            chatId,
            [
              `⚠️ *Price Unavailable — ${u.sym}*`,
              '━━━━━━━━━━━━━━━━━━━',
              '',
              `Couldn't fetch a live NSE price for *${u.sym}*: ${u.reason || 'unknown error'}`,
              `SL/Target checks are being skipped for this position until it's fixed.`,
              '',
              `This usually means the symbol was renamed/delisted on NSE (e.g. after a demerger). Double-check the current NSE symbol and update the trade if it's changed.`,
            ].join('\n')
          );
          await sql`
            INSERT INTO ticker_issue_alerts (user_id, sym, alert_date)
            VALUES (${userId}, ${u.sym}, ${today})
            ON CONFLICT (user_id, sym, alert_date) DO NOTHING
          `;
          await new Promise(r => setTimeout(r, 800));
        } catch (e) {
          console.error('price-alerts: ticker-issue warning failed:', e.message);
        }
      }
    }
    if (unresolved.length > realIssues.length) {
      console.warn('price-alerts: transient NSE issues this run (not alerted):',
        unresolved.filter(u => u.transient !== false).map(u => u.sym).join(', '));
    }

    return res.status(200).json({ ok: true, checked, alertsSent, unresolved: unresolved.map(u => u.sym) });
  } catch (e) {
    console.error('price-alerts cron error:', e);
    return res.status(500).json({ error: e.message });
  }
}