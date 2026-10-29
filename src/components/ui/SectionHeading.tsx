import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SectionHeadingProps {
  id?: string
  eyebrow?: ReactNode
  title: ReactNode
  intro?: ReactNode
  tone?: 'light' | 'dark'
  className?: string
  /** Shown at the end side on wide screens (filters, actions) */
  aside?: ReactNode
}

/** DS section heading, as in the booklet: eyebrow → 64×4 accent bar → Neo Sans title → intro. */
export function SectionHeading({ id, eyebrow, title, intro, tone = 'light', className, aside }: SectionHeadingProps) {
  const dark = tone === 'dark'
  return (
    <div className={cn('mb-8 flex flex-col gap-5 md:mb-10 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="max-w-prose">
        {eyebrow && <p className={cn('eyebrow mb-3', dark && 'text-blue-200')}>{eyebrow}</p>}
        <span aria-hidden className={cn('accent-bar mb-5', dark ? 'text-white' : 'text-brand')} />
        <h2 id={id} className={cn('text-display-xs font-medium tracking-snug md:text-display-sm', dark ? 'text-white' : 'text-fg-primary')}>
          {title}
        </h2>
        {intro && <p className={cn('mt-3 text-md leading-relaxed', dark ? 'text-white/80' : 'text-fg-secondary')}>{intro}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  )
}
