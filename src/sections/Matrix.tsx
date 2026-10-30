import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Card } from '@/components/ui/Card'
import { FilterChips } from '@/components/ui/FilterChips'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { cn } from '@/lib/cn'
import { toArabicDigits } from '@/lib/format'
import { STATUS, itemNumbers, spreadBubbles, statusOf, isOverdue } from '@/lib/schedule'

/* plot geometry (SVG units). RTL: urgency grows toward the LEFT, priority toward the top. */
const W = 720
const H = 560
const BOX = { x0: 20, x1: W - 52, y0: 40, y1: H - 64 }
const sx = (u: number) => BOX.x1 - (Math.min(10, Math.max(0, u)) / 10) * (BOX.x1 - BOX.x0)
const sy = (p: number) => BOX.y1 - (Math.min(10, Math.max(0, p)) / 10) * (BOX.y1 - BOX.y0)
// big enough at effort 1 to hold a two-digit number
const rad = (e: number | null) => 11 + Math.min(10, Math.max(1, e ?? 1)) * 2.7

const QUADRANTS = [
  { name: 'مهمة وطارئة', x: BOX.x0 + 2, y: BOX.y0 - 34, anchor: 'start' as const, hot: true },
  { name: 'مهمة وغير طارئة', x: BOX.x1 - 2, y: BOX.y0 - 34, anchor: 'end' as const },
  { name: 'طارئة وغير مهمة', x: BOX.x0 + 10, y: BOX.y1 - 30, anchor: 'start' as const },
  { name: 'غير مهمة وغير طارئة', x: BOX.x1 - 10, y: BOX.y1 - 30, anchor: 'end' as const },
]

export function Matrix() {
  const { state, labels, openTask, run, patchLocal } = useBoardCtx()
  const [filter, setFilter] = useState<string[]>([])
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  // the item under the pointer, in the matrix or the list beside it: both highlight it
  const [hover, setHover] = useState<string | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const tasks = state?.tasks ?? []

  // on narrow screens the 720-unit drawing shrinks: scale the text up so it stays readable
  const wrap = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setK(Math.min(1.9, Math.max(1, W / e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const placed = useMemo(() => {
    const items = tasks
      .filter((t) => t.priority != null && t.urgency != null)
      .map((t) => ({ t, x: sx(t.urgency!), y: sy(t.priority!), r: rad(t.effort) }))
      .sort((a, b) => b.r - a.r)
    return spreadBubbles(items, BOX)
  }, [tasks])
  const numbers = useMemo(() => itemNumbers(tasks), [tasks])
  const listed = [...placed].sort((a, b) => numbers.get(a.t.id)! - numbers.get(b.t.id)!)

  const unplaced = tasks.filter((t) => t.priority == null || t.urgency == null)

  const toSvg = (e: RPointerEvent) => {
    const pt = svg.current!.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const l = pt.matrixTransform(svg.current!.getScreenCTM()!.inverse())
    return { x: Math.min(BOX.x1, Math.max(BOX.x0, l.x)), y: Math.min(BOX.y1, Math.max(BOX.y0, l.y)) }
  }

  const onDown = (e: RPointerEvent, id: string) => {
    start.current = { x: e.clientX, y: e.clientY, moved: false }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    setDrag(null)
    void id
  }
  const onMove = (e: RPointerEvent, id: string) => {
    const s = start.current
    if (!s) return
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 5) return
    s.moved = true
    setDrag({ id, ...toSvg(e) })
  }
  const onUp = (e: RPointerEvent, id: string) => {
    const s = start.current
    start.current = null
    if (!s?.moved) return openTask(id)
    const p = toSvg(e)
    const urgency = Math.round(((BOX.x1 - p.x) / (BOX.x1 - BOX.x0)) * 10)
    const priority = Math.round(((BOX.y1 - p.y) / (BOX.y1 - BOX.y0)) * 10)
    setDrag(null)
    patchLocal(id, { priority, urgency })
    run(() => api.updateTask(id, { priority, urgency }), `نُقلت إلى أهمية ${toArabicDigits(priority)} واستعجال ${toArabicDigits(urgency)}`)
  }

  const counts = (id: string) => tasks.filter((t) => t.label === id).length

  return (
    <Card padding="none" className="min-w-0 p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xl font-medium">الأهمية والاستعجال</h3>
          <p className="text-sm text-fg-tertiary">الرقم = رقم البند في الجدول · حجم الفقاعة = الجهد · لونها = نسبة الإنجاز · اسحبها لتغيير ترتيبها</p>
        </div>
        <FilterChips
          label="تصفية حسب المستوى"
          allLabel="الكل"
          multiple
          value={filter}
          onChange={setFilter}
          chips={labels.map((l) => ({ id: l.id, label: l.name, count: counts(l.id) }))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div ref={wrap} className="min-w-0">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[880px] touch-none select-none"
          style={{ direction: 'ltr' }} role="group" aria-label="مصفوفة المهام حسب درجة الأهمية ومستوى الاستعجال">
          {/* quadrants */}
          <rect x={BOX.x0} y={BOX.y0} width={sx(5) - BOX.x0} height={sy(5) - BOX.y0} fill="var(--danger-50)" />
          <rect x={sx(5)} y={BOX.y0} width={BOX.x1 - sx(5)} height={sy(5) - BOX.y0} fill="var(--nwc-blue-50)" />
          <rect x={BOX.x0} y={sy(5)} width={sx(5) - BOX.x0} height={BOX.y1 - sy(5)} fill="var(--warning-50)" fillOpacity={0.6} />
          {Array.from({ length: 11 }, (_, i) => (
            <g key={i}>
              <line x1={sx(i)} x2={sx(i)} y1={BOX.y0} y2={BOX.y1} stroke="var(--neutral-200)" strokeWidth={i === 5 ? 1.5 : 0.75} strokeDasharray={i === 5 ? undefined : '3 4'} />
              <line x1={BOX.x0} x2={BOX.x1} y1={sy(i)} y2={sy(i)} stroke="var(--neutral-200)" strokeWidth={i === 5 ? 1.5 : 0.75} strokeDasharray={i === 5 ? undefined : '3 4'} />
              <text x={sx(i)} y={BOX.y1 + 18} textAnchor="middle" fontSize={11 * k} fill="var(--tertiary-500)">
                {toArabicDigits(i)}
              </text>
              <text x={BOX.x1 + 12} y={sy(i) + 4} textAnchor="start" fontSize={11 * k} fill="var(--tertiary-500)">
                {toArabicDigits(i)}
              </text>
            </g>
          ))}
          <rect x={BOX.x0} y={BOX.y0} width={BOX.x1 - BOX.x0} height={BOX.y1 - BOX.y0} fill="none" stroke="var(--neutral-200)" />
          <text x={(BOX.x0 + BOX.x1) / 2} y={H - 18} textAnchor="middle" direction="rtl" fontSize={12 * k} fontWeight={500} fill="var(--neutral-800)">
            ← مستوى الاستعجال (٠ غير طارئة · ١٠ طارئة جدًا)
          </text>
          <text x={W - 10} y={(BOX.y0 + BOX.y1) / 2} textAnchor="middle" direction="rtl" fontSize={12 * k} fontWeight={500} fill="var(--neutral-800)" transform={`rotate(90 ${W - 10} ${(BOX.y0 + BOX.y1) / 2})`}>
            درجة الأهمية ←
          </text>

          {/* bubbles, each with its item number */}
          {placed.map((p) => {
            const st = STATUS[statusOf(p.t)]
            const dim = filter.length > 0 && !filter.includes(p.t.label)
            const d = drag?.id === p.t.id ? drag : null
            const x = d ? d.x : p.x
            const y = d ? d.y : p.y
            return (
              <g
                key={p.t.id}
                className={cn('cursor-grab transition-opacity duration-base focus:outline-none', d && 'cursor-grabbing')}
                opacity={dim ? 0.25 : 1}
                tabIndex={0}
                role="button"
                aria-label={`${p.t.title}: أهمية ${p.t.priority}، استعجال ${p.t.urgency}، جهد ${p.t.effort ?? 'غير محدد'}، إنجاز ${p.t.progress}٪${isOverdue(p.t) ? '، متأخرة' : ''}`}
                onPointerEnter={() => setHover(p.t.id)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(p.t.id)}
                onBlur={() => setHover(null)}
                onPointerDown={(e) => onDown(e, p.t.id)}
                onPointerMove={(e) => onMove(e, p.t.id)}
                onPointerUp={(e) => onUp(e, p.t.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openTask(p.t.id))}
              >
                <title>{`${toArabicDigits(numbers.get(p.t.id)!)}. ${p.t.title}${isOverdue(p.t) ? ' · متأخرة' : ''}\nالأهمية ${toArabicDigits(p.t.priority ?? 0)} · الاستعجال ${toArabicDigits(p.t.urgency ?? 0)} · الجهد ${toArabicDigits(p.t.effort ?? 0)} · الإنجاز ${toArabicDigits(p.t.progress)}٪`}</title>
                {p.t.effort == null ? (
                  // no effort entered yet: a hollow outline, so it can't pass for effort 1
                  <circle cx={x} cy={y} r={p.r} fill="var(--surface, #fff)" stroke={st.color} strokeWidth={2.5} />
                ) : (
                  <circle cx={x} cy={y} r={p.r} fill={st.color} fillOpacity={0.85} stroke="#fff" strokeWidth={2} />
                )}
                {isOverdue(p.t) && <circle cx={x} cy={y} r={p.r + 2} fill="none" stroke="var(--danger-700)" strokeWidth={4} />}
                {p.t.draft && <circle cx={x} cy={y} r={p.r + 4} fill="none" stroke={st.color} strokeDasharray="3 3" strokeWidth={1.5} />}
                {hover === p.t.id && <circle cx={x} cy={y} r={p.r + 6} fill="none" stroke="var(--nwc-blue-500)" strokeWidth={2.5} />}
                <text
                  x={x}
                  y={y + 4.5 * Math.min(k, 1.4)}
                  textAnchor="middle"
                  fontSize={13 * Math.min(k, 1.4)}
                  fontWeight={700}
                  fill={p.t.effort == null ? 'var(--neutral-800)' : '#fff'}
                  pointerEvents="none"
                >
                  {toArabicDigits(numbers.get(p.t.id)!)}
                </text>
              </g>
            )
          })}

          {/* quadrant names on top, so bubbles never hide them */}
          {QUADRANTS.map((q) => (
            <g key={q.name} pointerEvents="none">
              <text
                x={q.x}
                y={q.y + 14}
                textAnchor={q.anchor}
                fontSize={13 * k}
                fontWeight={700}
                fill={q.hot ? 'var(--danger-700)' : 'var(--nwc-blue-700)'}
                stroke="#fff"
                strokeWidth={4}
                paintOrder="stroke"
                opacity={0.9}
              >
                {q.name}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* the key: number → item, in the same order as the VP's list */}
      <ol className="flex max-h-[560px] flex-col gap-0.5 overflow-y-auto lg:border-s lg:border-line-subtle lg:ps-4" aria-label="أرقام البنود في المصفوفة">
        {listed.map((p) => {
          const st = STATUS[statusOf(p.t)]
          const n = numbers.get(p.t.id)!
          return (
            <li key={p.t.id}>
              <button
                type="button"
                onClick={() => openTask(p.t.id)}
                onPointerEnter={() => setHover(p.t.id)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(p.t.id)}
                onBlur={() => setHover(null)}
                className={cn('flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-start transition-colors duration-fast', hover === p.t.id ? 'bg-brand-soft' : 'hover:bg-neutral-50')}
              >
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular"
                  style={p.t.effort == null ? { borderColor: st.color, color: 'var(--neutral-800)' } : { borderColor: st.color, background: st.color, color: '#fff' }}
                >
                  {toArabicDigits(n)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-fg-primary">{p.t.title}</span>
                  <span className="block text-2xs text-fg-tertiary">
                    أهمية {toArabicDigits(p.t.priority ?? 0)} · استعجال {toArabicDigits(p.t.urgency ?? 0)} · إنجاز {toArabicDigits(p.t.progress)}٪{isOverdue(p.t) ? ' · متأخرة' : ''}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fg-secondary">
        {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS[k].color }} />
            {STATUS[k].name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-fg-tertiary bg-surface" />
          الجهد غير محدد
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-dashed border-fg-tertiary" />
          بانتظار الموافقة
        </span>
      </div>
      {unplaced.length > 0 && (
        <p className="mt-3 text-sm text-fg-tertiary">
          لا تظهر في المصفوفة لأنها بلا درجة أهمية أو مستوى استعجال:{' '}
          {unplaced.map((t, i) => (
            <span key={t.id}>
              {i > 0 && '، '}
              <button type="button" className="text-brand underline-offset-2 hover:underline" onClick={() => openTask(t.id)}>
                {t.title}
              </button>
            </span>
          ))}
        </p>
      )}
    </Card>
  )
}
