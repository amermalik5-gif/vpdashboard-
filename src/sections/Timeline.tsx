import { useMemo, useState, type CSSProperties } from 'react'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { useBoardCtx } from '@/lib/board'
import { cn } from '@/lib/cn'
import { fmtDate, fmtDay, fmtMonth, toArabicDigits } from '@/lib/format'
import { hasDate, isOverdue, packRows, span, STATUS, statusOf, today, type Status } from '@/lib/schedule'
import { ITEM_KINDS, type ItemKind, type Task } from '@/lib/types'

type Range = '3' | '6' | '12'
const RANGES: { id: Range; label: string }[] = [
  { id: '3', label: '٣ أشهر' },
  { id: '6', label: '٦ أشهر' },
  { id: '12', label: '١٢ شهرًا' },
]
const ROW_H = 34
/** Room a marker's name needs before the next item on the row, as % of the track (track ≥ 880px). */
const LABEL_MIN = 20

type Item = { s: Date; t: Task }

/** Event = square, launch = circle, anything else = diamond; colour = progress, hollow = estimated date. */
function Marker({ kind, color, estimated, size = 14 }: { kind: ItemKind; color: string; estimated?: boolean; size?: number }) {
  const style: CSSProperties = { width: size, height: size, borderColor: color, background: estimated ? 'var(--surface, #fff)' : color, borderStyle: estimated ? 'dashed' : 'solid' }
  if (kind === 'event') return <span aria-hidden className="shrink-0 rounded-[3px] border-2" style={style} />
  if (kind === 'launch') return <span aria-hidden className="shrink-0 rounded-full border-2" style={style} />
  return <span aria-hidden className="shrink-0 rotate-45 rounded-[2px] border-2" style={{ ...style, width: size - 3, height: size - 3, marginInline: 1.5 }} />
}

/** The month the timeline opens on: this one, or the next when this one is nearly over. */
function firstMonth(now: Date) {
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const daysLeft = Math.round((nextMonth.getTime() - now.getTime()) / 864e5)
  return daysLeft <= 7 ? nextMonth : new Date(now.getFullYear(), now.getMonth(), 1)
}

/** Quarter grid in the booklet's roadmap style: time runs from the start side (right) to the left. */
export function Timeline() {
  const { state, labels, openTask } = useBoardCtx()
  const [range, setRange] = useState<Range>('6')
  const now = today()
  const t0 = firstMonth(now)
  const t1 = new Date(t0.getFullYear(), t0.getMonth() + Number(range), 1)
  const pos = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - t0.getTime()) / (t1.getTime() - t0.getTime())) * 100))

  const months = useMemo(() => {
    const out: Date[] = []
    for (let d = new Date(t0); d < t1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) out.push(d)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, t0.getTime()])

  // labels run toward the end of time; near the far edge they flip back so they're never clipped
  const flip = (d: Date) => pos(d) > 100 - LABEL_MIN
  const extent = (o: Item): [number, number] => (flip(o.s) ? [pos(o.s) - LABEL_MIN, pos(o.s)] : [pos(o.s), pos(o.s) + LABEL_MIN])

  const tasks = state?.tasks ?? []
  const undated = tasks.filter((t) => !hasDate(t))

  const lanes = useMemo(() => {
    // one point per item, on its day (set by the VP, or estimated from start + expected time).
    // Overdue items dated before the range stay visible, pinned at the range's start.
    const items: (Item & { label: string })[] = tasks.filter(hasDate).flatMap((t) => {
      const [, day] = span(t)
      const s = isOverdue(t, now) && day < t0 ? t0 : day
      return s >= t0 && s < t1 ? [{ s, t, label: t.label }] : []
    })
    const known = new Set(labels.map((l) => l.id))
    return [
      ...labels.map((l) => ({ id: l.id, name: l.name, items: items.filter((o) => o.label === l.id) })),
      { id: '__none', name: 'بدون مستوى', items: items.filter((o) => !known.has(o.label)) },
    ]
      .filter((l) => l.id !== '__none' || l.items.length)
      .map((l) => ({ ...l, rows: packRows(l.items, extent) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, labels, range, t0.getTime()])

  const nowPos = pos(now)
  const showToday = now >= t0 && now < t1

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line-subtle p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <p className="text-sm text-fg-tertiary">كل مهمة أو فعالية تظهر في يومها، في مسار مستواها. اضغط على أي بند لفتحه.</p>
        <Tabs label="مدى الخط الزمني" items={RANGES} value={range} onChange={setRange} />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[1020px]">
          {/* month header */}
          <div className="grid grid-cols-[140px_1fr] border-b border-line-subtle bg-neutral-25">
            <div className="sticky start-0 z-20 bg-neutral-25" />
            <div className="relative h-12">
              {months.map((m) => {
                const s = pos(m)
                const e = pos(new Date(m.getFullYear(), m.getMonth() + 1, 1))
                const q = m.getMonth() % 3 === 0
                return (
                  <div key={m.toISOString()} className="absolute inset-y-0" style={{ insetInlineStart: `${s}%`, width: `${e - s}%` }}>
                    {q && (
                      <span className="absolute start-1.5 top-1 font-ui text-2xs font-semibold text-brand">
                        <bdi dir="ltr">Q{m.getMonth() / 3 + 1}</bdi> {toArabicDigits(m.getFullYear())}
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-1.5 text-center text-sm font-medium text-fg-secondary">{fmtMonth(m)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {lanes.map((lane) => (
            <div key={lane.id} className="grid grid-cols-[140px_1fr] border-b border-line-subtle last:border-b-0">
              <div className="sticky start-0 z-20 flex items-center border-e border-line-subtle bg-surface px-4 text-sm font-medium">{lane.name}</div>
              <div className="relative py-2" style={{ minHeight: Math.max(1, lane.rows.length) * ROW_H + 16 }}>
                {/* month and quarter lines */}
                {months.map((m) => (
                  <span
                    key={m.toISOString()}
                    aria-hidden
                    className={m.getMonth() % 3 === 0 ? 'absolute inset-y-0 border-s border-neutral-300' : 'absolute inset-y-0 border-s border-dashed border-neutral-200'}
                    style={{ insetInlineStart: `${pos(m)}%` }}
                  />
                ))}
                {lane.rows.map((row, ri) =>
                  row.map((o) => {
                    const top = 8 + ri * ROW_H
                    const t = o.t
                    const st = STATUS[statusOf(t)]
                    const estimated = !t.end
                    const kindName = t.kind ? ITEM_KINDS[t.kind] : 'بند'
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => openTask(t.id)}
                        className={cn(
                          'absolute flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 text-xs font-medium text-fg-primary hover:bg-brand-soft',
                          flip(o.s) ? 'flex-row-reverse ps-2' : 'pe-2',
                        )}
                        style={{ ...(flip(o.s) ? { insetInlineEnd: `calc(${100 - pos(o.s)}% - 7px)` } : { insetInlineStart: `calc(${pos(o.s)}% - 7px)` }), top: top + 4 }}
                        title={`${t.title} (${kindName})\nالتاريخ: ${fmtDate(span(t)[1])}${estimated ? ' (تقديري)' : ''}\nالإنجاز ${t.progress}٪`}
                      >
                        <Marker kind={t.kind} color={st.color} estimated={estimated} />
                        {t.title}
                        <span className="font-normal text-fg-tertiary">{fmtDay(span(t)[1])}</span>
                        {estimated && <span className="rounded-full bg-neutral-100 px-1.5 text-2xs font-normal text-fg-secondary">تقديري</span>}
                        {isOverdue(t, now) && <span className="rounded-full bg-danger-50 px-1.5 text-2xs font-medium text-danger-700">متأخرة</span>}
                      </button>
                    )
                  }),
                )}
                {!lane.items.length && <span className="absolute inset-y-0 start-4 flex items-center text-xs text-fg-muted">لا شيء في هذه الفترة</span>}
                {showToday && (
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 z-10 border-s-[1.5px] border-dashed border-gold-500" style={{ insetInlineStart: `${nowPos}%` }} />
                )}
              </div>
            </div>
          ))}
          {showToday && (
            <div className="grid grid-cols-[140px_1fr]">
              <div />
              <div className="relative h-8">
                <span className="absolute top-1.5 inline-flex translate-x-1/2 items-center gap-1.5 rounded-full border border-gold-500/40 bg-surface px-2 py-0.5 text-2xs font-medium text-fg-primary" style={{ insetInlineStart: `${nowPos}%` }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                  اليوم
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* legend: what the shapes and colours mean */}
      <div className="flex flex-col gap-3 border-t border-line-subtle px-4 py-3 text-xs text-fg-secondary md:px-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-medium text-fg-primary">الشكل:</span>
          {(['event', 'launch', 'other'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <Marker kind={k} color="var(--neutral-500)" size={12} />
              {ITEM_KINDS[k]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <Marker kind="launch" color="var(--neutral-500)" estimated size={12} />
            تاريخ تقديري
          </span>
          <span className="ms-2 font-medium text-fg-primary">اللون (نسبة الإنجاز):</span>
          {(Object.keys(STATUS) as Status[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS[k].color }} />
              {STATUS[k].name}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full bg-danger-50 px-1.5 text-2xs font-medium text-danger-700">متأخرة</span>
            فات موعدها
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 border-s-[1.5px] border-dashed border-gold-500" />
            اليوم
          </span>
        </div>
        {undated.length > 0 && (
          <p>
            بلا تاريخ ({toArabicDigits(undated.length)}):{' '}
            {undated.map((t, i) => (
              <span key={t.id}>
                {i > 0 && '، '}
                <button type="button" className="text-brand underline-offset-2 hover:underline" onClick={() => openTask(t.id)}>
                  {t.title}
                </button>
              </span>
            ))}{' '}
            — حدّد التاريخ من الجدول ليظهر هنا.
          </p>
        )}
      </div>
    </Card>
  )
}
