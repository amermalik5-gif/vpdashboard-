import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { useBoardCtx } from '@/lib/board'
import { cn } from '@/lib/cn'
import { fmtDate, fmtDay, fmtMonth, toArabicDigits } from '@/lib/format'
import { isOverdue, itemNumbers, packRows, span, STATUS, statusOf, today, type Status } from '@/lib/schedule'
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

/** One lane per classification, in the VP's order; unclassified items last. */
const LANES: { id: ItemKind; name: string }[] = [
  ...(Object.entries(ITEM_KINDS) as [ItemKind, string][]).map(([id, name]) => ({ id, name })),
  { id: '', name: 'غير مصنّف' },
]

/** «بند واحد · بندان · ٣ بنود · ١١ بندًا» */
const items = (n: number) => (n === 1 ? 'بند واحد' : n === 2 ? 'بندان' : n <= 10 ? `${toArabicDigits(n)} بنود` : `${toArabicDigits(n)} بندًا`)

const Dot = ({ color, size = 14 }: { color: string; size?: number }) => <span aria-hidden className="shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />

/** The month the timeline opens on: this one, or the next when this one is nearly over. */
function firstMonth(now: Date) {
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const daysLeft = Math.round((nextMonth.getTime() - now.getTime()) / 864e5)
  return daysLeft <= 7 ? nextMonth : new Date(now.getFullYear(), now.getMonth(), 1)
}

/** Quarter grid in the booklet's roadmap style: time runs from the start side (right) to the left. */
export function Timeline() {
  const { state, openTask } = useBoardCtx()
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
  const numbers = useMemo(() => itemNumbers(tasks), [tasks])
  // only a date the VP set puts an item on the line; no estimated days
  const undated = tasks.filter((t) => !t.end).sort((a, b) => numbers.get(a.id)! - numbers.get(b.id)!)

  const lanes = useMemo(() => {
    // one point per item, on the day the VP set.
    // Overdue items dated before the range stay visible, pinned at the range's start.
    const items: Item[] = tasks.filter((t) => !!t.end).flatMap((t) => {
      const [, day] = span(t)
      const s = isOverdue(t, now) && day < t0 ? t0 : day
      return s >= t0 && s < t1 ? [{ s, t }] : []
    })
    // only lanes with something in this period, so the chart stays uncluttered
    return LANES.map((l) => ({ ...l, items: items.filter((o) => (o.t.kind in ITEM_KINDS ? o.t.kind : '') === l.id) }))
      .filter((l) => l.items.length)
      .map((l) => ({ ...l, rows: packRows(l.items, extent) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, range, t0.getTime()])

  const nowPos = pos(now)
  const showToday = now >= t0 && now < t1

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line-subtle p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <p className="text-sm text-fg-tertiary">كل بند يظهر في يومه، في مسار نوعه، ولونه حالته. اضغط على أي بند لفتحه.</p>
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

          {!lanes.length && <p className="px-5 py-6 text-sm text-fg-muted">لا شيء في هذه الفترة.</p>}
          {lanes.map((lane) => (
            <div key={lane.id || '__none'} className="grid grid-cols-[140px_1fr] border-b border-line-subtle last:border-b-0">
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
                    const kindName = t.kind ? ITEM_KINDS[t.kind] : 'غير مصنّف'
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
                        title={`${t.title} (${kindName})\nالتاريخ: ${fmtDate(span(t)[1])}\n${st.name}`}
                      >
                        <Dot color={st.color} />
                        {t.title}
                        <span className="font-normal text-fg-tertiary">{fmtDay(span(t)[1])}</span>
                        {isOverdue(t, now) && <span className="rounded-full bg-danger-50 px-1.5 text-2xs font-medium text-danger-700">متأخرة</span>}
                      </button>
                    )
                  }),
                )}
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

      {/* no item is left out: the ones without a date yet sit in their own row */}
      {undated.length > 0 && (
        <div className="grid grid-cols-[112px_1fr] border-t border-line-subtle md:grid-cols-[140px_1fr]">
          <div className="flex flex-col justify-center border-e border-line-subtle px-4 py-3">
            <span className="text-sm font-medium">بلا تاريخ بعد</span>
            <span className="text-2xs text-fg-tertiary">{items(undated.length)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 p-3" aria-label="بنود بلا تاريخ">
            {undated.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openTask(t.id)}
                title={`${t.title}\n${STATUS[statusOf(t)].name} · حدّد التاريخ ليظهر على الخط الزمني`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-subtle bg-surface px-2.5 py-1 text-xs font-medium text-fg-primary hover:bg-brand-soft"
              >
                <Dot color={STATUS[statusOf(t)].color} size={10} />
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* legend: colours only */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-subtle px-4 py-3 text-xs text-fg-secondary md:px-5">
        {(Object.keys(STATUS) as Status[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <Dot color={STATUS[k].color} size={10} />
            {STATUS[k].name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 border-s-[1.5px] border-dashed border-gold-500" />
          اليوم
        </span>
      </div>
    </Card>
  )
}
