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
  // the board's tests share one database and run in order; the design-system check compares
  // /styleguide with the design system's reference images (never update those here)
  workers: 1,
  projects: [
    { name: 'board', testIgnore: /design-system\.spec\.ts/ },
    { name: 'design-system', testMatch: /design-system\.spec\.ts/, snapshotPathTemplate: '{testDir}/../design-system/reference/{arg}{ext}' },
  ],
  webServer: {
    command: 'rm -rf .e2e && NODE_ENV=production PORT=3099 DATABASE_PATH=.e2e/vp.db ADMIN_PASSWORD=e2e-secret SESSION_SECRET=e2e npx tsx server/index.ts',
    url: 'http://localhost:3099/healthz',
    reuseExistingServer: false,
  },
})
