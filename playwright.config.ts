import { defineConfig } from '@playwright/test'

/** Smoke tests run against the built app served by the real server, on a throwaway database. */
export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: 'http://localhost:3099',
    locale: 'ar-SA',
    // CI/cloud images with a pre-installed Chromium: CHROMIUM_PATH=/path/to/chrome
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'rm -rf .e2e && NODE_ENV=production PORT=3099 DATABASE_PATH=.e2e/vp.db ADMIN_PASSWORD=e2e-secret SESSION_SECRET=e2e npx tsx server/index.ts',
    url: 'http://localhost:3099/healthz',
    reuseExistingServer: false,
  },
})
