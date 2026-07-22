import { neon } from '@neondatabase/serverless';
import pdfParse from 'pdf-parse';

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

function toNseDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

// Same composite key logic as the frontend's fetchAnnouncements/annKey,
// so an announcement is identified consistently everywhere.
function annKey(a) {
  return `${a._sym}|${a.an_dt}|${(a.desc || '').slice(0, 40)}`;
}

// ── Free extractive PDF summary (no API key, no external LLM) ────────────────
// Downloads the filing PDF, extracts its text, and picks the most
// representative sentences using word-frequency scoring (a lightweight
// version of the classic Luhn summarization algorithm).
const STOPWORDS = new Set([
  'the','a','an','and','or','but','of','to','in','on','at','for','with','as',
  'is','are','was','were','be','been','being','by','from','that','this',
  'these','those','it','its','into','their','they','has','have','had','will',
  'shall','may','can','not','no','than','then','also','such','which','who',
  'whom','about','above','after','before','between','during','through','over',
  'under','up','down','out','off','further','once','all','any','both','each',
  'few','more','most','other','some','same','so','if','company','ltd',
  'limited','pursuant','regulation','regulations','sebi','exchange','nse',
]);

async function fetchPdfText(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const data = await pdfParse(buf);
    return (data.text || '').trim() || null;
  } catch (e) {
    console.warn('fetchPdfText failed:', e.message);
    return null;
  }
}

function extractiveSummary(text, { maxSentences = 4, maxChars = 600 } = {}) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = (clean.match(/[^.!?]+[.!?]+/g) || [clean])
    .map(s => s.trim())
    .filter(s => s.length > 20); // drop stray fragments/headers
  if (!sentences.length) return null;
  if (sentences.length <= maxSentences) {
    const joined = sentences.join(' ');
    return joined.length > maxChars ? joined.slice(0, maxChars).trim() + '…' : joined;
  }

  const freq = {};
  (clean.toLowerCase().match(/[a-z]{3,}/g) || []).forEach(w => {
    if (STOPWORDS.has(w)) return;
    freq[w] = (freq[w] || 0) + 1;
  });

  const scored = sentences.map((s, i) => {
    const words = s.toLowerCase().match(/[a-z]{3,}/g) || [];
    const score = words.reduce((sum, w) => sum + (freq[w] || 0), 0);
    return { s, i, score: words.length ? score / words.length : 0 };
  });

  const top = scored.sort((a, b) => b.score - a.score).slice(0, maxSentences);
  top.sort((a, b) => a.i - b.i); // restore original reading order

  let summary = top.map(t => t.s).join(' ');
  if (summary.length > maxChars) summary = summary.slice(0, maxChars).trim() + '…';
  return summary;
}

function formatAnnouncementMessage(ann) {
  const sym = ann._sym || ann.symbol || '';
  const dt = ann.an_dt
    ? new Date(ann.an_dt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '';
  const subject = ann.desc || ann.subject || 'Announcement';
  const detail = ann.attchmntText || '';
  return [
    `📢 *New Announcement — ${sym}*`,
    `📌 ${subject}`,
    dt ? `📅 ${dt} IST` : '',
    ann._pdfSummary ? `🧾 *Summary:* ${ann._pdfSummary}` : (detail ? `📝 ${detail.slice(0, 250)}${detail.length > 250 ? '…' : ''}` : ''),
    ann.attchmntFile ? `🔗 ${ann.attchmntFile}` : '',
  ].filter(Boolean).join('\n');
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

    // 1. Which symbols are currently open?
    const tradeRows = await sql`SELECT data FROM trades WHERE user_id = ${userId}`;
    const openSymbols = [
      ...new Set(
        tradeRows.map(r => r.data).filter(t => t && t.status === 'open' && t.sym).map(t => t.sym)
      ),
    ];
    if (!openSymbols.length) {
      return res.status(200).json({ ok: true, checked: 0, sent: 0, note: 'no open positions' });
    }

    // 2. Chat ID to notify
    const profileRows = await sql`SELECT telegram_chat_id FROM profiles WHERE user_id = ${userId}`;
    const chatId = profileRows[0]?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      return res.status(200).json({ ok: true, skipped: 'no chat id configured' });
    }

    // 3. Fetch fresh announcements for each open symbol (mirrors fetchAnnouncements in App.jsx),
    //    calling our own /api/nse-announcements endpoint via the incoming request's host.
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = `${proto}://${req.headers.host}`;
    const from = toNseDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const to = toNseDate(new Date().toISOString().slice(0, 10));

    const fresh = [];
    for (const sym of openSymbols) {
      try {
        const url = `${base}/api/nse-announcements?symbol=${encodeURIComponent(sym)}&from_date=${from}&to_date=${to}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!r.ok) continue;
        const contentType = r.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) continue;
        const data = await r.json();
        if (Array.isArray(data)) data.forEach(item => fresh.push({ ...item, _sym: sym }));
        await new Promise(res2 => setTimeout(res2, 200));
      } catch (e) {
        console.warn(`announcement-alerts: fetch failed for ${sym}:`, e.message);
      }
    }

    if (!fresh.length) {
      return res.status(200).json({ ok: true, checked: openSymbols.length, sent: 0 });
    }

    // 4. Filter out ones we've already notified about
    const keys = fresh.map(annKey);
    const seenRows = await sql`
      SELECT ann_key FROM seen_announcements
      WHERE user_id = ${userId} AND ann_key = ANY(${keys})
    `;
    const seenSet = new Set(seenRows.map(r => r.ann_key));
    const newOnes = fresh.filter(a => !seenSet.has(annKey(a)));

    // 5. First-ever run for this user: bootstrap silently (mark everything seen,
    //    don't blast every announcement from the lookback window as "new").
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM seen_announcements WHERE user_id = ${userId}`;
    const isFirstRun = count === 0;

    let sent = 0;
    for (const ann of newOnes) {
      const key = annKey(ann);
      if (!isFirstRun) {
        // Try to pull a free extractive summary from the attached PDF, if any.
        if (ann.attchmntFile && /\.pdf(\?|$)/i.test(ann.attchmntFile)) {
          const pdfText = await fetchPdfText(ann.attchmntFile);
          ann._pdfSummary = extractiveSummary(pdfText);
        }
        try {
          await sendTelegram(chatId, formatAnnouncementMessage(ann));
          sent++;
          await new Promise(r => setTimeout(r, 1200)); // space out messages
        } catch (e) {
          console.error('announcement-alerts: telegram send failed:', e.message);
          continue; // don't mark as seen if send failed — retry next run
        }
      }
      await sql`
        INSERT INTO seen_announcements (user_id, ann_key)
        VALUES (${userId}, ${key})
        ON CONFLICT (user_id, ann_key) DO NOTHING
      `;
    }

    return res.status(200).json({
      ok: true,
      checked: openSymbols.length,
      newFound: newOnes.length,
      sent,
      firstRun: isFirstRun,
    });
  } catch (e) {
    console.error('announcement-alerts error:', e);
    return res.status(500).json({ error: e.message });
  }
}