import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/api': {
        target: process.env.GATEWAY_URL ?? 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
