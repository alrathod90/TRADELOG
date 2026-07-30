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
    if (r.status === 429) {
      return { price: null, reason: 'Yahoo Finance rate limited', transient: true };
    }
    if (!r.ok) {
      return { price: null, reason: `HTTP ${r.status}`, transient: true };
    }
    const d = await r.json();
    if (d?.chart?.error) {
      // e.g. "No data found, symbol may be delisted" — a real, actionable
      // issue (ticker renamed/wrong), not a transient blip.
      return { price: null, reason: d.chart.error.description || d.chart.error.code, transient: false };
    }
    const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price == null) {
      return { price: null, reason: 'No price in response', transient: true };
    }
    return { price, reason: null, transient: true };
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

    for (const t of open) {
      const ticker = t.ticker || `${t.sym}.NS`;
      const { price, reason, transient } = await fetchYFPrice(ticker);
      if (price == null) {
        unresolved.push({ sym: t.sym, ticker, reason, transient });
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

      await new Promise(r => setTimeout(r, 200)); // avoid Yahoo rate limiting
    }

    // Surface REAL price-resolution failures (symbol genuinely not found /
    // delisted on Yahoo — e.g. renamed after a demerger) instead of letting
    // them fail silently forever. Transient rate-limits are deliberately
    // NOT alerted on here — they typically resolve on the very next
    // 15-minute run without any action needed.
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
              `Couldn't fetch a live price for ticker \`${u.ticker}\`: ${u.reason || 'unknown error'}`,
              `SL/Target checks are being skipped for this position until it's fixed.`,
              '',
              `This usually means the symbol was renamed/delisted on NSE (e.g. after a demerger) and Yahoo's ticker no longer matches. Check the current ticker and set a manual override on the trade if needed.`,
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
      console.warn('price-alerts: transient Yahoo issues this run (not alerted):',
        unresolved.filter(u => u.transient !== false).map(u => u.sym).join(', '));
    }

    return res.status(200).json({
      ok: true,
      checked,
      alertsSent,
      unresolved: unresolved.map(u => ({ sym: u.sym, reason: u.reason, transient: u.transient })),
    });
  } catch (e) {
    console.error('price-alerts cron error:', e);
    return res.status(500).json({ error: e.message });
  }
}