import { Plus } from 'lucide-react'
import pattern from '@/assets/brand/bg-pattern.webp'
import { useBoardCtx } from '@/lib/board'
import { cn } from '@/lib/cn'
import { fmtDate, toArabicDigits } from '@/lib/format'
import { addDays, isOpen, span, today } from '@/lib/schedule'

/**
 * Slim summary bar under the header: title, as-of date, the four numbers the VP checks
 * first, and the main action. Keeps the booklet's navy + pattern, without a full hero.
 */
export function Hero() {
  const { state, openTask } = useBoardCtx()
  const tasks = state?.tasks ?? []
  const open = tasks.filter(isOpen)
  const now = today()
  const soon = addDays(now, 14)
  const stats = [
    { n: open.length, name: 'مفتوحة' },
    { n: open.filter((t) => (t.priority ?? 0) >= 6 && (t.urgency ?? 0) >= 6).length, name: 'مهمة وملحّة', hot: true },
    { n: open.filter((t) => t.progress < 20).length, name: 'إنجاز أقل من ٢٠٪', hot: true },
    {
      n: open.filter((t) => {
        const [, e] = span(t)
        return e >= now && e <= soon
      }).length,
      name: 'تنتهي خلال ١٤ يومًا',
    },
  ]
  const drafts = tasks.filter((t) => t.draft).length

  return (
    <section id="top" data-tone="dark" className="relative isolate overflow-hidden bg-blue-900 pb-5 pt-[calc(var(--header-h)+16px)] text-white">
      <div aria-hidden className="pattern-watermark absolute inset-0 -z-10 opacity-[0.06]" style={{ ['--pattern-url' as string]: `url(${pattern})` }} />
      <div className="container-page flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-display-xs font-medium">لوحة أولويات نائب الرئيس</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-blue-200">
            <span>محدَّثة حتى {fmtDate(now)}</span>
            {drafts > 0 && (
              <a href="#register" className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/50 px-2.5 py-0.5 text-xs font-medium text-gold-500 hover:bg-white/5">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                {toArabicDigits(drafts)} بانتظار تأكيد نائب الرئيس
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:gap-3">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.name} className="min-w-0 rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 md:min-w-[118px]">
                <dt className="text-2xs leading-tight text-white/75">{s.name}</dt>
                <dd className={cn('text-xl font-medium tabular', s.hot && s.n > 0 && 'text-warning-400')}>{state ? toArabicDigits(s.n) : '–'}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={() => openTask(null)}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-brand transition-colors duration-fast hover:bg-blue-50"
          >
            <Plus size={18} aria-hidden />
            إضافة مهمة
          </button>
        </div>
      </div>
    </section>
  )
}
