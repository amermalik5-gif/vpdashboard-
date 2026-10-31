import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Card } from '@/components/ui/Card'
import { FilterChips } from '@/components/ui/FilterChips'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { cn } from '@/lib/cn'
import { toArabicDigits } from '@/lib/format'
import { STATUS, itemNumbers, spreadBubbles, statusOf } from '@/lib/schedule'
import type { Task } from '@/lib/types'

/* plot geometry (SVG units). RTL: urgency grows toward the LEFT, priority toward the top. */
const W = 720
const PLOT_H = 560
const BOX = { x0: 20, x1: W - 52, y0: 40, y1: PLOT_H - 64 }
/* the tray under the plot: items without importance or urgency yet, waiting to be dragged in */
const TRAY = { y: PLOT_H + 8, head: 30, row: 46, pad: 12, step: 44 }
const PER_ROW = Math.floor((BOX.x1 - BOX.x0 - 2 * TRAY.pad) / TRAY.step)
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
  const byNumber = (a: Task, b: Task) => numbers.get(a.id)! - numbers.get(b.id)!
  // the VP said no item may be missing: unscored ones wait in the tray, in list order
  const tray = useMemo(
    () =>
      tasks
        .filter((t) => t.priority == null || t.urgency == null)
        .sort(byNumber)
        .map((t, i) => ({
          t,
          x: BOX.x1 - TRAY.pad - TRAY.step / 2 - (i % PER_ROW) * TRAY.step,
          y: TRAY.y + TRAY.head + TRAY.row / 2 + Math.floor(i / PER_ROW) * TRAY.row,
          r: Math.min(rad(t.effort), 19),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, numbers],
  )
  const trayH = tray.length ? TRAY.head + Math.ceil(tray.length / PER_ROW) * TRAY.row + 8 : 0
  const H = PLOT_H + (tray.length ? trayH + 16 : 0)
  const listed = [...tasks].sort(byNumber)

  const toSvg = (e: RPointerEvent) => {
    const pt = svg.current!.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const l = pt.matrixTransform(svg.current!.getScreenCTM()!.inverse())
    return { x: Math.min(W, Math.max(0, l.x)), y: Math.min(H, Math.max(0, l.y)) }
  }
  const inBox = (p: { x: number; y: number }) => p.x >= BOX.x0 && p.x <= BOX.x1 && p.y >= BOX.y0 && p.y <= BOX.y1
  const clamp = (p: { x: number; y: number }) => ({ x: Math.min(BOX.x1, Math.max(BOX.x0, p.x)), y: Math.min(BOX.y1, Math.max(BOX.y0, p.y)) })

  const onDown = (e: RPointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, moved: false }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    setDrag(null)
  }
  const onMove = (e: RPointerEvent, id: string, scored: boolean) => {
    const s = start.current
    if (!s) return
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 5) return
    s.moved = true
    const p = toSvg(e)
    setDrag({ id, ...(scored ? clamp(p) : p) })
  }
  const onUp = (e: RPointerEvent, id: string, scored: boolean) => {
    const s = start.current
    start.current = null
    if (!s?.moved) return openTask(id)
    setDrag(null)
    const raw = toSvg(e)
    // an item from the tray only gets values when it is dropped on the plot
    if (!scored && !inBox(raw)) return
    const p = clamp(raw)
    const urgency = Math.round(((BOX.x1 - p.x) / (BOX.x1 - BOX.x0)) * 10)
    const priority = Math.round(((BOX.y1 - p.y) / (BOX.y1 - BOX.y0)) * 10)
    patchLocal(id, { priority, urgency })
    run(() => api.updateTask(id, { priority, urgency }), `نُقلت إلى أهمية ${toArabicDigits(priority)} واستعجال ${toArabicDigits(urgency)}`)
  }

  /** One numbered bubble: colour = status, size = effort. */
  const bubble = (b: { t: Task; x: number; y: number; r: number }, scored: boolean) => {
    const t = b.t
    const st = STATUS[statusOf(t)]
    const dim = filter.length > 0 && !filter.includes(t.label)
    const d = drag?.id === t.id ? drag : null
    const x = d ? d.x : b.x
    const y = d ? d.y : b.y
    const n = toArabicDigits(numbers.get(t.id)!)
    return (
      <g
        key={t.id}
        className={cn('cursor-grab transition-opacity duration-base focus:outline-none', d && 'cursor-grabbing')}
        opacity={dim ? 0.25 : 1}
        tabIndex={0}
        role="button"
        aria-label={scored ? `${t.title}: أهمية ${t.priority}، استعجال ${t.urgency}، ${st.name}` : `${t.title}: لم تُقيَّم بعد، ${st.name}`}
        onPointerEnter={() => setHover(t.id)}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(t.id)}
        onBlur={() => setHover(null)}
        onPointerDown={onDown}
        onPointerMove={(e) => onMove(e, t.id, scored)}
        onPointerUp={(e) => onUp(e, t.id, scored)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openTask(t.id))}
      >
        <title>{`${n}. ${t.title} · ${st.name}\n${scored ? `الأهمية ${toArabicDigits(t.priority ?? 0)} · الاستعجال ${toArabicDigits(t.urgency ?? 0)}` : 'لم تُقيَّم بعد: اسحبها إلى المصفوفة'}`}</title>
        <circle cx={x} cy={y} r={b.r} fill={st.color} stroke="#fff" strokeWidth={2} />
        {hover === t.id && <circle cx={x} cy={y} r={b.r + 5} fill="none" stroke="var(--nwc-blue-500)" strokeWidth={2.5} />}
        <text x={x} y={y + 4.5 * Math.min(k, 1.4)} textAnchor="middle" fontSize={13 * Math.min(k, 1.4)} fontWeight={700} fill="#fff" pointerEvents="none">
          {n}
        </text>
      </g>
    )
  }

  const counts = (id: string) => tasks.filter((t) => t.label === id).length

  return (
    <Card padding="none" className="min-w-0 p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xl font-medium">الأهمية والاستعجال</h3>
          <p className="text-sm text-fg-tertiary">الرقم = رقم البند في الجدول · الحجم = الجهد · اللون = الحالة · اسحب الفقاعة لتغيير موقعها</p>
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
          <text x={(BOX.x0 + BOX.x1) / 2} y={PLOT_H - 18} textAnchor="middle" direction="rtl" fontSize={12 * k} fontWeight={500} fill="var(--neutral-800)">
            ← مستوى الاستعجال (٠ غير طارئة · ١٠ طارئة جدًا)
          </text>
          <text x={W - 10} y={(BOX.y0 + BOX.y1) / 2} textAnchor="middle" direction="rtl" fontSize={12 * k} fontWeight={500} fill="var(--neutral-800)" transform={`rotate(90 ${W - 10} ${(BOX.y0 + BOX.y1) / 2})`}>
            درجة الأهمية ←
          </text>

          {/* bubbles, each with its item number */}
          {placed.map((p) => bubble(p, true))}

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

          {tray.length > 0 && (
            <g>
              <rect x={BOX.x0} y={TRAY.y} width={BOX.x1 - BOX.x0} height={trayH} rx={10} fill="var(--neutral-25, #fafbfc)" stroke="var(--neutral-200)" strokeDasharray="4 4" />
              <text x={BOX.x1 - TRAY.pad} y={TRAY.y + 20} textAnchor="start" direction="rtl" fontSize={12 * k} fontWeight={500} fill="var(--neutral-800)">
                لم تُقيَّم بعد ({toArabicDigits(tray.length)}){k > 1.3 ? ' — اسحبها إلى المصفوفة' : ' — اسحب أيًّا منها إلى المصفوفة لتحديد أهميتها واستعجالها'}
              </text>
              {tray.filter((b) => drag?.id !== b.t.id).map((b) => bubble(b, false))}
            </g>
          )}
          {/* the bubble being dragged out of the tray, above everything */}
          {tray.filter((b) => drag?.id === b.t.id).map((b) => bubble(b, false))}
        </svg>
      </div>

      {/* the key: number → item, every item in the same order as the VP's list */}
      <ol className="flex max-h-[680px] flex-col overflow-y-auto lg:border-s lg:border-line-subtle lg:ps-4" aria-label="أرقام البنود في المصفوفة">
        {listed.map((t) => {
          const st = STATUS[statusOf(t)]
          const unscored = t.priority == null || t.urgency == null
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => openTask(t.id)}
                onPointerEnter={() => setHover(t.id)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(t.id)}
                onBlur={() => setHover(null)}
                className={cn('flex w-full items-center gap-2.5 rounded-md px-2 py-1 text-start transition-colors duration-fast', hover === t.id ? 'bg-brand-soft' : 'hover:bg-neutral-50')}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular text-white" style={{ background: st.color }}>
                  {toArabicDigits(numbers.get(t.id)!)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg-primary">{t.title}</span>
                {unscored && <span className="shrink-0 text-2xs text-fg-tertiary">لم تُقيَّم</span>}
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
      </div>
    </Card>
  )
}
