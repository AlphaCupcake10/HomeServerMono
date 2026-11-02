import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    // Same-origin API in dev, like nginx in Docker: no CORS, and the refresh cookie just works.
    // API_PROXY_TARGET points the dev server at another API instance (default: `make dev` on :3000).
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000', changeOrigin: false },
    },
  },
})
