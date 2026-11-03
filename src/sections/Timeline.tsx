import { useMemo, useRef, useState, type DragEvent as RDragEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ReadyStar } from '@/components/ReadyStar'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { cn } from '@/lib/cn'
import { fmtDate, fmtDay, fmtMonth, toArabicDigits } from '@/lib/format'
import { addDays, isoDate, isOverdue, isReady, itemNumbers, packRows, parseDate, span, STATUS, statusOf, today, weekStart, type Status } from '@/lib/schedule'
import { ITEM_KINDS, type ItemKind, type Task } from '@/lib/types'

type View = 'timeline' | 'calendar'
const VIEWS: { id: View; label: string }[] = [
  { id: 'timeline', label: 'خط زمني' },
  { id: 'calendar', label: 'تقويم' },
]
// each viewer's last choice; storage can be unavailable (private mode), so never rely on it
const VIEW_KEY = 'vp:timeline-view'
const savedView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'timeline'
  } catch {
    return 'timeline'
  }
}

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

/** The dated items, seen as a timeline or as a month calendar, plus the ones without a date yet. */
export function Timeline() {
  const { state, openTask, labels, labelName, run, patchLocal } = useBoardCtx()
  const [view, setViewState] = useState<View>(savedView)
  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* the choice just isn't remembered */
    }
  }
  const [range, setRange] = useState<Range>('6')
  const now = today()
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))
  const thisMonth = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth()

  const tasks = state?.tasks ?? []
  const numbers = useMemo(() => itemNumbers(tasks), [tasks])
  // only a date the VP set puts an item on the line or the calendar; no estimated days
  const undated = tasks.filter((t) => !t.end).sort((a, b) => numbers.get(a.id)! - numbers.get(b.id)!)

  // the timeline is coloured by status; the calendar shows the CEO's items in red, events in
  // green (the VP's feedback, 2 Nov 2026) and everything else by level
  const KNOWN = ['ceo', 'evp', 'vp', 'internal', 'other']
  const extras = labels.filter((l) => !KNOWN.includes(l.id))
  const levelColor = (id: string) => {
    if (!labels.some((l) => l.id === id)) return 'var(--level-none)'
    if (KNOWN.includes(id)) return `var(--level-${id})`
    return `var(--level-extra-${(extras.findIndex((l) => l.id === id) % 3) + 1})`
  }
  const calendarColor = (t: Task) => (t.label === 'ceo' ? levelColor('ceo') : t.kind === 'event' ? 'var(--kind-event)' : levelColor(t.label))
  const legend =
    view === 'calendar'
      ? [
          ...labels.filter((l) => l.id === 'ceo').map((l) => ({ key: l.id, name: l.name, color: levelColor(l.id) })),
          { key: '__event', name: `${ITEM_KINDS.event} (غير الرئيس التنفيذي)`, color: 'var(--kind-event)' },
          ...labels.filter((l) => l.id !== 'ceo').map((l) => ({ key: l.id, name: l.name, color: levelColor(l.id) })),
          { key: '__none', name: 'بدون مستوى', color: 'var(--level-none)' },
        ]
      : (Object.keys(STATUS) as Status[]).map((k) => ({ key: k, name: STATUS[k].name, color: STATUS[k].color }))
  const colorOf = (t: Task) => (view === 'calendar' ? calendarColor(t) : STATUS[statusOf(t)].color)

  /* calendar drag and drop: onto a day sets the date, onto «بلا تاريخ بعد» clears it */
  // the ref is set the moment a drag starts, so drop targets can accept it at once; the state
  // only drives the look (faded item, highlighted target), a render later
  const dragRef = useRef<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overUndated, setOverUndated] = useState(false)
  const flipTimer = useRef<number | undefined>(undefined)
  const stopFlip = () => {
    window.clearTimeout(flipTimer.current)
    flipTimer.current = undefined
  }
  const dragProps = (t: Task) => ({
    draggable: true,
    onDragStart: (e: RDragEvent) => {
      e.dataTransfer.setData('text/plain', t.id)
      e.dataTransfer.effectAllowed = 'move'
      dragRef.current = t.id
      // after the browser has taken its drag image, so the faded copy isn't what follows the pointer
      window.setTimeout(() => setDragId(t.id), 0)
    },
    onDragEnd: () => {
      dragRef.current = null
      setDragId(null)
      setOverUndated(false)
      stopFlip()
    },
  })
  const moveTo = (id: string, iso: string) => {
    const t = tasks.find((x) => x.id === id)
    if (!t || t.end === iso) return
    patchLocal(id, { end: iso })
    void run(() => api.updateTask(id, { end: iso }), iso ? `نُقل إلى ${fmtDate(parseDate(iso)!)}` : 'أُزيل التاريخ')
  }
  // holding an item over an arrow turns the month, so it can go to any date
  const navDrag = (n: number) =>
    view === 'calendar'
      ? {
          onDragOver: (e: RDragEvent) => {
            if (!dragRef.current) return
            e.preventDefault()
            if (flipTimer.current) return
            flipTimer.current = window.setTimeout(() => {
              flipTimer.current = undefined
              shift(n)
            }, 600)
          },
          onDragLeave: stopFlip,
          onDrop: (e: RDragEvent) => e.preventDefault(),
        }
      : {}
  const dated = (id: string | null) => !!id && !!tasks.find((t) => t.id === id)?.end
  const canClear = view === 'calendar' && dated(dragId)

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line-subtle p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <Tabs label="طريقة العرض" items={VIEWS} value={view} onChange={setView} />
          <p className="text-sm text-fg-tertiary">
            {view === 'timeline' ? 'كل بند يظهر في يومه، في مسار نوعه، ولونه حالته.' : 'كل بند في يومه من الشهر: الرئيس التنفيذي بالأحمر، والفعاليات بالأخضر، وغيرها بلون مستواه.'} اضغط على أي بند لفتحه.
            {view === 'calendar' && <span className="hidden md:inline"> واسحبه إلى يوم آخر لتغيير تاريخه.</span>}
          </p>
        </div>
        {view === 'timeline' ? (
          <Tabs label="مدى الخط الزمني" items={RANGES} value={range} onChange={setRange} />
        ) : (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => shift(-1)} {...navDrag(-1)} aria-label="الشهر السابق" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line-subtle bg-surface text-fg-secondary hover:text-brand">
              <ChevronRight size={18} aria-hidden />
            </button>
            <h3 className="min-w-[132px] text-center text-md font-medium" aria-live="polite">
              {fmtMonth(month)} {toArabicDigits(month.getFullYear())}
            </h3>
            <button type="button" onClick={() => shift(1)} {...navDrag(1)} aria-label="الشهر التالي" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line-subtle bg-surface text-fg-secondary hover:text-brand">
              <ChevronLeft size={18} aria-hidden />
            </button>
            {!thisMonth && (
              <button type="button" onClick={() => setMonth(new Date(now.getFullYear(), now.getMonth(), 1))} className="ms-1 h-10 rounded-md px-3 text-sm font-medium text-brand hover:bg-brand-soft">
                اليوم
              </button>
            )}
          </div>
        )}
      </div>

      {view === 'timeline' ? <TimelineChart tasks={tasks} range={range} now={now} openTask={openTask} /> : (
        <MonthCalendar
          tasks={tasks}
          numbers={numbers}
          month={month}
          now={now}
          openTask={openTask}
          colorOf={colorOf}
          levelName={(t) => (t.label ? labelName(t.label) : 'بدون مستوى')}
          dragId={dragId}
          dragging={() => dragRef.current}
          dragProps={dragProps}
          onDrop={moveTo}
        />
      )}

      {/* no item is left out: the ones without a date yet sit in their own row (on the calendar,
          they can be dragged onto a day, and a dated item dropped here loses its date) */}
      {(undated.length > 0 || canClear) && (
        <div
          className={cn('grid grid-cols-[112px_1fr] border-t border-line-subtle md:grid-cols-[140px_1fr]', canClear && overUndated && 'bg-brand-soft ring-2 ring-inset ring-brand')}
          {...(view === 'calendar'
            ? {
                onDragOver: (e: RDragEvent) => {
                  if (!dated(dragRef.current)) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setOverUndated(true)
                },
                onDragLeave: (e: RDragEvent) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setOverUndated(false),
                onDrop: (e: RDragEvent) => {
                  const id = e.dataTransfer.getData('text/plain') || dragRef.current
                  setOverUndated(false)
                  if (!dated(id)) return
                  e.preventDefault()
                  moveTo(id!, '')
                },
              }
            : {})}
        >
          <div className="flex flex-col justify-center border-e border-line-subtle px-4 py-3">
            <span className="text-sm font-medium">بلا تاريخ بعد</span>
            <span className="text-2xs text-fg-tertiary">{items(undated.length)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 p-3" aria-label="بنود بلا تاريخ">
            {canClear && <span className="text-sm font-medium text-brand">أفلته هنا لإزالة التاريخ</span>}
            {undated.map((t) => (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => openTask(t.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openTask(t.id))}
                {...(view === 'calendar' ? dragProps(t) : {})}
                title={`${t.title}\n${t.label ? labelName(t.label) : 'بدون مستوى'} · ${STATUS[statusOf(t)].name} · ${view === 'calendar' ? 'اسحبه إلى يوم في التقويم لتحديد تاريخه' : 'حدّد التاريخ ليظهر على الخط الزمني والتقويم'}`}
                className={cn(
                  'inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border border-line-subtle bg-surface px-2.5 py-1 text-xs font-medium text-fg-primary hover:bg-brand-soft',
                  view === 'calendar' && 'md:cursor-grab',
                  dragId === t.id && 'opacity-40',
                )}
              >
                <Dot color={colorOf(t)} size={10} />
                {t.title}
                {isReady(t) && <ReadyStar size={12} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* legend: colours only (status on the timeline, level on the calendar) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-subtle px-4 py-3 text-xs text-fg-secondary md:px-5" aria-label="دليل الألوان">
        {view === 'calendar' && <span className="font-medium text-fg-primary">اللون:</span>}
        {legend.map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5">
            <Dot color={l.color} size={10} />
            {l.name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <ReadyStar size={12} />
          جاهز للإطلاق
        </span>
        <span className="inline-flex items-center gap-1.5">
          {view === 'timeline' ? <span className="h-3 border-s-[1.5px] border-dashed border-gold-500" /> : <span className="h-3 w-3 rounded-full border-2 border-fg-primary" />}
          اليوم
        </span>
      </div>
    </Card>
  )
}

/** Quarter grid in the booklet's roadmap style: time runs from the start side (right) to the left. */
function TimelineChart({ tasks, range, now, openTask }: { tasks: Task[]; range: Range; now: Date; openTask: (id: string) => void }) {
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
  }, [tasks, range, t0.getTime()])

  const nowPos = pos(now)
  const showToday = now >= t0 && now < t1

  return (
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
                        {isReady(t) && <ReadyStar size={13} />}
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
  )
}



const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const dayLong = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', { weekday: 'long', day: 'numeric', month: 'long' })
/** Items a day cell shows before «+٢ أخرى». */
const PER_DAY = 3

/**
 * One month, weeks starting on Sunday. Each item sits on the day the VP set, coloured by level;
 * dragging it to another day changes the date. On phones the grid becomes a list of the days
 * that have something.
 */
function MonthCalendar({
  tasks,
  numbers,
  month,
  now,
  openTask,
  colorOf,
  levelName,
  dragId,
  dragging,
  dragProps,
  onDrop,
}: {
  tasks: Task[]
  numbers: Map<string, number>
  month: Date
  now: Date
  openTask: (id: string) => void
  colorOf: (t: Task) => string
  levelName: (t: Task) => string
  /** the item being dragged, if any (for the look) */
  dragId: string | null
  /** the item being dragged, known from the very start of the drag (for accepting drops) */
  dragging: () => string | null
  dragProps: (t: Task) => object
  /** an item dropped on a day (YYYY-MM-DD) */
  onDrop: (id: string, iso: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  // the day under a dragged item
  const [over, setOver] = useState<string | null>(null)
  const target = dragId ? over : null
  const dropProps = (iso: string) => ({
    onDragOver: (e: RDragEvent) => {
      if (!dragging()) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (over !== iso) setOver(iso)
    },
    onDragLeave: (e: RDragEvent) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setOver((o) => (o === iso ? null : o)),
    onDrop: (e: RDragEvent) => {
      const id = e.dataTransfer.getData('text/plain') || dragging()
      setOver(null)
      if (!id) return
      e.preventDefault()
      onDrop(id, iso)
    },
  })
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) if (t.end && parseDate(t.end)) m.set(t.end, [...(m.get(t.end) ?? []), t])
    for (const list of m.values()) list.sort((a, b) => numbers.get(a.id)! - numbers.get(b.id)!)
    return m
  }, [tasks, numbers])

  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const days: Date[] = []
  for (let d = weekStart(month); d <= addDays(weekStart(last), 6); d = addDays(d, 1)) days.push(d)
  const inMonth = (d: Date) => d.getMonth() === month.getMonth()
  const todayIso = isoDate(now)
  const busy = days.filter((d) => inMonth(d) && byDay.has(isoDate(d)))

  // a tint of the level colour, with the full colour on the start edge; in the grid it can be
  // dragged to another day (a div, since browsers won't drag a <button> everywhere)
  const chip = (t: Task, draggable: boolean) => {
    const color = colorOf(t)
    return (
      <div
        key={t.id}
        role="button"
        tabIndex={0}
        onClick={() => openTask(t.id)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openTask(t.id))}
        {...(draggable ? dragProps(t) : {})}
        title={`${toArabicDigits(numbers.get(t.id)!)}. ${t.title} (${t.kind ? ITEM_KINDS[t.kind] : 'غير مصنّف'})\n${levelName(t)} · ${STATUS[statusOf(t)].name}${draggable ? '\nاسحبه إلى يوم آخر لتغيير تاريخه' : ''}`}
        className={cn(
          'flex w-full min-w-0 cursor-pointer select-none items-center gap-1.5 rounded border-s-[3px] px-1.5 py-1 text-start text-xs font-medium text-fg-primary hover:brightness-95',
          draggable && 'cursor-grab active:cursor-grabbing',
          dragId === t.id && 'opacity-40',
        )}
        style={{ borderInlineStartColor: color, background: `color-mix(in srgb, ${color} 14%, white)` }}
      >
        <span className="truncate">{t.title}</span>
        {isReady(t) && <ReadyStar size={12} />}
      </div>
    )
  }

  return (
    <div aria-label={`تقويم ${fmtMonth(month)} ${toArabicDigits(month.getFullYear())}`} role="region">
      {/* wide screens: the month grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 border-b border-line-subtle bg-neutral-25 text-center text-xs font-medium text-fg-secondary">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const iso = isoDate(d)
            const list = byDay.get(iso) ?? []
            const shown = open === iso ? list : list.slice(0, PER_DAY)
            const weekend = d.getDay() === 5 || d.getDay() === 6
            return (
              <div
                key={iso}
                aria-label={dayLong.format(d)}
                data-day={iso}
                {...dropProps(iso)}
                className={cn(
                  'flex min-h-[116px] min-w-0 flex-col gap-1 border-b border-e border-line-subtle p-1.5 transition-colors duration-fast [&:nth-child(7n)]:border-e-0',
                  !inMonth(d) ? 'bg-neutral-25' : weekend && 'bg-neutral-25/60',
                  target === iso && '!bg-brand-soft ring-2 ring-inset ring-brand',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs tabular',
                    // an outline, so today never looks like a level colour
                    iso === todayIso ? 'border-2 border-fg-primary font-bold text-fg-primary' : inMonth(d) ? 'font-medium text-fg-secondary' : 'text-fg-muted',
                  )}
                >
                  {toArabicDigits(d.getDate())}
                </span>
                {shown.map((t) => chip(t, true))}
                {list.length > PER_DAY && (
                  <button type="button" onClick={() => setOpen(open === iso ? null : iso)} className="px-1.5 text-start text-2xs font-medium text-brand hover:underline">
                    {open === iso ? 'عرض أقل' : `+${toArabicDigits(list.length - PER_DAY)} أخرى`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* phones: the days that have something, in order */}
      <ol className="divide-y divide-line-subtle md:hidden">
        {busy.map((d) => {
          const iso = isoDate(d)
          return (
            <li key={iso} className="flex gap-3 px-4 py-3">
              <span className={cn('w-24 shrink-0 text-xs', iso === todayIso ? 'font-bold text-fg-primary' : 'font-medium text-fg-secondary')}>{dayLong.format(d)}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {byDay.get(iso)!.map((t) => chip(t, false))}
              </div>
            </li>
          )
        })}
        {!busy.length && <li className="px-4 py-6 text-sm text-fg-muted">لا شيء في هذا الشهر.</li>}
      </ol>
    </div>
  )
}
