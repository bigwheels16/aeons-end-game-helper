/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Scanner service (its login proxy) to forward /api and /oauth2 to in development, e.g. http://localhost:8080
  const scannerTarget = loadEnv(mode, '.', 'SCANNER_').SCANNER_PROXY_TARGET

  return {
    plugins: [react()],
    server: {
      watch: {
        usePolling: true,
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
