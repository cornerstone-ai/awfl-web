import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Expose dev server on LAN so phones/tablets on the same Wi‑Fi can access it
    host: true, // equivalent to --host (binds to 0.0.0.0)
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      }
    },
  },
})