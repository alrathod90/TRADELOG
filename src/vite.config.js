import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ── Dev-only NSE proxy plugin ────────────────────────────────────────────────
// Mirrors api/nse-announcements.js so /api/nse-announcements also works on
// `npm run dev` (localhost:5173), not just on the deployed Vercel build.
//
// IMPORTANT: Vite does NOT hot-reload vite.config.js changes.
// After editing this file you MUST fully stop (Ctrl+C) and re-run `npm run dev`.
function nseAnnouncementsDevProxy() {
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
    cachedCookie = homeRes.headers.get('set-cookie') || '';
    cookieExpiry = now + 4 * 60 * 1000;
    return cachedCookie;
  }

  return {
    name: 'nse-announcements-dev-proxy',
    // configureServer with no 'pre'/'post' runs in plugin order, BEFORE Vite's
    // internal HTML-serving middleware — but we register the route handler
    // directly on server.middlewares so it always takes priority for this path.
    configureServer(server) {
      console.log('[nse-announcements-dev-proxy] registered at /api/nse-announcements');

      server.middlewares.use(async (req, res, next) => {
        // Only intercept our exact API path — let everything else pass through
        if (!req.url || !req.url.startsWith('/api/nse-announcements')) return next();

        console.log('[nse-announcements-dev-proxy] handling:', req.url);

        try {
          const url = new URL(req.url, 'http://localhost');
          const symbol = url.searchParams.get('symbol');
          const from_date = url.searchParams.get('from_date');
          const to_date = url.searchParams.get('to_date');

          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');

          if (!symbol) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing symbol param' }));
            return;
          }

          const cookie = await getNseCookie();
          const params = new URLSearchParams({ index: 'equities', symbol: symbol.toUpperCase() });
          if (from_date) params.set('from_date', from_date);
          if (to_date)   params.set('to_date', to_date);

          const nseUrl = `https://www.nseindia.com/api/corporate-announcements?${params.toString()}`;
          const r = await fetch(nseUrl, {
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
            console.warn('[nse-announcements-dev-proxy] NSE returned non-JSON, status:', r.status);
            cachedCookie = null; // stale cookie — force refresh next time
            res.statusCode = 503;
            res.end(JSON.stringify({ error: 'NSE temporarily unavailable, try again shortly', upstreamStatus: r.status }));
            return;
          }

          const data = await r.json();
          res.statusCode = 200;
          res.end(JSON.stringify(data));
        } catch (e) {
          console.error('[nse-announcements-dev-proxy] error:', e.message);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), nseAnnouncementsDevProxy()],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },

  server: {
    proxy: {
      '/yf':  { target: 'https://query1.finance.yahoo.com', changeOrigin: true, rewrite: p => p.replace(/^\/yf/, ''),  secure: true },
      '/cmb': { target: 'https://api.callmebot.com',          changeOrigin: true, rewrite: p => p.replace(/^\/cmb/, ''), secure: true },
    },
  },
});