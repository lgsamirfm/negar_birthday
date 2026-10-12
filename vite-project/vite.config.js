import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on every interface so the sandboxed live preview can reach it,
    // and accept any host header (the preview is served from a proxy domain).
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
})
