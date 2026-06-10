import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Yahoo Finance — live prices + stock name search
      '/yf': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/yf/, ''),
        secure: true,
      },
      // StockInsights — corporate announcements (board meetings, results, concalls)
      '/si-api': {
        target: 'https://stockinsights-ai-main-95a26a0.zuplo.app',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/si-api/, ''),
        secure: true,
      },
      // CallMeBot — WhatsApp alerts (free, no backend needed)
      '/cmb': {
        target: 'https://api.callmebot.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/cmb/, ''),
        secure: true,
      },
    },
  },
});