import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SectionHeadingProps {
  id?: string
  title: ReactNode
  /** One short line next to the title */
  note?: ReactNode
  className?: string
  /** Shown at the end side (filters, actions) */
  aside?: ReactNode
}

/** Compact heading for a working dashboard: one title line and an optional short note. */
export function SectionHeading({ id, title, note, className, aside }: SectionHeadingProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1', className)}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="text-xl font-medium tracking-snug text-fg-primary md:text-display-xs">
          {title}
        </h2>
        {note && <p className="text-sm text-fg-tertiary">{note}</p>}
      </div>
      {aside}
    </div>
  )
}
