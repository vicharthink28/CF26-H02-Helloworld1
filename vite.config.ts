import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,
    proxy: {
      // All /api and /health requests are forwarded to the Express backend.
      // The frontend never needs to know the backend port — relative paths just work.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,          // proxy WebSocket upgrades (used by SSE keep-alive)
        rewrite: (path) => path,   // keep /api prefix intact
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
