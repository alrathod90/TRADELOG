/**
 * Vercel Serverless Function: Yahoo Finance CORS Proxy
 * Routes: /api/yf
 * 
 * Proxies requests to Yahoo Finance API to bypass CORS restrictions.
 * Used by TradeLog for live price fetching.
 * 
 * Usage:
 *   GET /api/yf?path=/v8/finance/chart/SYMBOL.NS&interval=1d&range=90d
 *   GET /api/yf?path=/v1/finance/search&q=RELIANCE.NS&quotesCount=1
 */

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { path, interval = '1d', range = '90d', q, quotesCount, newsCount } = req.query;

  // Validate path
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  try {
    // Build Yahoo Finance URL
    let url = `https://query1.finance.yahoo.com${path}`;
    
    // Add query params based on endpoint type
    const params = new URLSearchParams();
    
    if (path.includes('/chart/')) {
      params.append('interval', interval);
      params.append('range', range);
    }
    
    if (q) params.append('q', q);
    if (quotesCount) params.append('quotesCount', quotesCount);
    if (newsCount) params.append('newsCount', newsCount);
    
    const queryString = params.toString();
    if (queryString) url += '?' + queryString;

    console.log(`[yf.js] Proxying: ${url}`);

    // Fetch from Yahoo Finance
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://finance.yahoo.com/',
      },
      timeout: 8000,
    });

    // Check for rate limiting
    if (response.status === 429) {
      console.warn('[yf.js] Yahoo Finance rate limited (429)');
      return res.status(429).json({ error: 'Yahoo Finance rate limited. Try again in a few minutes.' });
    }

    if (!response.ok) {
      console.error(`[yf.js] Yahoo Finance returned ${response.status}: ${response.statusText}`);
      return res.status(response.status).json({ error: `Yahoo Finance error: ${response.statusText}` });
    }

    const data = await response.json();

    // Success — cache for 1 minute
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.status(200).json(data);

  } catch (error) {
    console.error('[yf.js] Error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch from Yahoo Finance',
      details: error.message 
    });
  }
}
