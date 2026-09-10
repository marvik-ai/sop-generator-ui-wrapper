import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
  ],
  server: {
    proxy: {
      // Proxying keeps the browser same-origin, so the backend needs no CORS config
      // and the frontend needs no API base URL.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // SSE must not be buffered, and a generation can idle for minutes between
        // stage lines.
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
})
