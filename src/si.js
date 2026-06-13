// api/si.js  — Vercel serverless function
// Proxies StockInsights API so the Bearer token stays server-side (safer)
// and Capacitor mobile app has no CORS issues.
// Usage: fetch('/api/si?path=/api/in/v0/documents/announcement&ticker=NSE:HDFCBANK')

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { path, ...params } = req.query;
  if (!path) { res.status(400).json({ error: 'Missing path param' }); return; }

  const qs = new URLSearchParams(params).toString();
  const url = `https://stockinsights-ai-main-95a26a0.zuplo.app${path}${qs ? '?' + qs : ''}`;

  // Forward the Authorization header from the client
  const authHeader = req.headers['authorization'] || '';

  try {
    const upstream = await fetch(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
