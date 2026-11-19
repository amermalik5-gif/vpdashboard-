import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, CornerDownLeft, Link2, Plus, Search, X } from 'lucide-react'
import { DateInput } from '@/components/DateInput'
import { ReadyStar } from '@/components/ReadyStar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { cn } from '@/lib/cn'
import { fmtDay, fmtWhen, toArabicDigits } from '@/lib/format'
import { STATUS, chosenStatus, daysOverdue, hasDate, isOverdue, isReady, itemNumbers, needsReason, parseDate, progressPatch, span, statusOf, statusPatch, type Status } from '@/lib/schedule'
import { ITEM_KINDS, TASK_STATUSES, type ItemKind, type Task } from '@/lib/types'

type Sort = 'order' | 'rank' | 'late' | 'end' | 'progress' | 'recent'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'order', label: 'حسب الترتيب' },
  { id: 'rank', label: 'الأهم أولًا' },
  { id: 'late', label: 'المتأخرة أولًا' },
  { id: 'end', label: 'الأقرب موعدًا' },
  { id: 'progress', label: 'الأقل إنجازًا' },
  { id: 'recent', label: 'آخر تعديل' },
]

const rank = (t: Task) => (t.priority ?? -1) + (t.urgency ?? -1)
const when = (t: Task) => (hasDate(t) ? span(t)[1].getTime() : Infinity)
/** Late first (the longest overdue on top), then slightly late. */
const lateness = (t: Task) => ({ late: 1000, 'at-risk': 1 }[statusOf(t) as string] ?? 0) + (isOverdue(t) ? daysOverdue(t) : 0)
const SORT_FN: Record<Sort, (a: Task, b: Task) => number> = {
  // the numbered order set by dragging the list beside the matrix
  order: (a, b) => a.position - b.position || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  rank: (a, b) => rank(b) - rank(a),
  late: (a, b) => lateness(b) - lateness(a) || when(a) - when(b),
  end: (a, b) => when(a) - when(b),
  progress: (a, b) => a.progress - b.progress,
  recent: (a, b) => b.updatedAt - a.updatedAt,
}

const ZERO_TO_TEN = Array.from({ length: 11 }, (_, i) => i)
const ONE_TO_TEN = ZERO_TO_TEN.slice(1)
const PROGRESS = Array.from({ length: 21 }, (_, i) => i * 5)

/** «متأخرة ٣ أيام» — red, so the item that most needs attention can't be missed. */
function Overdue({ t, className }: { t: Task; className?: string }) {
  if (!isOverdue(t)) return null
  const d = daysOverdue(t)
  return (
    <Badge tone="danger" size="xs" className={className}>
      متأخرة {d === 1 ? 'يومًا' : d === 2 ? 'يومين' : d <= 10 ? `${toArabicDigits(d)} أيام` : `${toArabicDigits(d)} يومًا`}
    </Badge>
  )
}

const Num = ({ v }: { v: number | null }) => <span className="font-ui tabular">{v == null ? '—' : toArabicDigits(v)}</span>

/**
 * The line under an item's title: the owner (red when missing: every item needs one), the sponsor,
 * what it is part of, the actual launch day and the output links (each opens in a new tab).
 */
function ItemMeta({ t, main, links = true, className }: { t: Task; main?: Task; links?: boolean; className?: string }) {
  const shown = t.links.slice(0, 3)
  return (
    <div className={cn('mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-fg-tertiary', className)}>
      {t.owner ? (
        <span>
          المسؤول: <span className="font-medium text-fg-secondary">{t.owner}</span>
        </span>
      ) : (
        <Badge tone="danger" size="xs">
          بلا مسؤول
        </Badge>
      )}
      {t.sponsor && (
        <span>
          الراعي: <span className="font-medium text-fg-secondary">{t.sponsor}</span>
        </span>
      )}
      {main && <span>جزء من «{main.title}»</span>}
      {t.actualEnd && <span className="text-success-700">أُطلق في {fmtWhen(parseDate(t.actualEnd)!)}</span>}
      {links &&
        shown.map((l, i) => (
          <a
            key={i}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            title={l.url}
            className="inline-flex max-w-[150px] items-center gap-1 rounded text-brand hover:underline"
          >
            <Link2 size={12} aria-hidden className="shrink-0" />
            <span className="truncate">{l.name || 'رابط'}</span>
          </a>
        ))}
      {links && t.links.length > shown.length && <span>+{toArabicDigits(t.links.length - shown.length)}</span>}
      {!links && t.links.length > 0 && (
        <span className="inline-flex items-center gap-1 text-brand">
          <Link2 size={12} aria-hidden />
          {toArabicDigits(t.links.length)}
        </span>
      )}
    </div>
  )
}

/* ---------- cells edited in place (plain text for visitors, who can only view) ---------- */
/** Which column groups are read-only for the signed-in account. */
const Locked = createContext({ vp: true, team: true })
const textCls = 'block min-h-9 px-2 py-2 text-sm text-fg-primary'
const cellCls =
  'h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-fg-primary transition-colors duration-fast hover:border-line-subtle hover:bg-surface focus:border-brand focus:bg-surface focus:outline-none disabled:opacity-60'

function SelectCell({
  value,
  options,
  label,
  onSave,
  className,
  team = false,
}: {
  value: string
  options: [string, string][]
  label: string
  onSave: (v: string) => void
  className?: string
  /** one of the team's columns (any signed-in account); otherwise the VP's */
  team?: boolean
}) {
  const locked = useContext(Locked)
  if (team ? locked.team : locked.vp)
    return (
      <span aria-label={label} className={cn(textCls, className)}>
        {options.find(([v]) => v === value)?.[1] ?? '—'}
      </span>
    )
  return (
    <select aria-label={label} className={cn(cellCls, 'cursor-pointer', className)} value={value} onChange={(e) => onSave(e.target.value)}>
      {options.map(([v, name]) => (
        <option key={v} value={v}>
          {name}
        </option>
      ))}
    </select>
  )
}

const numOptions = (values: number[], suffix = ''): [string, string][] => [['', '—'], ...values.map((n): [string, string] => [String(n), `${toArabicDigits(n)}${suffix}`])]

/** Free text: saved when the field loses focus or on Enter, never on every keystroke. */
function TextCell({
  value,
  label,
  placeholder,
  onSave,
  team = false,
  alert,
}: {
  value: string
  label: string
  placeholder?: string
  onSave: (v: string) => void
  /** one of the team's columns (any signed-in account); otherwise the VP's */
  team?: boolean
  /** shown in red while the cell is empty (e.g. «أضف السبب») */
  alert?: string
}) {
  const ctx = useContext(Locked)
  const locked = team ? ctx.team : ctx.vp
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])
  if (locked)
    return (
      <span aria-label={label} title={value} className={cn(textCls, 'truncate text-fg-secondary', !value && alert && 'font-medium text-danger-700')}>
        {value || alert || '—'}
      </span>
    )
  const commit = () => {
    focused.current = false
    if (draft.trim() !== value) onSave(draft.trim())
  }
  return (
    <input
      aria-label={label}
      title={value || undefined}
      className={cn(cellCls, !draft && alert && 'border-danger-200 bg-danger-50/60 placeholder:font-medium placeholder:text-danger-700')}
      value={draft}
      placeholder={!draft && alert ? alert : placeholder}
      maxLength={2000}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setDraft(value)
          focused.current = false
        }
      }}
    />
  )
}

function Progress({ t }: { t: Task }) {
  const st = STATUS[statusOf(t)]
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-sm tabular">{toArabicDigits(t.progress)}٪</span>
      <span className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-neutral-100">
        <span className="block h-full rounded-full" style={{ width: `${t.progress}%`, background: st.color }} />
      </span>
      <span className="text-xs font-medium text-fg-secondary">{st.name}</span>
    </div>
  )
}

const KIND_OPTIONS: [string, string][] = [['', '—'], ...(Object.entries(ITEM_KINDS) as [string, string][])]
const STATUS_OPTIONS = Object.entries(TASK_STATUSES) as [Status, string][]

/**
 * The wide table's scroller. When the columns don't all fit (13" laptops, tablets), a fade on the
 * far side and a short note say there is more to scroll to; the number and name stay pinned.
 */
function TableScroller({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const check = () => {
    const el = box.current
    if (!el) return
    // right-to-left: scrollLeft runs from 0 (start) to a negative end
    setMore(el.scrollWidth - el.clientWidth - Math.abs(el.scrollLeft) > 4)
  }
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="relative hidden lg:block">
      {more && <p className="px-5 pb-2 pt-1 text-2xs text-fg-tertiary">← مرّر الجدول جانبيًا لرؤية بقية الأعمدة</p>}
      <div ref={box} onScroll={check} className="overflow-x-auto">
        {children}
      </div>
      {more && <span aria-hidden className="pointer-events-none absolute inset-y-0 start-auto end-0 w-10 bg-gradient-to-r from-surface to-transparent" />}
    </div>
  )
}

export function Register() {
  const { state, labels, labelName, openTask, run, toast, patchLocal, readyOnly, setReadyOnly, canEdit, canEditAll } = useBoardCtx()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('order')
  const [sponsor, setSponsor] = useState('')
  const sponsors = useMemo(() => [...new Set((state?.tasks ?? []).map((t) => t.sponsor.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')), [state])
  const tasks = useMemo(() => {
    const needle = q.trim()
    return [...(state?.tasks ?? [])]
      .filter((t) => !readyOnly || isReady(t))
      .filter((t) => !sponsor || t.sponsor.trim() === sponsor)
      .filter(
        (t) =>
          !needle ||
          `${t.title} ${t.notes} ${t.teamNotes} ${t.owner} ${t.sponsor} ${labelName(t.label)} ${t.kind ? ITEM_KINDS[t.kind] : ''} ${STATUS[statusOf(t)].name}`.includes(needle),
      )
      .sort(SORT_FN[sort])
  }, [state, q, sort, sponsor, labelName, readyOnly])
  // the same numbers as the bubbles in the matrix
  const numbers = useMemo(() => itemNumbers(state?.tasks ?? []), [state])
  const byId = useMemo(() => new Map((state?.tasks ?? []).map((t) => [t.id, t])), [state])
  // «جزء من»: each main item is followed by its parts (in the same order); a part whose main item
  // is filtered out stays where it is, and says what it is part of
  const rows = useMemo(() => {
    const shown = new Set(tasks.map((t) => t.id))
    const parts = new Map<string, Task[]>()
    for (const t of tasks) if (t.parentId && shown.has(t.parentId)) parts.set(t.parentId, [...(parts.get(t.parentId) ?? []), t])
    const out: { t: Task; part: boolean }[] = []
    for (const t of tasks) {
      if (t.parentId && shown.has(t.parentId)) continue
      out.push({ t, part: false })
      for (const p of parts.get(t.id) ?? []) out.push({ t: p, part: true })
    }
    return out
  }, [tasks])
  const partCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of state?.tasks ?? []) if (t.parentId && byId.has(t.parentId)) m.set(t.parentId, (m.get(t.parentId) ?? 0) + 1)
    return m
  }, [state, byId])

  // every cell saves on its own: shown at once, then confirmed by the server
  const save = (t: Task, patch: Partial<Task>) => {
    patchLocal(t.id, patch)
    // a short «حُفظ» so an edit in place is seen to be saved (a failure says why instead)
    void run(() => api.updateTask(t.id, patch)).then((ok) => ok && toast('حُفظ', 'ok', 1600))
  }
  const num = (v: string) => (v === '' ? null : Number(v))

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line-subtle p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <label className="relative block md:w-72">
          <span className="sr-only">بحث في المهام والفعاليات</span>
          <Search size={16} aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
          <input className="field ps-9" type="search" placeholder="ابحث بالاسم أو المسؤول أو الحالة أو الملاحظات" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {sponsors.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-fg-secondary">
            <span className="shrink-0">الراعي</span>
            <select aria-label="تصفية حسب الراعي (المدير العام)" className="field h-10 md:w-48" value={sponsor} onChange={(e) => setSponsor(e.target.value)}>
              <option value="">الكل</option>
              {sponsors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Tabs label="ترتيب المهام والفعاليات" items={SORTS} value={sort} onChange={setSort} />
          {canEditAll && (
            <Button icon={<Plus size={18} aria-hidden />} onClick={() => openTask(null)}>
              إضافة مهمة أو فعالية
            </Button>
          )}
        </div>
      </div>

      {/* from the «جاهزة للإطلاق» tile in the summary bar */}
      {readyOnly && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle bg-brand-soft px-4 py-2.5 text-sm md:px-5">
          <ReadyStar />
          <span className="font-medium">تُعرض البنود الجاهزة للإطلاق فقط ({toArabicDigits(tasks.length)})</span>
          <button type="button" onClick={() => setReadyOnly(false)} className="ms-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-brand hover:bg-surface">
            عرض الكل
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {/* wide screens: one table, every value editable in place */}
      <Locked.Provider value={{ vp: !canEditAll, team: !canEdit }}>
      <TableScroller>
        <table className="w-full min-w-[1250px] border-collapse text-sm">
          <thead>
            <tr className="text-xs text-fg-tertiary">
              <th className="sticky start-0 z-10 w-[52px] bg-surface py-3 ps-4 text-center font-medium">#</th>
              <th className="sticky start-[52px] z-10 min-w-[190px] bg-surface py-3 pe-3 text-start font-medium">المهمة / الفعالية</th>
              <th className="w-[118px] bg-blue-50/60 py-3 text-start font-medium text-blue-700">النوع</th>
              <th className="w-[186px] bg-blue-50/60 py-3 text-start font-medium text-blue-700">المستوى</th>
              <th className="w-[66px] bg-blue-50/60 py-3 text-center font-medium text-blue-700">الأهمية</th>
              <th className="w-[66px] bg-blue-50/60 py-3 text-center font-medium text-blue-700">الاستعجال</th>
              <th className="w-[134px] bg-blue-50/60 py-3 text-start font-medium text-blue-700">التاريخ</th>
              <th className="w-[62px] py-3 text-center font-medium">الجهد</th>
              <th className="w-[80px] py-3 text-center font-medium">الإنجاز</th>
              <th className="w-[124px] py-3 text-start font-medium">الحالة</th>
              <th className="w-[56px] py-3 text-center font-medium">جاهز للإطلاق</th>
              <th className="min-w-[170px] py-3 pe-4 text-start font-medium">ملاحظات الفريق</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, part }) => {
              const estimated = !t.end && hasDate(t)
              const name = t.title
              const main = t.parentId ? byId.get(t.parentId) : undefined
              return (
                <tr key={t.id} className={cn('group border-t border-line-subtle align-middle transition-colors duration-fast hover:bg-neutral-25', part && 'border-t-line-subtle/50')}>
                  <td className="sticky start-0 z-[1] bg-surface py-2 ps-4 font-ui text-sm font-semibold tabular text-fg-secondary group-hover:bg-neutral-25">
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 text-center">{toArabicDigits(numbers.get(t.id) ?? 0)}</span>
                      <span className="block h-3 w-3 shrink-0 rounded-full" style={{ background: STATUS[statusOf(t)].color }} title={STATUS[statusOf(t)].name} />
                    </span>
                  </td>
                  <td className="sticky start-[52px] z-[1] bg-surface py-2 pe-3 shadow-[-8px_0_8px_-8px_rgba(16,24,40,0.12)] group-hover:bg-neutral-25">
                    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', part && 'ps-5')}>
                      {part && <CornerDownLeft size={14} aria-label="بند فرعي" className="-ms-5 shrink-0 text-fg-muted" />}
                      <button
                        type="button"
                        onClick={() => openTask(t.id)}
                        className="group inline-flex items-center gap-1.5 rounded-md text-start font-medium text-fg-primary hover:text-brand"
                        title="فتح كل التفاصيل"
                      >
                        {name}
                        <ChevronLeft size={14} aria-hidden className="text-fg-muted opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                      {isReady(t) && <ReadyStar size={16} />}
                      <Overdue t={t} />
                      {t.draft && (
                        <Badge tone="warning" size="xs">
                          بانتظار الموافقة
                        </Badge>
                      )}
                      {(partCount.get(t.id) ?? 0) > 0 && (
                        <Badge tone="neutral" size="xs">
                          بنود فرعية: {toArabicDigits(partCount.get(t.id)!)}
                        </Badge>
                      )}
                    </div>
                    <ItemMeta t={t} main={!part ? main : undefined} className={part ? 'ps-5' : undefined} />
                  </td>
                  <td className="bg-blue-50/30 py-2">
                    <SelectCell label={`النوع — ${name}`} value={t.kind} options={KIND_OPTIONS} onSave={(v) => save(t, { kind: v as ItemKind })} />
                  </td>
                  <td className="bg-blue-50/30 py-2">
                    <SelectCell
                      label={`المستوى — ${name}`}
                      value={t.label}
                      options={[['', '—'], ...labels.map((l): [string, string] => [l.id, l.name])]}
                      onSave={(v) => save(t, { label: v })}
                    />
                  </td>
                  <td className="bg-blue-50/30 py-2">
                    <SelectCell
                      label={`درجة الأهمية — ${name}`}
                      className="text-center font-ui tabular"
                      value={t.priority == null ? '' : String(t.priority)}
                      options={numOptions(ZERO_TO_TEN)}
                      onSave={(v) => save(t, { priority: num(v) })}
                    />
                  </td>
                  <td className="bg-blue-50/30 py-2">
                    <SelectCell
                      label={`مستوى الاستعجال — ${name}`}
                      className="text-center font-ui tabular"
                      value={t.urgency == null ? '' : String(t.urgency)}
                      options={numOptions(ZERO_TO_TEN)}
                      onSave={(v) => save(t, { urgency: num(v) })}
                    />
                  </td>
                  <td className="bg-blue-50/30 py-2">
                    {canEditAll ? (
                      <DateInput label={`التاريخ — ${name}`} look={cellCls} value={t.end} onChange={(v) => save(t, { end: v })} />
                    ) : (
                      <span aria-label={`التاريخ — ${name}`} className={textCls}>
                        {t.end ? fmtDay(parseDate(t.end)!) : '—'}
                      </span>
                    )}
                    {estimated && <p className="px-2 text-2xs text-fg-tertiary">تقديري: {fmtWhen(span(t)[1])}</p>}
                  </td>
                  <td className="py-2">
                    <SelectCell
                      team
                      label={`الجهد — ${name}`}
                      className="min-w-[60px] text-center font-ui tabular"
                      value={t.effort == null ? '' : String(t.effort)}
                      options={numOptions(ONE_TO_TEN)}
                      onSave={(v) => save(t, { effort: num(v) })}
                    />
                  </td>
                  <td className="py-2">
                    <SelectCell
                      team
                      label={`نسبة الإنجاز — ${name}`}
                      className="min-w-[76px] text-center font-ui tabular"
                      value={String(t.progress)}
                      options={[...(PROGRESS.includes(t.progress) ? [] : [[String(t.progress), `${toArabicDigits(t.progress)}٪`] as [string, string]]), ...numOptions(PROGRESS, '٪').slice(1)]}
                      onSave={(v) => save(t, progressPatch(t, Number(v)))}
                    />
                  </td>
                  <td className="py-2">
                    <SelectCell team className="min-w-[118px]" label={`الحالة — ${name}`} value={chosenStatus(t)} options={STATUS_OPTIONS} onSave={(v) => save(t, statusPatch(v as Status))} />
                  </td>
                  <td className="py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`جاهز للإطلاق — ${name}`}
                      className="h-4 w-4 cursor-pointer align-middle accent-[var(--ready-stroke)] disabled:cursor-default"
                      checked={t.ready}
                      disabled={!canEdit}
                      onChange={(e) => save(t, { ready: e.target.checked })}
                    />
                  </td>
                  <td className="py-2 pe-4">
                    <TextCell
                      team
                      label={`ملاحظات الفريق — ${name}`}
                      value={t.teamNotes}
                      placeholder="أضف آخر المستجدات"
                      alert={needsReason(t) ? 'أضف السبب' : undefined}
                      onSave={(v) => save(t, { teamNotes: v })}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableScroller>
      </Locked.Provider>

      {/* phones and tablets: cards that open the full form */}
      <ul className="divide-y divide-line-subtle lg:hidden">
        {rows.map(({ t, part }) => (
          <li key={t.id} className={cn(part && 'border-s-4 border-s-line-subtle')}>
            <button type="button" onClick={() => openTask(t.id)} className={cn('block w-full p-4 text-start hover:bg-brand-soft', part && 'ps-6')}>
              <div className="flex items-start gap-3">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: STATUS[statusOf(t)].color }} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="me-1.5 font-ui tabular text-fg-tertiary">{toArabicDigits(numbers.get(t.id) ?? 0)}.</span>
                    {t.title}
                    {isReady(t) && <ReadyStar className="ms-1.5 align-[-2px]" />}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {t.kind && (
                      <Badge tone="blue" size="xs">
                        {ITEM_KINDS[t.kind]}
                      </Badge>
                    )}
                    {t.label && (
                      <Badge tone="blue" size="xs">
                        {labelName(t.label)}
                      </Badge>
                    )}
                    <Overdue t={t} />
                    {t.draft && (
                      <Badge tone="warning" size="xs">
                        بانتظار الموافقة
                      </Badge>
                    )}
                    {(partCount.get(t.id) ?? 0) > 0 && (
                      <Badge tone="neutral" size="xs">
                        بنود فرعية: {toArabicDigits(partCount.get(t.id)!)}
                      </Badge>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-xs text-fg-tertiary">
                    <div>
                      <dt>الأهمية</dt>
                      <dd className="text-md text-fg-primary">
                        <Num v={t.priority} />
                      </dd>
                    </div>
                    <div>
                      <dt>الاستعجال</dt>
                      <dd className="text-md text-fg-primary">
                        <Num v={t.urgency} />
                      </dd>
                    </div>
                    <div>
                      <dt>الجهد</dt>
                      <dd className="text-md text-fg-primary">
                        <Num v={t.effort} />
                      </dd>
                    </div>
                    <div>
                      <dt>التاريخ</dt>
                      <dd className="text-sm text-fg-primary">{hasDate(t) ? fmtWhen(span(t)[1]) : '—'}</dd>
                    </div>
                  </dl>
                  <div className="mt-3">
                    <Progress t={t} />
                  </div>
                  <ItemMeta t={t} main={!part && t.parentId ? byId.get(t.parentId) : undefined} links={false} />
                  {t.teamNotes ? (
                    <p className="mt-2 text-xs text-fg-secondary">{t.teamNotes}</p>
                  ) : (
                    needsReason(t) && <p className="mt-2 text-xs font-medium text-danger-700">أضف السبب في ملاحظات الفريق</p>
                  )}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {!tasks.length && (
        <p className="p-8 text-center text-fg-tertiary">{readyOnly ? 'لا توجد بنود جاهزة للإطلاق بعد. علّم «جاهز للإطلاق» في البند ليظهر هنا.' : q ? 'لا شيء يطابق البحث.' : canEditAll ? 'لا توجد مهام أو فعاليات بعد. اضغط «إضافة مهمة أو فعالية» لإضافة أول بند.' : 'لا توجد مهام أو فعاليات بعد.'}</p>
      )}
      <p className="border-t border-line-subtle px-5 py-3 text-xs text-fg-tertiary">
        {canEditAll
          ? 'عدّل أي قيمة مباشرة في الجدول وتُحفظ فورًا. '
          : canEdit
            ? 'حساب الفريق يحدّث أعمدة الجهد والإنجاز والحالة وجاهز للإطلاق وملاحظات الفريق مباشرة في الجدول. '
            : 'للعرض فقط. سجّل الدخول للتعديل. '}
        الأعمدة المظللة يحددها نائب الرئيس، والجهد ونسبة الإنجاز والحالة وملاحظات الفريق يحدّثها الفريق، والحالة تحدد اللون. البند الأحمر أو البرتقالي يحتاج سببًا في ملاحظات الفريق. اضغط على الاسم لفتح كل التفاصيل.
      </p>
    </Card>
  )
}
