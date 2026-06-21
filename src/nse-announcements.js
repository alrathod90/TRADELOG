// api/nse-announcements.js — Vercel serverless function
// Free, official NSE corporate announcements feed.
// NSE blocks direct browser/bot requests (Akamai), so this proxy:
//   1. Visits the NSE homepage first to obtain valid session cookies
//   2. Reuses those cookies to call the announcements JSON endpoint
//   3. Returns the raw NSE response to the client
//
// Usage: /api/nse-announcements?symbol=HDFCBANK&from_date=14-05-2026&to_date=14-06-2026
//        dates are DD-MM-YYYY (NSE's format)

let cachedCookie = null;
let cookieExpiry = 0;

async function getNseCookie() {
  const now = Date.now();
  if (cachedCookie && now < cookieExpiry) return cachedCookie;

  const homeRes = await fetch('https://www.nseindia.com/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  // NSE sends MULTIPLE Set-Cookie headers. headers.get('set-cookie') only returns
  // one combined/garbled string on some runtimes. Node 18+'s native fetch (used by
  // Vercel) exposes the full list via headers.getSetCookie() — use that when available,
  // and fall back to the single-header version otherwise.
  let cookies = [];
  if (typeof homeRes.headers.getSetCookie === 'function') {
    cookies = homeRes.headers.getSetCookie();
  } else {
    const single = homeRes.headers.get('set-cookie');
    if (single) cookies = [single];
  }

  // Each entry looks like "name=value; Path=/; ..." — keep only "name=value"
  const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

  cachedCookie = cookieString;
  cookieExpiry = now + 4 * 60 * 1000; // refresh every 4 minutes
  return cachedCookie;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { symbol, from_date, to_date, debug } = req.query;
  if (!symbol) { res.status(400).json({ error: 'Missing symbol param' }); return; }

  try {
    const cookie = await getNseCookie();

    if (!cookie) {
      res.status(502).json({ error: 'Could not obtain NSE session cookie' });
      return;
    }

    const params = new URLSearchParams({
      index: 'equities',
      symbol: symbol.toUpperCase(),
    });
    if (from_date) params.set('from_date', from_date); // DD-MM-YYYY expected by NSE
    if (to_date)   params.set('to_date', to_date);

    const url = `https://www.nseindia.com/api/corporate-announcements?${params.toString()}`;

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `https://www.nseindia.com/get-quotes/equity?symbol=${symbol.toUpperCase()}`,
        'Cookie': cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const contentType = r.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      // NSE returned the Akamai block page or HTML — cookie likely stale/invalid, clear cache
      cachedCookie = null;
      const bodyPreview = debug ? (await r.text()).slice(0, 300) : undefined;
      res.status(503).json({
        error: 'NSE temporarily unavailable, try again shortly',
        upstreamStatus: r.status,
        upstreamContentType: contentType,
        ...(bodyPreview ? { bodyPreview } : {}),
      });
      return;
    }

    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}