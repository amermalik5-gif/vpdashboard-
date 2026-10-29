import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface Chip<T extends string> {
  id: T
  label: ReactNode
  /** Small leading marker (e.g. a colour dot) */
  marker?: ReactNode
  count?: number
}

interface FilterChipsProps<T extends string> {
  chips: Chip<T>[]
  /** Selected ids. Empty array = "all". */
  value: T[]
  onChange: (next: T[]) => void
  multiple?: boolean
  label: string
  /** Show a leading «الكل» chip that clears the selection */
  allLabel?: string
  className?: string
}

/** Toggle-button filter chips (aria-pressed), DS capsule styling. */
export function FilterChips<T extends string>({ chips, value, onChange, multiple = false, label, allLabel, className }: FilterChipsProps<T>) {
  const toggle = (id: T) => {
    const on = value.includes(id)
    if (multiple) onChange(on ? value.filter((v) => v !== id) : [...value, id])
    else onChange(on ? [] : [id])
  }
  const chipCls = (active: boolean) =>
    cn(
      // 44px touch height below md (DS 36px from md up)
      'inline-flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors duration-fast md:h-9 coarse:h-11',
      // Windows High Contrast drops backgrounds: fill the selected chip with Highlight
      // (an outline would look like the focus ring)
      active && 'forced-colors:border-[Highlight] forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:[forced-color-adjust:none]',
      active ? 'border-brand bg-brand text-white' : 'border-line-subtle bg-surface text-fg-secondary hover:border-blue-200 hover:text-brand',
    )

  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {allLabel && (
        <button type="button" aria-pressed={value.length === 0} onClick={() => onChange([])} className={chipCls(value.length === 0)}>
          {allLabel}
        </button>
      )}
      {chips.map((c) => {
        const active = value.includes(c.id)
        // a chip whose count is 0 can't narrow anything — keep it visible but inert (unless already active)
        const empty = c.count === 0 && !active
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={active}
            disabled={empty}
            onClick={() => toggle(c.id)}
            className={cn(chipCls(active), empty && 'cursor-not-allowed opacity-40')}
          >
            {c.marker}
            <span>{c.label}</span>
            {c.count != null && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular',
                  // active pill: white on brand-800 (≥4.5:1); never a translucent white tint over brand
                  active ? 'bg-blue-800 text-white' : 'bg-neutral-100 text-fg-secondary',
                )}
              >
                {c.count.toLocaleString('ar-SA')}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
