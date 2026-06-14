// api/si.js — Vercel serverless function
// Proxies StockInsights API requests server-side (no CORS)
// The Bearer token is forwarded from the client (stored in user's browser localStorage)
// Usage: /api/si/api/in/v0/documents/announcement?ticker=NSE:HDFCBANK&from_date=2026-01-01

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Strip /api/si prefix to get the actual StockInsights path
  const siPath = req.url.replace(/^\/api\/si/, '');
  const url = `https://stockinsights-ai-main-95a26a0.zuplo.app${siPath}`;

  const authHeader = req.headers['authorization'] || '';

  try {
    const r = await fetch(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const contentType = r.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      res.status(502).json({ error: 'StockInsights returned non-JSON', status: r.status });
      return;
    }

    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}