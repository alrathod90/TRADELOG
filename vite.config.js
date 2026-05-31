import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // All /yf-api/* calls are forwarded to Yahoo Finance (fixes CORS in browser)
      '/yf-api': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/yf-api/, ''),
        headers: {
          // Yahoo Finance needs a browser-like User-Agent
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-IN,en;q=0.9',
        }
      }
      ,
      // Proxy for NSE CSV to avoid CORS in dev. Request path: /nse-csv/EQUITY_L.csv
      '/nse-csv': {
        target: 'https://archives.nseindia.com/content/equities',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/nse-csv/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/csv,*/*;q=0.1',
        }
      }
    }
  }
})