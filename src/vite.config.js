import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },

  server: {
    proxy: {
      '/yf':     { target: 'https://query1.finance.yahoo.com',                  changeOrigin: true, rewrite: p => p.replace(/^\/yf/, ''),      secure: true },
      '/si-api': { target: 'https://stockinsights-ai-main-95a26a0.zuplo.app',   changeOrigin: true, rewrite: p => p.replace(/^\/si-api/, ''),   secure: true },
      '/cmb':    { target: 'https://api.callmebot.com',                          changeOrigin: true, rewrite: p => p.replace(/^\/cmb/, ''),      secure: true },
    },
  },
});
