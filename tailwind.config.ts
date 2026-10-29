import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * The NWC Design System (src/styles/tokens.css) is the single source of truth.
 * Colour ramps are read from it at build time so Tailwind opacity modifiers
 * (bg-blue-500/20) work while values never drift from the design system.
 * The default Tailwind palette is REPLACED — only DS colours exist.
 */
const tokensCss = readFileSync(fileURLToPath(new URL('./src/styles/tokens.css', import.meta.url)), 'utf8')
const hex = (name: string): string => {
  const m = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`))
  if (!m) throw new Error(`Design token --${name} not found in tokens.css`)
  return m[1]
}
const ramp = (prefix: string, steps: number[]) =>
  Object.fromEntries(steps.map((s) => [s, hex(`${prefix}-${s}`)]))
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // full list, smallest first: min-width variants must be emitted in ascending order
    screens: { xs: '420px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',
      blue: ramp('nwc-blue', STEPS), // NWC Blue — brand
      teal: ramp('nwc-green', STEPS), // NWC Secondary (teal)
      info: ramp('info', STEPS),
      success: ramp('success', STEPS),
      warning: ramp('warning', STEPS),
      danger: ramp('danger', STEPS),
      neutral: ramp('neutral', [0, 25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
      tertiary: ramp('tertiary', [500, 600, 700, 900]),
      gold: { 500: hex('nwc-gold-500') },
      brand: { DEFAULT: hex('nwc-blue-500'), hover: hex('nwc-blue-600'), pressed: hex('nwc-blue-700'), soft: '#f0f7ff', dark: hex('nwc-blue-900') },
      fg: { primary: hex('neutral-800'), secondary: hex('neutral-600'), tertiary: hex('tertiary-500'), muted: hex('neutral-400') },
      page: '#fafafc',
      surface: '#ffffff',
      line: { subtle: hex('neutral-200'), DEFAULT: hex('neutral-300'), strong: hex('neutral-500') },
    },
    fontFamily: {
      sans: ['"Neo Sans W23"', 'system-ui', 'sans-serif'],
      ui: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
    fontSize: {
      // DS type scale [size, line-height]
      'display-2xl': ['57px', '64px'],
      'display-xl': ['45px', '52px'],
      'display-lg': ['36px', '44px'],
      'display-md': ['32px', '40px'],
      'display-sm': ['28px', '36px'],
      'display-xs': ['24px', '32px'],
      xl: ['22px', '28px'],
      lg: ['18px', '28px'],
      md: ['16px', '24px'],
      base: ['16px', '24px'],
      sm: ['14px', '20px'],
      xs: ['12px', '16px'],
      '2xs': ['11px', '16px'],
    },
    borderRadius: {
      none: '0', xxs: '2px', xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '20px', '3xl': '24px', '4xl': '32px', full: '9999px',
    },
    boxShadow: {
      none: 'none',
      xsm: 'var(--shadow-xsm)',
      sm: 'var(--shadow-sm)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
      xl: 'var(--shadow-xl)',
      '2xl': 'var(--shadow-2xl)',
      ring: 'var(--ring-primary)',
    },
    extend: {
      maxWidth: { content: '1280px', prose: '720px' },
      transitionDuration: { fast: '150ms', base: '200ms', slow: '350ms' },
      transitionTimingFunction: { standard: 'cubic-bezier(0.4, 0, 0.2, 1)' },
      backgroundImage: { 'brand-gradient': 'var(--bg-brand-gradient)' },
      backdropBlur: { glass: '16px' },
      lineHeight: { tight: '1.2', snug: '1.35', normal: '1.5', relaxed: '1.7' },
      letterSpacing: { tight: '-0.02em', snug: '-0.01em', wide: '0.02em' },
      zIndex: { header: '40', rail: '30', sheet: '50', toast: '60' },
    },
  },
  // height/pointer conditions as variants, not screens: object screens disable max-* and min-[…]
  plugins: [
    plugin(({ addVariant }) => {
      // short desktop/laptop windows (1366×768, 1536×864 @125%, 1440×900 minus browser chrome)
      addVariant('short', '@media (min-width: 768px) and (max-height: 860px)')
      addVariant('squat', '@media (min-width: 768px) and (max-height: 760px)')
      // touch pointers (phones, iPads): 44px targets even where the layout is "desktop" width
      addVariant('coarse', '@media (pointer: coarse)')
    }),
  ],
}

export default config
