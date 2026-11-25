import type { Config } from 'tailwindcss'
import preset from './design-system/src/tailwind-preset'

/** Everything visual comes from the NWC design system preset (design-system/DESIGN.md). */
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}', './design-system/src/**/*.{ts,tsx}'],
} satisfies Config
