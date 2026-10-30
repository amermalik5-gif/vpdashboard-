import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Plus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { cn } from '@/lib/cn'
import { fmtDay, toArabicDigits } from '@/lib/format'
import { STATUS, daysOverdue, hasDate, isOverdue, itemNumbers, span, statusOf } from '@/lib/schedule'
import { ITEM_KINDS, type ItemKind, type Task } from '@/lib/types'

type Sort = 'rank' | 'late' | 'end' | 'progress' | 'recent'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'rank', label: 'الأهم أولًا' },
  { id: 'late', label: 'المتأخرة أولًا' },
  { id: 'end', label: 'الأقرب موعدًا' },
  { id: 'progress', label: 'الأقل إنجازًا' },
  { id: 'recent', label: 'آخر تعديل' },
]

const rank = (t: Task) => (t.priority ?? -1) + (t.urgency ?? -1)
const when = (t: Task) => (hasDate(t) ? span(t)[1].getTime() : Infinity)
const SORT_FN: Record<Sort, (a: Task, b: Task) => number> = {
  rank: (a, b) => rank(b) - rank(a),
  late: (a, b) => daysOverdue(b) * Number(isOverdue(b)) - daysOverdue(a) * Number(isOverdue(a)) || when(a) - when(b),
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

const Num = ({ v }: { v: number | null }) => <span className="font-ui tabular">{v == null ? '–' : toArabicDigits(v)}</span>

/* ---------- cells edited in place ---------- */
const cellCls =
  'h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-fg-primary transition-colors duration-fast hover:border-line-subtle hover:bg-surface focus:border-brand focus:bg-surface focus:outline-none disabled:opacity-60'

function SelectCell({ value, options, label, onSave, className }: { value: string; options: [string, string][]; label: string; onSave: (v: string) => void; className?: string }) {
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

const numOptions = (values: number[], suffix = ''): [string, string][] => [['', '–'], ...values.map((n): [string, string] => [String(n), `${toArabicDigits(n)}${suffix}`])]

/** Free text: saved when the field loses focus or on Enter, never on every keystroke. */
function TextCell({ value, label, placeholder, onSave }: { value: string; label: string; placeholder?: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])
  const commit = () => {
    focused.current = false
    if (draft.trim() !== value) onSave(draft.trim())
  }
  return (
    <input
      aria-label={label}
      className={cellCls}
      value={draft}
      placeholder={placeholder}
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
    </div>
  )
}

const KIND_OPTIONS: [string, string][] = [['', '–'], ...(Object.entries(ITEM_KINDS) as [string, string][])]

export function Register() {
  const { state, labels, labelName, openTask, run, patchLocal } = useBoardCtx()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('rank')
  const categories = state?.settings.categories ?? []
  const tasks = useMemo(() => {
    const needle = q.trim()
    return [...(state?.tasks ?? [])]
      .filter((t) => !needle || `${t.title} ${t.category} ${t.notes} ${labelName(t.label)} ${t.kind ? ITEM_KINDS[t.kind] : ''}`.includes(needle))
      .sort(SORT_FN[sort])
  }, [state, q, sort, labelName])
  // the same numbers as the bubbles in the matrix
  const numbers = useMemo(() => itemNumbers(state?.tasks ?? []), [state])

  // every cell saves on its own: shown at once, then confirmed by the server
  const save = (t: Task, patch: Partial<Task>) => {
    patchLocal(t.id, patch)
    void run(() => api.updateTask(t.id, patch))
  }
  const num = (v: string) => (v === '' ? null : Number(v))

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line-subtle p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <label className="relative block md:w-72">
          <span className="sr-only">بحث في المهام والفعاليات</span>
          <Search size={16} aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
          <input className="field ps-9" type="search" placeholder="ابحث بالاسم أو النوع أو الفئة أو الملاحظات" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs label="ترتيب المهام والفعاليات" items={SORTS} value={sort} onChange={setSort} />
          <Button icon={<Plus size={18} aria-hidden />} onClick={() => openTask(null)}>
            إضافة مهمة أو فعالية
          </Button>
        </div>
      </div>

      {/* wide screens: one table, every value editable in place */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1280px] border-collapse text-sm">
          <thead>
            <tr className="text-xs text-fg-tertiary">
              <th className="w-10 py-3 ps-4 text-center font-medium">#</th>
              <th className="w-6 py-3 font-medium" aria-label="الحالة" />
              <th className="min-w-[230px] py-3 text-start font-medium">المهمة / الفعالية</th>
              <th className="w-[92px] bg-blue-50/60 py-3 text-start font-medium text-blue-700">النوع</th>
              <th className="w-[150px] bg-blue-50/60 py-3 text-start font-medium text-blue-700">الفئة</th>
              <th className="w-[130px] bg-blue-50/60 py-3 text-start font-medium text-blue-700">المستوى</th>
              <th className="w-[74px] bg-blue-50/60 py-3 text-center font-medium text-blue-700">الأهمية</th>
              <th className="w-[74px] bg-blue-50/60 py-3 text-center font-medium text-blue-700">الاستعجال</th>
              <th className="w-[148px] bg-blue-50/60 py-3 text-start font-medium text-blue-700">التاريخ</th>
              <th className="w-[66px] py-3 text-center font-medium">الجهد</th>
              <th className="w-[84px] py-3 text-center font-medium">الإنجاز</th>
              <th className="min-w-[170px] bg-blue-50/60 py-3 pe-4 text-start font-medium text-blue-700">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const estimated = !t.end && hasDate(t)
              const name = t.title
              return (
                <tr key={t.id} className="border-t border-line-subtle align-middle transition-colors duration-fast hover:bg-neutral-25">
                  <td className="py-2 ps-4 text-center font-ui text-sm font-semibold tabular text-fg-secondary">{toArabicDigits(numbers.get(t.id) ?? 0)}</td>
                  <td className="py-2">
                    <span className="block h-3 w-3 rounded-full" style={{ background: STATUS[statusOf(t)].color }} title={STATUS[statusOf(t)].name} />
                  </td>
                  <td className="py-2 pe-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <button
                        type="button"
                        onClick={() => openTask(t.id)}
                        className="group inline-flex items-center gap-1.5 rounded-md text-start font-medium text-fg-primary hover:text-brand"
                        title="فتح كل التفاصيل"
                      >
                        {name}
                        <ChevronLeft size={14} aria-hidden className="text-fg-muted opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                      <Overdue t={t} />
                      {t.draft && (
                        <Badge tone="warning" size="xs">
                          بانتظار الموافقة
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="bg-blue-50/30 py-2">
                    <SelectCell label={`النوع — ${name}`} value={t.kind} options={KIND_OPTIONS} onSave={(v) => save(t, { kind: v as ItemKind })} />
                  </td>
                  <td className="bg-blue-50/30 py-2">
                    <SelectCell
                      label={`الفئة — ${name}`}
                      value={t.category}
                      options={[['', '–'], ...categories.map((c): [string, string] => [c, c]), ...(t.category && !categories.includes(t.category) ? [[t.category, t.category] as [string, string]] : [])]}
                      onSave={(v) => save(t, { category: v })}
                    />
                  </td>
                  <td className="bg-blue-50/30 py-2">
                    <SelectCell
                      label={`المستوى — ${name}`}
                      value={t.label}
                      options={[['', '–'], ...labels.map((l): [string, string] => [l.id, l.name])]}
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
                    <input
                      type="date"
                      aria-label={`التاريخ — ${name}`}
                      className={cn(cellCls, 'tabular')}
                      value={t.end}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v)) save(t, { end: v })
                      }}
                    />
                    {estimated && <p className="px-2 text-2xs text-fg-tertiary">تقديري: {fmtDay(span(t)[1])}</p>}
                  </td>
                  <td className="py-2">
                    <SelectCell
                      label={`الجهد — ${name}`}
                      className="text-center font-ui tabular"
                      value={t.effort == null ? '' : String(t.effort)}
                      options={numOptions(ONE_TO_TEN)}
                      onSave={(v) => save(t, { effort: num(v) })}
                    />
                  </td>
                  <td className="py-2">
                    <SelectCell
                      label={`نسبة الإنجاز — ${name}`}
                      className="text-center font-ui tabular"
                      value={String(t.progress)}
                      options={[...(PROGRESS.includes(t.progress) ? [] : [[String(t.progress), `${toArabicDigits(t.progress)}٪`] as [string, string]]), ...numOptions(PROGRESS, '٪').slice(1)]}
                      onSave={(v) => save(t, { progress: Number(v) })}
                    />
                  </td>
                  <td className="bg-blue-50/30 py-2 pe-4">
                    <TextCell label={`ملاحظات — ${name}`} value={t.notes} placeholder="أضف ملاحظة" onSave={(v) => save(t, { notes: v })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* phones and tablets: cards that open the full form */}
      <ul className="divide-y divide-line-subtle lg:hidden">
        {tasks.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => openTask(t.id)} className="block w-full p-4 text-start hover:bg-brand-soft">
              <div className="flex items-start gap-3">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: STATUS[statusOf(t)].color }} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="me-1.5 font-ui tabular text-fg-tertiary">{toArabicDigits(numbers.get(t.id) ?? 0)}.</span>
                    {t.title}
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
                    {t.category && (
                      <Badge tone="neutral" size="xs">
                        {t.category}
                      </Badge>
                    )}
                    <Overdue t={t} />
                    {t.draft && (
                      <Badge tone="warning" size="xs">
                        بانتظار الموافقة
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
                      <dd className="text-sm text-fg-primary">{hasDate(t) ? fmtDay(span(t)[1]) : '–'}</dd>
                    </div>
                  </dl>
                  <div className="mt-3">
                    <Progress t={t} />
                  </div>
                  {t.notes && <p className="mt-2 text-xs text-fg-secondary">{t.notes}</p>}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {!tasks.length && (
        <p className="p-8 text-center text-fg-tertiary">{q ? 'لا شيء يطابق البحث.' : 'لا توجد مهام أو فعاليات بعد. اضغط «إضافة مهمة أو فعالية» لإضافة أول بند.'}</p>
      )}
      <p className="border-t border-line-subtle px-5 py-3 text-xs text-fg-tertiary">
        عدّل أي قيمة مباشرة في الجدول وتُحفظ فورًا. الأعمدة المظللة يحددها نائب الرئيس، والجهد ونسبة الإنجاز يحدّثهما الفريق. اضغط على الاسم لفتح كل التفاصيل.
      </p>
    </Card>
  )
}
