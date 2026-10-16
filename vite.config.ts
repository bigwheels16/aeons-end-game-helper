/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Scanner service (its login proxy) to forward /api and /oauth2 to in development, e.g. http://localhost:8080
  const scannerTarget = loadEnv(mode, '.', 'SCANNER_').SCANNER_PROXY_TARGET

  return {
    plugins: [react()],
    // Build output with hashed file names, served with a long-lived cache
    build: {
      assetsDir: 'immutable',
    },
    server: {
      watch: {
        usePolling: true,
        // Scraper cache and downloaded images aren't watched
        ignored: ['**/data/scraped/**'],
      },
      proxy: scannerTarget
        ? {
            '/api': { target: scannerTarget, xfwd: true },
            '/oauth2': { target: scannerTarget, xfwd: true },
          }
        : undefined,
    },
    test: {
      environment: 'jsdom',
      globals: true,
    },
  }
})
