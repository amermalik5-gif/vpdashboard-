import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** The id of the enclosing <Section> — lets SectionHeading derive its chapter eyebrow. */
const SectionIdContext = createContext<string | null>(null)
export const useSectionId = () => useContext(SectionIdContext)

export type SectionTone = 'page' | 'surface' | 'soft' | 'navy'

const TONE: Record<SectionTone, string> = {
  page: 'bg-page text-fg-primary',
  surface: 'bg-surface text-fg-primary',
  soft: 'bg-brand-soft text-fg-primary',
  navy: 'bg-brand-dark text-white',
}

interface SectionProps {
  /** Anchor id — also used by the router (#id) and the active-section tracker. */
  id: string
  tone?: SectionTone
  /** Extra vertical rhythm control. 'default' = DS 96px desktop / 64px mobile. */
  spacing?: 'default' | 'none'
  className?: string
  /** Rendered inside .container-page unless `bleed` is true. */
  children: ReactNode
  bleed?: boolean
  /** Accessible name — id of the heading inside. */
  labelledBy?: string
}

/**
 * Standard section shell. Every top-level section of the story uses this so
 * spacing, backgrounds and anchors stay consistent.
 */
export function Section({ id, tone = 'page', spacing = 'default', className, children, bleed, labelledBy }: SectionProps) {
  return (
    <section
      id={id}
      data-section
      data-tone={tone === 'navy' ? 'dark' : 'light'}
      aria-labelledby={labelledBy}
      className={cn(
        'relative isolate',
        TONE[tone],
        spacing === 'default' && 'py-16 md:py-24',
        // print: screen breathing room would leave half-empty pages. Skipped when the section sets
        // its own print padding: cn() doesn't merge, and this rule would win in the CSS order.
        spacing === 'default' && !/\bprint:p[ytb]?-/.test(className ?? '') && 'print:py-10',
        className,
      )}
    >
      <SectionIdContext.Provider value={id}>{bleed ? children : <div className="container-page">{children}</div>}</SectionIdContext.Provider>
    </section>
  )
}
