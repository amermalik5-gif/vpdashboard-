import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { motion } from '@/lib/motion'
import { cn } from '@/lib/cn'

export interface TabItem<T extends string> {
  id: T
  label: ReactNode
  /** Optional count/extra shown after the label */
  meta?: ReactNode
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  /** Accessible label for the tab list */
  label: string
  className?: string
  /** id prefix for aria-controls → panels must use `${idPrefix}-panel-${id}` */
  idPrefix?: string
}

/** Accessible, RTL-aware segmented tabs with an animated indicator (no springs). */
export function Tabs<T extends string>({ items, value, onChange, label, className, idPrefix }: TabsProps<T>) {
  const auto = useId()
  const prefix = idPrefix ?? auto
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKey = (e: KeyboardEvent, i: number) => {
    // RTL: ArrowLeft moves forward, ArrowRight moves back
    const dir = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0
    let next = -1
    if (dir) next = (i + dir + items.length) % items.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = items.length - 1
    if (next < 0) return
    e.preventDefault()
    onChange(items[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'no-scrollbar inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-line-subtle bg-surface p-1 shadow-xsm sm:gap-1',
        className,
      )}
    >
      {items.map((it, i) => {
        const selected = it.id === value
        return (
          <button
            key={it.id}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            type="button"
            id={`${prefix}-tab-${it.id}`}
            aria-selected={selected}
            aria-controls={`${prefix}-panel-${it.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(it.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              // 44px touch height below md; tighter padding at ≤360px so 4 tabs fit without clipping
              'relative flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast sm:gap-2 sm:px-4 md:min-h-0 coarse:min-h-11',
              // High Contrast: fill the selected tab (an outline would look like the focus ring)
              selected && 'forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:[forced-color-adjust:none]',
              selected ? 'text-white' : 'text-fg-secondary hover:text-brand',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${prefix}-indicator`}
                className="absolute inset-0 rounded-md bg-brand"
                transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
              />
            )}
            <span className="relative">{it.label}</span>
            {it.meta != null && <span className={cn('relative tabular', !selected && 'text-fg-secondary')}>{it.meta}</span>}
          </button>
        )
      })}
    </div>
  )
}
