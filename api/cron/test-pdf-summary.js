// GET /api/cron/test-pdf-summary?url=<pdf-url>
// Runs the exact same PDF-fetch + extractive-summary pipeline used by
// announcement-alerts.js, but as a standalone, read-only test — no Telegram
// send, no DB writes, no dependency on a real new announcement existing.
// Use this to validate pdf-parse is working at any time.

async function fetchPdfText(url) {
  let parser = null;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,*/*',
        'Referer': 'https://www.nseindia.com/',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return { text: null, error: `Fetch failed: HTTP ${r.status}` };
    const buf = Buffer.from(await r.arrayBuffer());

    const { PDFParse } = await import('pdf-parse');
    parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    const text = (result?.text || '').trim() || null;
    return { text, error: text ? null : 'PDF parsed but no text extracted (possibly scanned/image PDF)' };
  } catch (e) {
    return { text: null, error: e.message };
  } finally {
    if (parser) {
      try { await parser.destroy(); } catch (_) {}
    }
  }
}

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

function extractiveSummary(text, { maxSentences = 4, maxChars = 600 } = {}) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = (clean.match(/[^.!?]+[.!?]+/g) || [clean])
    .map(s => s.trim())
    .filter(s => s.length > 20);
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

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url param — pass ?url=<pdf-url>' });
  }

  const start = Date.now();
  const { text, error } = await fetchPdfText(url);
  const summary = text ? extractiveSummary(text) : null;

  return res.status(200).json({
    ok: !!text,
    url,
    extractedChars: text?.length || 0,
    extractedPreview: text ? text.slice(0, 300) : null,
    summary,
    error,
    tookMs: Date.now() - start,
  });
}