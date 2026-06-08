
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
 
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Routes /yf/* → Yahoo Finance (bypasses CORS for both chart and search endpoints)
      '/yf': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/yf/, ''),
        secure: true,
      },
    },
  },
});