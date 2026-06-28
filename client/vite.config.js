import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Vrai backend Fastify (Stone Daily). Le proxy garde le navigateur en
      // same-origin -> aucun CORS. Couvre /v1/daily, /submit, /leaderboard,
      // /me/stats et le stream des grilles /v1/grids/*.
      '/v1': 'http://localhost:8080',
    },
  },
});
