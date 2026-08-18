/**
 * Enhanced Announcement Alerts with Smart Processing
 * Phase 1-4 implementation: Smart summarization, categorization, impact scoring, telegram alerts
 */

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

function toNseDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

function annKey(a) {
  return `${a._sym}|${a.an_dt}|${(a.desc || '').slice(0, 40)}`;
}

// ── Smart processing functions (mirrors src/announcementProcessor.js) ────────

const ANNOUNCEMENT_CATEGORIES = {
  EARNINGS: 'earnings',
  CORPORATE_ACTION: 'corporate_action',
  REGULATORY: 'regulatory',
  MANAGEMENT: 'management',
  EXPANSION: 'expansion',
  ACQUISITION: 'acquisition',
  MARKET: 'market',
  UNKNOWN: 'unknown',
};

const CATEGORY_KEYWORDS = {
  [ANNOUNCEMENT_CATEGORIES.EARNINGS]: [
    'results', 'earnings', 'profit', 'revenue', 'loss', 'ebitda', 'quarterly', 'annual',
  ],
  [ANNOUNCEMENT_CATEGORIES.CORPORATE_ACTION]: [
    'bonus', 'dividend', 'split', 'buyback', 'rights', 'issue', 'share split',
  ],
  [ANNOUNCEMENT_CATEGORIES.REGULATORY]: [
    'sebi', 'compliance', 'regulation', 'filing', 'disclosure', 'notice', 'order',
  ],
  [ANNOUNCEMENT_CATEGORIES.MANAGEMENT]: [
    'appointment', 'director', 'ceo', 'chairman', 'board', 'resignation',
  ],
  [ANNOUNCEMENT_CATEGORIES.EXPANSION]: [
    'expansion', 'capex', 'investment', 'facility', 'plant', 'commissioning',
  ],
  [ANNOUNCEMENT_CATEGORIES.ACQUISITION]: [
    'acquisition', 'merger', 'takeover', 'stake', 'consolidation',
  ],
  [ANNOUNCEMENT_CATEGORIES.MARKET]: [
    'listing', 'ipo', 'delisting', 'quotation',
  ],
};

function categorizeAnnouncement(text) {
  if (!text) return ANNOUNCEMENT_CATEGORIES.UNKNOWN;
  const lower = text.toLowerCase();
  let scores = {};
  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    scores[category] = keywords.filter(kw => lower.includes(kw)).length;
  });
  const maxCategory = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
  return maxCategory && maxCategory[1] > 0 ? maxCategory[0] : ANNOUNCEMENT_CATEGORIES.UNKNOWN;
}

function scoreImpact(category, summary) {
  const summary_lower = (summary || '').toLowerCase();
  if ([ANNOUNCEMENT_CATEGORIES.EARNINGS, ANNOUNCEMENT_CATEGORIES.CORPORATE_ACTION].includes(category)) {
    if (
      summary_lower.includes('miss') || summary_lower.includes('beat') ||
      summary_lower.includes('bonus') || summary_lower.includes('split') ||
      summary_lower.includes('loss') || summary_lower.includes('merger')
    ) {
      return { level: 'HIGH', score: 9 };
    }
    return { level: 'MEDIUM', score: 6 };
  }
  if ([ANNOUNCEMENT_CATEGORIES.MANAGEMENT, ANNOUNCEMENT_CATEGORIES.EXPANSION, ANNOUNCEMENT_CATEGORIES.REGULATORY].includes(category)) {
    return { level: 'MEDIUM', score: 5 };
  }
  return { level: 'LOW', score: 2 };
}

function analyzeSentiment(text) {
  if (!text) return { sentiment: 'NEUTRAL', score: 0 };
  const lower = text.toLowerCase();
  const positive = [
    'increase', 'growth', 'profit', 'strong', 'expansion', 'bonus', 'dividend', 'beat',
    'success', 'positive', 'approval', 'achieved', 'record', 'upside', 'gain',
  ];
  const negative = [
    'loss', 'decline', 'decrease', 'miss', 'weak', 'risk', 'warning', 'suspension',
    'failure', 'downside', 'crash', 'fall', 'delay', 'closure', 'default',
  ];
  const posCount = positive.filter(p => lower.includes(p)).length;
  const negCount = negative.filter(n => lower.includes(n)).length;
  if (posCount > negCount) {
    return { sentiment: 'POSITIVE', score: Math.min(10, posCount * 2) };
  } else if (negCount > posCount) {
    return { sentiment: 'NEGATIVE', score: Math.min(10, -negCount * 2) };
  }
  return { sentiment: 'NEUTRAL', score: 0 };
}

// Extractive summary fallback
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
  let parser = null;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/pdf,*/*',
        'Referer': 'https://www.nseindia.com/',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    await import('pdf-parse/worker');
    const { PDFParse } = await import('pdf-parse');
    parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    return (result?.text || '').trim() || null;
  } catch (e) {
    console.warn('fetchPdfText failed:', e.message);
    return null;
  } finally {
    if (parser) {
      try { await parser.destroy(); } catch (_) {}
    }
  }
}

function extractiveSummary(text, { maxSentences = 4, maxChars = 600 } = {}) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = (clean.match(/[^.!?]+[.!?]+/g) || [clean])
    .map(s => s.trim())
    .filter(s => {
      if (s.length <= 20) return false;
      const noiseRatio = (s.match(/[^a-zA-Z\s]/g) || []).length / s.length;
      if (noiseRatio > 0.12) return false;
      const words = s.match(/[a-zA-Z]{2,}/g) || [];
      if (words.length < 6) return false;
      const avgWordLen = words.join('').length / words.length;
      if (avgWordLen < 3.2) return false;
      const stopwordCount = words.filter(w => STOPWORDS.has(w.toLowerCase())).length;
      if (stopwordCount / words.length < 0.15) return false;
      return true;
    });
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
  top.sort((a, b) => a.i - b.i);
  let summary = top.map(t => t.s).join(' ');
  if (summary.length > maxChars) summary = summary.slice(0, maxChars).trim() + '…';
  return summary;
}

/**
 * Try Claude API for AI summary, fallback to extractive
 */
async function generateSmartSummary(fullText, fallbackSummary) {
  if (!fullText && !fallbackSummary) return null;
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `Summarize this corporate announcement in 2-3 sentences. Focus on what matters to traders/investors.

Be concise about:
- What happened (dividend, earnings, acquisition, etc.)
- Key numbers if relevant
- Likely impact on stock price

Announcement:
${fullText || fallbackSummary}`,
          }],
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        console.warn(`Claude API failed: ${response.status}`);
        return fallbackSummary || null;
      }
      const data = await response.json();
      const summary = data.content?.[0]?.text?.trim();
      return summary || fallbackSummary || null;
    }
    return fallbackSummary || null;
  } catch (e) {
    console.warn('generateSmartSummary error:', e.message);
    return fallbackSummary || null;
  }
}

function getCategoryEmoji(category) {
  const emojis = {
    earnings: '💰',
    corporate_action: '🏦',
    regulatory: '⚖️',
    management: '👔',
    expansion: '🚀',
    acquisition: '🤝',
    market: '📈',
    unknown: 'ℹ️',
  };
  return emojis[category] || 'ℹ️';
}

function getImpactEmoji(level) {
  const emojis = { HIGH: '🚀', MEDIUM: '⚠️', LOW: 'ℹ️' };
  return emojis[level] || 'ℹ️';
}

function getSentimentEmoji(sentiment) {
  const emojis = { POSITIVE: '📈', NEGATIVE: '📉', NEUTRAL: '➡️' };
  return emojis[sentiment] || '➡️';
}

/**
 * Format smart announcement for Telegram (HIGH impact only)
 */
function formatSmartTelegramMessage(ann) {
  const sym = ann._sym || ann.symbol || '';
  const dt = ann.an_dt
    ? new Date(ann.an_dt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '';
  
  return [
    `${getImpactEmoji(ann.impactLevel)} ${getCategoryEmoji(ann.category)} *${sym}* — ${ann.category.toUpperCase()}`,
    '━━━━━━━━━━━━━━━━━━━',
    '',
    `${getSentimentEmoji(ann.sentiment)} *${ann.sentiment}*`,
    dt ? `📅 ${dt} IST` : '',
    ann.smartSummary ? `\n📝 *Summary:*\n${ann.smartSummary}` : '',
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

    // 1. Get open positions
    const tradeRows = await sql`SELECT data FROM trades WHERE user_id = ${userId}`;
    const openSymbols = [
      ...new Set(
        tradeRows.map(r => r.data).filter(t => t && t.status === 'open' && t.sym).map(t => t.sym)
      ),
    ];
    if (!openSymbols.length) {
      return res.status(200).json({ ok: true, checked: 0, sent: 0, note: 'no open positions' });
    }

    // 2. Get chat ID
    const profileRows = await sql`SELECT telegram_chat_id FROM profiles WHERE user_id = ${userId}`;
    const chatId = profileRows[0]?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      return res.status(200).json({ ok: true, skipped: 'no chat id configured' });
    }

    // 3. Fetch announcements
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = `${proto}://${req.headers.host}`;
    const from = toNseDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const to = toNseDate(new Date().toISOString().slice(0, 10));

    const fresh = [];
    for (const sym of openSymbols) {
      try {
        const url = `${base}/api/nse-announcements?symbol=${encodeURIComponent(sym)}&from_date=${from}&to_date=${to}`;
        const r = await fetch(url, {
          headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
            ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
            : {},
          signal: AbortSignal.timeout(12000),
        });
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

    // 4. Filter new ones
    const keys = fresh.map(annKey);
    const seenRows = await sql`
      SELECT ann_key FROM seen_announcements
      WHERE user_id = ${userId} AND ann_key = ANY(${keys})
    `;
    const seenSet = new Set(seenRows.map(r => r.ann_key));
    const newOnes = fresh.filter(a => !seenSet.has(annKey(a)));

    // 5. First run bootstrap
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM seen_announcements WHERE user_id = ${userId}`;
    const isFirstRun = count === 0;

    let sent = 0;
    for (const ann of newOnes) {
      const key = annKey(ann);
      
      if (!isFirstRun) {
        // ─ Smart processing ─
        let pdfText = null;
        if (ann.attchmntFile && /\.pdf(\?|$)/i.test(ann.attchmntFile)) {
          pdfText = await fetchPdfText(ann.attchmntFile);
        }
        
        const extractiveSummaryText = extractiveSummary(pdfText);
        const smartSummary = await generateSmartSummary(pdfText, extractiveSummaryText);
        
        const category = categorizeAnnouncement(ann.desc || pdfText || smartSummary || '');
        const sentiment = analyzeSentiment(pdfText || ann.desc || smartSummary || '');
        const impact = scoreImpact(category, smartSummary);
        
        ann.category = category;
        ann.smartSummary = smartSummary;
        ann.sentiment = sentiment.sentiment;
        ann.sentimentScore = sentiment.score;
        ann.impactLevel = impact.level;
        ann.impactScore = impact.score;
        ann.processedAt = new Date().toISOString();
        
        // Phase 4: Alert only on HIGH impact
        if (impact.level === 'HIGH') {
          try {
            const msg = formatSmartTelegramMessage(ann);
            await sendTelegram(chatId, msg);
            sent++;
            await new Promise(r => setTimeout(r, 1200));
          } catch (e) {
            console.error('telegram send failed:', e.message);
            continue; // retry next run
          }
        }
        
        // Store in announcements table if it exists
        try {
          await sql`
            INSERT INTO announcements (
              symbol, announcement_date, description, pdf_url, extracted_text,
              category, smart_summary, sentiment, sentiment_score,
              impact_level, impact_score, processed_at, raw_announcement, announcement_key
            ) VALUES (
              ${ann._sym}, ${ann.an_dt}, ${ann.desc}, ${ann.attchmntFile}, ${pdfText},
              ${category}, ${smartSummary}, ${sentiment.sentiment}, ${sentiment.score},
              ${impact.level}, ${impact.score}, ${new Date().toISOString()}, 
              ${JSON.stringify(ann)}, ${key}
            )
            ON CONFLICT (announcement_key) DO UPDATE SET
              smart_summary = ${smartSummary},
              category = ${category},
              sentiment = ${sentiment.sentiment},
              impact_level = ${impact.level},
              processed_at = ${new Date().toISOString()}
          `;
        } catch (e) {
          console.warn('Could not save to announcements table:', e.message);
          // Not critical — continue
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
