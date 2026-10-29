import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import pattern from '@/assets/brand/bg-pattern.webp'
import { Button } from '@/components/ui/Button'
import { useBoardCtx } from '@/lib/board'
import { animate, useReducedMotion } from '@/lib/motion'
import { fmtDate, toArabicDigits } from '@/lib/format'
import { addDays, isOpen, span, today } from '@/lib/schedule'

function CountUp({ to }: { to: number }) {
  const reduce = useReducedMotion()
  const [v, setV] = useState(reduce ? to : 0)
  const from = useRef(0)
  useEffect(() => {
    if (reduce) return setV(to)
    const c = animate(from.current, to, { duration: 1.2, ease: [0.2, 0.7, 0.2, 1], onUpdate: (x) => setV(Math.round(x)) })
    from.current = to
    return () => c.stop()
  }, [to, reduce])
  return (
    <>
      <span aria-hidden>{toArabicDigits(v)}</span>
      <span className="sr-only">{toArabicDigits(to)}</span>
    </>
  )
}

export function Hero() {
  const { state, openTask } = useBoardCtx()
  const tasks = state?.tasks ?? []
  const open = tasks.filter(isOpen)
  const now = today()
  const soon = addDays(now, 14)
  const stats = [
    { n: open.length, name: 'مهمة مفتوحة' },
    { n: open.filter((t) => (t.priority ?? 0) >= 6 && (t.urgency ?? 0) >= 6).length, name: 'مهمة وملحّة (٦ فأكثر)' },
    { n: open.filter((t) => t.progress < 20).length, name: 'إنجازها أقل من ٢٠٪' },
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
    <section id="top" data-tone="dark" className="relative isolate overflow-hidden bg-brand-gradient pb-12 pt-[calc(var(--header-h)+40px)] text-white md:pb-16 md:pt-[calc(var(--header-h)+56px)]">
      <div aria-hidden className="pattern-watermark absolute inset-0 -z-10 opacity-[0.07]" style={{ ['--pattern-url' as string]: `url(${pattern})` }} />
      <div className="container-page">
        <p className="mb-3 text-sm font-medium text-blue-100">مكتب نائب الرئيس │ محدَّثة حتى {fmtDate(now)}</p>
        <h1 className="display-fluid max-w-3xl font-bold">لوحة أولويات نائب الرئيس</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/85">
          المهام والفعاليات في مكان واحد: يحدّد نائب الرئيس الأولوية والإلحاح والمدة المتوقعة، ويحدّث الفريق الجهد ونسبة الإنجاز، فتظهر الصورة كاملة في المصفوفة والخط الزمني ومؤشر الطاقة.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="onbrand" icon={<Plus size={18} aria-hidden />} onClick={() => openTask(null)}>
            إضافة مهمة
          </Button>
          {drafts > 0 && (
            <a href="#register" className="inline-flex h-11 items-center rounded-md border border-white/30 px-4 text-sm font-medium text-white hover:bg-white/10">
              {toArabicDigits(drafts)} بانتظار تأكيد نائب الرئيس
            </a>
          )}
        </div>
        <dl className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {stats.map((s) => (
            <div key={s.name} className="rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm md:p-5">
              <dt className="sr-only">{s.name}</dt>
              <dd className="text-display-md font-medium tabular md:text-display-lg">{state ? <CountUp to={s.n} /> : '–'}</dd>
              <dd className="mt-1 text-sm text-white/80">{s.name}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
