import { useMemo, useState } from 'react'
import { Diamond } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { useBoardCtx } from '@/lib/board'
import { fmtDate, fmtDay, fmtMonth, toArabicDigits } from '@/lib/format'
import { packRows, parseDate, span, STATUS, statusOf, today } from '@/lib/schedule'
import type { EventItem, Task } from '@/lib/types'

type Range = '3' | '6' | '12'
const RANGES: { id: Range; label: string }[] = [
  { id: '3', label: '٣ أشهر' },
  { id: '6', label: '٦ أشهر' },
  { id: '12', label: '١٢ شهرًا' },
]
const ROW_H = 34
/** Room a bar's name needs before the next item on the row, as % of the track (track ≥ 880px). */
const LABEL_MIN = 20

type Item = { s: Date; e: Date; t?: Task; ev?: EventItem }

/** Quarter grid in the booklet's roadmap style: time runs from the start side (right) to the left. */
export function Timeline() {
  const { state, labels, openTask } = useBoardCtx()
  const [range, setRange] = useState<Range>('6')
  const now = today()
  const t0 = new Date(now.getFullYear(), now.getMonth(), 1)
  const t1 = new Date(t0.getFullYear(), t0.getMonth() + Number(range), 1)
  const pos = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - t0.getTime()) / (t1.getTime() - t0.getTime())) * 100))

  const months = useMemo(() => {
    const out: Date[] = []
    for (let d = new Date(t0); d < t1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) out.push(d)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  const lanes = useMemo(() => {
    const tasks = state?.tasks ?? []
    const inRange = (o: Item) => o.e >= t0 && o.s < t1
    const evItems: Item[] = (state?.events ?? []).flatMap((ev) => {
      const d = parseDate(ev.date)
      return d ? [{ s: d, e: d, ev }] : []
    })
    const taskItems = (ids: (id: string) => boolean): Item[] =>
      tasks.filter((t) => ids(t.label)).map((t) => {
        // one point per task: its launch day (set, or estimated from start + expected time)
        const [, launch] = span(t)
        return { s: launch, e: launch, t }
      })
    const known = new Set(labels.map((l) => l.id))
    return [
      { id: '__events', name: 'الفعاليات', items: evItems.filter(inRange) },
      ...labels.map((l) => ({ id: l.id, name: l.name, items: taskItems((x) => x === l.id).filter(inRange) })),
      { id: '__none', name: 'بدون مستوى', items: taskItems((x) => !known.has(x)).filter(inRange) },
    ]
      .filter((l) => l.id !== '__none' || l.items.length)
      .map((l) => ({ ...l, rows: packRows(l.items, pos, LABEL_MIN) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, labels, range])

  const nowPos = pos(now)

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line-subtle p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <p className="text-sm text-fg-tertiary">كل مهمة تظهر في يوم إطلاقها. الدائرة المفرغة = تاريخ تقديري. اضغط على أي مهمة لفتحها.</p>
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
                    <span className="absolute inset-x-0 bottom-1.5 text-center text-xs text-fg-secondary">{fmtMonth(m)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {lanes.map((lane) => (
            <div key={lane.id} className={'grid grid-cols-[140px_1fr] border-b border-line-subtle last:border-b-0' + (lane.id === '__events' ? ' bg-brand-soft' : '')}>
              <div className={'sticky start-0 z-20 flex items-center border-e border-line-subtle px-4 text-sm font-medium ' + (lane.id === '__events' ? 'bg-brand-soft text-brand' : 'bg-surface')}>
                {lane.name}
              </div>
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
                    if (o.ev)
                      return (
                        <span
                          key={o.ev.id}
                          className="absolute flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-blue-800"
                          style={{ insetInlineStart: `calc(${pos(o.s)}% - 7px)`, top: top + 6 }}
                          title={`${o.ev.name} · ${fmtDate(o.s)}`}
                        >
                          <Diamond size={14} aria-hidden className="fill-brand text-brand" />
                          {o.ev.name}
                          <span className="font-normal text-fg-tertiary">{fmtDay(o.s)}</span>
                        </span>
                      )
                    const t = o.t!
                    const st = STATUS[statusOf(t)]
                    const estimated = !t.end
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => openTask(t.id)}
                        className="absolute flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 pe-2 text-xs font-medium text-fg-primary hover:bg-brand-soft"
                        style={{ insetInlineStart: `calc(${pos(o.s)}% - 7px)`, top: top + 4 }}
                        title={`${t.title}\nالإطلاق: ${fmtDate(o.s)}${estimated ? ' (تقديري من تاريخ البدء والمدة المتوقعة)' : ''}\nالإنجاز ${t.progress}٪`}
                      >
                        <span
                          aria-hidden
                          className="h-3.5 w-3.5 shrink-0 rounded-full border-2"
                          style={{ borderColor: st.color, background: estimated ? 'var(--surface, #fff)' : st.color, borderStyle: estimated ? 'dashed' : 'solid' }}
                        />
                        {t.title}
                        <span className="font-normal text-fg-tertiary">{fmtDay(o.s)}</span>
                        {estimated && <span className="rounded-full bg-neutral-100 px-1.5 text-2xs font-normal text-fg-secondary">تقديري</span>}
                      </button>
                    )
                  }),
                )}
                {!lane.items.length && <span className="absolute inset-y-0 start-4 flex items-center text-xs text-fg-muted">لا شيء في هذه الفترة</span>}
                {nowPos > 0 && nowPos < 100 && (
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 z-10 border-s-[1.5px] border-dashed border-gold-500" style={{ insetInlineStart: `${nowPos}%` }} />
                )}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[140px_1fr]">
            <div />
            <div className="relative h-8">
              <span className="absolute top-1.5 inline-flex translate-x-1/2 items-center gap-1.5 rounded-full border border-gold-500/40 bg-surface px-2 py-0.5 text-2xs font-medium text-fg-primary" style={{ insetInlineStart: `${nowPos}%` }}>
                <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                اليوم
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
