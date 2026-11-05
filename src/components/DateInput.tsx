import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { fmtWhen } from '@/lib/format'
import { parseDate } from '@/lib/schedule'

/**
 * A date written the Arabic way («١٩ نوفمبر»), whatever the browser's language. The browser's own
 * date input lies transparently on top, so a click or tap opens its picker and the keyboard still
 * works; ✕ clears the date.
 */
export function DateInput({ id, value, onChange, label, look, disabled }: { id?: string; value: string; onChange: (v: string) => void; label?: string; look: string; disabled?: boolean }) {
  const d = value ? parseDate(value) : null
  return (
    <div className="relative">
      <input
        id={id}
        type="date"
        aria-label={label}
        disabled={disabled}
        value={value}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        onClick={(e) => {
          try {
            e.currentTarget.showPicker()
          } catch {
            /* the browser opens its own picker */
          }
        }}
        onChange={(e) => {
          const v = e.target.value
          if (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v)) onChange(v)
        }}
      />
      {/* the face follows the real input, also when a surrounding fieldset locks it */}
      <span
        aria-hidden
        className={cn(look, 'pointer-events-none flex items-center peer-focus-visible:border-brand peer-focus-visible:bg-surface peer-disabled:bg-neutral-50 peer-disabled:text-fg-muted', value && !disabled && 'pe-8')}
      >
        {d ? fmtWhen(d) : <span className="text-fg-muted">—</span>}
      </span>
      {value && !disabled && (
        <button
          type="button"
          aria-label={label ? `إزالة ${label}` : 'إزالة التاريخ'}
          title="إزالة التاريخ"
          onClick={() => onChange('')}
          className="absolute end-1.5 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-fg-muted hover:bg-neutral-100 hover:text-fg-primary disabled:hidden"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  )
}
