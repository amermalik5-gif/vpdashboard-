import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { useBoardCtx } from '@/lib/board'
import { fmtDay, toArabicDigits } from '@/lib/format'
import { STATUS, daysOverdue, isOverdue, span, statusOf } from '@/lib/schedule'
import { EXPECTATIONS, type Task } from '@/lib/types'

type Sort = 'rank' | 'late' | 'end' | 'progress' | 'recent'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'rank', label: 'الأهم أولًا' },
  { id: 'late', label: 'المتأخرة أولًا' },
  { id: 'end', label: 'الأقرب إطلاقًا' },
  { id: 'progress', label: 'الأقل إنجازًا' },
  { id: 'recent', label: 'آخر تعديل' },
]

const rank = (t: Task) => (t.priority ?? -1) + (t.urgency ?? -1)
const SORT_FN: Record<Sort, (a: Task, b: Task) => number> = {
  rank: (a, b) => rank(b) - rank(a),
  late: (a, b) => daysOverdue(b) * Number(isOverdue(b)) - daysOverdue(a) * Number(isOverdue(a)) || span(a)[1].getTime() - span(b)[1].getTime(),
  end: (a, b) => span(a)[1].getTime() - span(b)[1].getTime(),
  progress: (a, b) => a.progress - b.progress,
  recent: (a, b) => b.updatedAt - a.updatedAt,
}

/** «متأخرة ٣ أيام» — red, so the task that most needs attention can't be missed. */
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

export function Register() {
  const { state, labelName, openTask } = useBoardCtx()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('rank')
  const tasks = useMemo(() => {
    const needle = q.trim()
    return [...(state?.tasks ?? [])]
      .filter((t) => !needle || `${t.title} ${t.category} ${t.owner} ${labelName(t.label)}`.includes(needle))
      .sort(SORT_FN[sort])
  }, [state, q, sort, labelName])

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line-subtle p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <label className="relative block md:w-72">
          <span className="sr-only">بحث في المهام</span>
          <Search size={16} aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
          <input className="field ps-9" type="search" placeholder="ابحث بالعنوان أو الفئة أو المسؤول" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs label="ترتيب المهام" items={SORTS} value={sort} onChange={setSort} />
          <Button icon={<Plus size={18} aria-hidden />} onClick={() => openTask(null)}>
            إضافة مهمة
          </Button>
        </div>
      </div>

      {/* wide screens: table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="text-start text-xs text-fg-tertiary">
              <th className="w-8 py-3 ps-5 font-medium" aria-label="الحالة" />
              <th className="py-3 text-start font-medium">المهمة</th>
              <th className="bg-blue-50/60 py-3 text-start font-medium text-blue-700">الفئة</th>
              <th className="bg-blue-50/60 py-3 text-start font-medium text-blue-700">المستوى</th>
              <th className="bg-blue-50/60 py-3 text-center font-medium text-blue-700">درجة الأهمية</th>
              <th className="bg-blue-50/60 py-3 text-center font-medium text-blue-700">مستوى الاستعجال</th>
              <th className="bg-blue-50/60 py-3 text-start font-medium text-blue-700">المدة المتوقعة</th>
              <th className="py-3 text-center font-medium">الجهد</th>
              <th className="w-40 py-3 text-start font-medium">الإنجاز</th>
              <th className="py-3 text-start font-medium">الإطلاق</th>
              <th className="py-3 pe-5 text-start font-medium">المسؤول</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const [, end] = span(t)
              return (
                <tr
                  key={t.id}
                  tabIndex={0}
                  onClick={() => openTask(t.id)}
                  onKeyDown={(e) => e.key === 'Enter' && openTask(t.id)}
                  className="cursor-pointer border-t border-line-subtle transition-colors duration-fast hover:bg-brand-soft focus-visible:bg-brand-soft"
                >
                  <td className="py-3 ps-5">
                    <span className="block h-3 w-3 rounded-full" style={{ background: STATUS[statusOf(t)].color }} title={STATUS[statusOf(t)].name} />
                  </td>
                  <td className="py-3 pe-3">
                    <span className="font-medium text-fg-primary">{t.title}</span>
                    <Overdue t={t} className="ms-2" />
                    {t.draft && (
                      <Badge tone="warning" size="xs" className="ms-2">
                        بانتظار التأكيد
                      </Badge>
                    )}
                  </td>
                  <td className="bg-blue-50/30 py-3 text-fg-secondary">{t.category || '–'}</td>
                  <td className="bg-blue-50/30 py-3">
                    <Badge tone={t.label ? 'blue' : 'neutral'} size="xs">
                      {labelName(t.label)}
                    </Badge>
                  </td>
                  <td className="bg-blue-50/30 py-3 text-center">
                    <Num v={t.priority} />
                  </td>
                  <td className="bg-blue-50/30 py-3 text-center">
                    <Num v={t.urgency} />
                  </td>
                  <td className="bg-blue-50/30 py-3 text-fg-secondary">{t.expectation ? EXPECTATIONS[t.expectation].name : '–'}</td>
                  <td className="py-3 text-center">
                    <Num v={t.effort} />
                  </td>
                  <td className="py-3 pe-4">
                    <Progress t={t} />
                  </td>
                  <td className="py-3 text-fg-secondary" title={t.end ? undefined : 'تقديري من تاريخ البدء والمدة المتوقعة'}>
                    {fmtDay(end)}
                    {!t.end && <span className="text-fg-muted"> *</span>}
                  </td>
                  <td className="py-3 pe-5 text-fg-secondary">{t.owner || '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* phones and tablets: cards */}
      <ul className="divide-y divide-line-subtle lg:hidden">
        {tasks.map((t) => {
          const [, end] = span(t)
          return (
            <li key={t.id}>
              <button type="button" onClick={() => openTask(t.id)} className="block w-full p-4 text-start hover:bg-brand-soft">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: STATUS[statusOf(t)].color }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone={t.label ? 'blue' : 'neutral'} size="xs">
                        {labelName(t.label)}
                      </Badge>
                      {t.category && (
                        <Badge tone="neutral" size="xs">
                          {t.category}
                        </Badge>
                      )}
                      <Overdue t={t} />
                      {t.draft && (
                        <Badge tone="warning" size="xs">
                          بانتظار التأكيد
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
                        <dt>الإطلاق</dt>
                        <dd className="text-sm text-fg-primary">{fmtDay(end)}</dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <Progress t={t} />
                    </div>
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {!tasks.length && (
        <p className="p-8 text-center text-fg-tertiary">{q ? 'لا توجد مهام تطابق البحث.' : 'لا توجد مهام بعد. اضغط «إضافة مهمة» لإنشاء أول مهمة.'}</p>
      )}
      <p className="border-t border-line-subtle px-5 py-3 text-xs text-fg-tertiary">
        الأعمدة المظللة يحددها نائب الرئيس، والبقية يحدّثها الفريق. * تاريخ إطلاق تقديري من تاريخ البدء والمدة المتوقعة.
      </p>
    </Card>
  )
}
