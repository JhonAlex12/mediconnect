import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dos aplicaciones: Mediconect (index.html) y el sistema simulado de la IPS (ips/index.html)
  build: {
    rollupOptions: {
      input: {
        mediconect: resolve(import.meta.dirname, 'index.html'),
        ips: resolve(import.meta.dirname, 'ips/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
})
