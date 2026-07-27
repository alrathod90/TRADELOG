// api/nse-quote.js — Vercel serverless function
// Free, official NSE live quote feed — deliberately uses the SAME symbol
// namespace as /api/nse-announcements (NSE's own current symbol), instead
// of guessing a Yahoo Finance ticker via `sym + '.NS'`. That guess is what
// silently broke for OCCL after a demerger/rename — Yahoo's ticker mapping
// diverged from NSE's own, with no error, just wrong/stale data.
//
// Usage: /api/nse-quote?symbol=RELIANCE

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

  let cookies = [];
  if (typeof homeRes.headers.getSetCookie === 'function') {
    cookies = homeRes.headers.getSetCookie();
  } else {
    const single = homeRes.headers.get('set-cookie');
    if (single) cookies = [single];
  }
  const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

  cachedCookie = cookieString;
  cookieExpiry = now + 4 * 60 * 1000; // refresh every 4 minutes
  return cachedCookie;
}

async function fetchQuote(sym, cookie) {
  const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(sym)}`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://www.nseindia.com/get-quotes/equity?symbol=${sym}`,
      'Cookie': cookie,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  const contentType = r.headers.get('content-type') || '';
  return { r, contentType };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { symbol, debug } = req.query;
  if (!symbol) { res.status(400).json({ error: 'Missing symbol param' }); return; }

  const sym = symbol.toUpperCase();

  try {
    let cookie = await getNseCookie();
    if (!cookie) {
      res.status(502).json({ error: 'Could not obtain NSE session cookie' });
      return;
    }

    let { r, contentType } = await fetchQuote(sym, cookie);

    // Transient Akamai block or stale cookie — retry once with a fresh
    // session before giving up, so a momentary hiccup self-heals within
    // this same request instead of surfacing as a false alarm.
    if (!contentType.includes('application/json')) {
      cachedCookie = null;
      await new Promise(res2 => setTimeout(res2, 1200));
      cookie = await getNseCookie();
      if (cookie) {
        ({ r, contentType } = await fetchQuote(sym, cookie));
      }
    }

    if (!contentType.includes('application/json')) {
      cachedCookie = null;
      const bodyPreview = debug ? (await r.text()).slice(0, 300) : undefined;
      res.status(503).json({
        error: 'NSE temporarily unavailable (rate-limited/blocked), try again shortly',
        transient: true,
        upstreamStatus: r.status,
        upstreamContentType: contentType,
        ...(bodyPreview ? { bodyPreview } : {}),
      });
      return;
    }

    const data = await r.json();
    const lastPrice = data?.priceInfo?.lastPrice ?? null;

    if (lastPrice == null) {
      // Symbol genuinely doesn't exist on NSE under this name — a real,
      // actionable "not found" instead of Yahoo's silent wrong-data problem.
      res.status(404).json({ error: 'Symbol not found on NSE', transient: false, symbol: sym });
      return;
    }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json({
      symbol: data?.info?.symbol || sym,
      companyName: data?.info?.companyName || null,
      lastPrice,
      change: data?.priceInfo?.change ?? null,
      pChange: data?.priceInfo?.pChange ?? null,
      previousClose: data?.priceInfo?.previousClose ?? null,
      open: data?.priceInfo?.open ?? null,
      dayHigh: data?.priceInfo?.intraDayHighLow?.max ?? null,
      dayLow: data?.priceInfo?.intraDayHighLow?.min ?? null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, transient: true });
  }
}