// api/yf.js  — Vercel serverless function
// Proxies Yahoo Finance requests server-side so Capacitor mobile app has no CORS issues.
// Usage: fetch('/api/yf?path=/v8/finance/chart/HDFCBANK.NS&interval=1d&range=1d')

export default async function handler(req, res) {
  // CORS headers — allow requests from any origin (Capacitor uses file:// or capacitor://)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { path, ...params } = req.query;
  if (!path) { res.status(400).json({ error: 'Missing path param' }); return; }

  // Build Yahoo Finance URL
  const qs = new URLSearchParams(params).toString();
  const url = `https://query1.finance.yahoo.com${path}${qs ? '?' + qs : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
