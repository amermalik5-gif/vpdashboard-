/**
 * Motion presets — NWC DS motion rules: calm fades + small (≤8px) translates,
 * DS timings (fast 150 / base 200 / slow 350 ms), ease-in-out, NO springs or bounce.
 * Storytelling animations (line draws, count-ups) may run longer but stay tweened.
 *
 * Components import motion primitives from HERE, never from 'framer-motion' directly.
 */
import type { Transition, Variants } from 'framer-motion'

export {
  motion,
  AnimatePresence,
  MotionConfig,
  useInView,
  useScroll,
  useTransform,
  useMotionValueEvent,
  animate,
} from 'framer-motion'
/**
 * Site-wide "reduce motion": true when the OS asks for it OR the visitor pressed the
 * on-page pause control (App wraps everything in <MotionConfig reducedMotion=…>).
 * Every component reads it from here, so one switch stops every loop and reveal.
 */
export { useReducedMotionConfig as useReducedMotion } from 'framer-motion'
/** The raw OS preference only (to decide whether the pause toggle is even needed). */
export { useReducedMotion as useOsReducedMotion } from 'framer-motion'
export type { Variants } from 'framer-motion'

export const EASE = [0.4, 0, 0.2, 1] as const

export const DUR = {
  fast: 0.15,
  base: 0.2,
  slow: 0.35,
  reveal: 0.5,
} as const

export const tween = (duration: number = DUR.slow, delay = 0): Transition => ({ type: 'tween', ease: EASE, duration, delay })

/** Section/element entrance: fade + 8px rise. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: tween(DUR.reveal) },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: tween(DUR.reveal) },
}

/** Parent that staggers its fadeUp children. */
export const stagger = (each = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: each, delayChildren } },
})

/** Default whileInView viewport — trigger a little before the element is fully visible. */
export const VIEWPORT = { once: true, margin: '0px 0px -12% 0px' } as const
