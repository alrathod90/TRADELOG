// api/yf.js — Vercel serverless function
// Proxies Yahoo Finance requests server-side (no CORS, no rate limit issues)
// Usage:
//   /api/yf?path=/v8/finance/chart/HDFCBANK.NS&interval=1d&range=1d
//   /api/yf?path=/v1/finance/search&q=HDFCBANK.NS&quotesCount=1&newsCount=0

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { path, ...params } = req.query;
  if (!path) { res.status(400).json({ error: 'Missing path param' }); return; }

  const qs = new URLSearchParams(params).toString();
  const url = `https://query1.finance.yahoo.com${path}${qs ? '?' + qs : ''}`;

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://finance.yahoo.com',
        'Referer': 'https://finance.yahoo.com/',
      },
    });

    const contentType = r.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Yahoo returned HTML (usually a rate limit or bot block page) — return empty
      res.status(503).json({ error: 'Yahoo Finance unavailable', status: r.status });
      return;
    }

    const data = await r.json();
    // Cache for 60s at CDN edge, allow stale for 2min
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}