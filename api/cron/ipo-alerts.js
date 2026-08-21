import { neon } from '@neondatabase/serverless';
import { fetchMainboardIpos, getIpoAlertEvents } from '../lib/ipo-gmp.js';

let _sql = null;
function sql(strings, ...values) {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set in Vercel environment variables');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql(strings, ...values);
}

async function sendTelegram(chatId, text) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
  if (!response.ok) throw new Error(`Telegram send failed: ${response.status} ${await response.text()}`);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00+05:30`));
}

function indiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function messageFor(ipo, event) {
  const opening = event === 'opening';
  return [
    `${opening ? '🟢' : '⏰'} *Mainboard IPO ${opening ? 'Opens Today' : 'Closes Today'}*`,
    '━━━━━━━━━━━━━━━━━━━',
    '',
    `🏢 *${ipo.name}*`,
    `📈 Latest GMP: *${ipo.gmp}*`,
    `📅 Open: ${formatDate(ipo.openDate)}`,
    `📅 Close: ${formatDate(ipo.closeDate)}`,
    '',
    '_GMP is unofficial and indicative only. Not investment advice._',
  ].join('\n');
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) return res.status(200).json({ ok: true, skipped: 'no Telegram bot token configured' });

  try {
    const userId = String(process.env.CRON_USER_ID || 'guest').toLowerCase();
    const profileRows = await sql`SELECT telegram_chat_id FROM profiles WHERE user_id = ${userId}`;
    const chatId = profileRows[0]?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;
    if (!chatId) return res.status(200).json({ ok: true, skipped: 'no chat id configured' });

    const today = indiaDateKey();
    const { ipos } = await fetchMainboardIpos();
    const alerts = getIpoAlertEvents(ipos, today);

    for (const { ipo, event } of alerts) {
      await sendTelegram(chatId, messageFor(ipo, event));
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    return res.status(200).json({ ok: true, date: today, checked: ipos.length, sent: alerts.length });
  } catch (error) {
    console.error('ipo-alerts cron error:', error);
    return res.status(500).json({ error: error.message });
  }
}
