// api/telegram-test.js — sends a one-off test Telegram message
// POST /api/telegram-test  body: { chatId: "123456789" }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).json({ ok: true }); return; }
  if (req.method !== 'POST')   { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) {
    // Always return JSON — never an empty body
    res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not configured in Vercel environment variables. Go to Vercel → Project → Settings → Environment Variables and add it.' });
    return;
  }

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch (e) {}
  const chatId = String(body.chatId || '').trim();

  if (!chatId) {
    res.status(400).json({ ok: false, error: 'Missing chatId in request body' });
    return;
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ *TradeLog* — Telegram alerts working! You will receive open positions + P&L every trading day at 3:30 PM IST.',
        parse_mode: 'Markdown',
      }),
    });

    // Always parse Telegram's response safely
    const text = await r.text();
    let data = {};
    try { data = JSON.parse(text); } catch (e) { data = { ok: false, description: 'Telegram returned non-JSON' }; }

    if (data.ok) {
      res.status(200).json({ ok: true });
    } else {
      res.status(400).json({ ok: false, error: data.description || 'Telegram API rejected the request' });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}