import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Allows sharing the local dev server through a tunnel (e.g. ngrok) for quick previews.
    allowedHosts: ['.ngrok-free.app', '.ngrok.io', '.ngrok.app'],
    // Proxy the two local backends through this same origin/port, so the
    // browser only ever talks to :5173 — sidesteps any cross-port browser
    // networking issue (firewall, extension, proxy) unrelated to whether
    // the backends themselves are reachable from this machine.
    proxy: {
      '/local-api': { target: 'http://127.0.0.1:8787', changeOrigin: true, rewrite: (p) => p.replace(/^\/local-api/, '') },
      '/ml-api': { target: 'http://127.0.0.1:8000', changeOrigin: true, rewrite: (p) => p.replace(/^\/ml-api/, '') },
    },
  },
  preview: {
    allowedHosts: ['.ngrok-free.app', '.ngrok.io', '.ngrok.app'],
  },
})
