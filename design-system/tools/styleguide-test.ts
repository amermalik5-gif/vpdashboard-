/**
 * The visual check every site runs (and the package itself, to make the reference images):
 * the style guide page must match reference/styleguide-*.png pixel for pixel. Same settings
 * everywhere: fixed window sizes, scale 1, Arabic locale, no motion.
 *
 * In a site's e2e/design-system.spec.ts:
 *   import { styleguideTests } from '../design-system/tools/styleguide-test'
 *   styleguideTests('/styleguide')
 * and in its playwright.config.ts, for that file only (a project of its own):
 *   snapshotPathTemplate: '{testDir}/../design-system/reference/{arg}{ext}'
 */
import { expect, test } from '@playwright/test'

export const SHOTS = [
  { name: 'styleguide-desktop.png', viewport: { width: 1280, height: 900 } },
  { name: 'styleguide-phone.png', viewport: { width: 390, height: 844 } },
] as const

export function styleguideTests(path = '/styleguide') {
  for (const s of SHOTS) {
    test.describe(s.name, () => {
      test.use({ viewport: s.viewport, deviceScaleFactor: 1, locale: 'ar-SA', reducedMotion: 'reduce', colorScheme: 'light' })
      test('the style guide matches the NWC design system', async ({ page }) => {
        await page.goto(path)
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(300)
        // exact: no colour tolerance, no pixel allowance (a square corner instead of a round one is
        // only a few faint pixels, and must still fail)
        await expect(page).toHaveScreenshot(s.name, { fullPage: true, animations: 'disabled', threshold: 0, maxDiffPixels: 0 })
      })
    })
  }
}
