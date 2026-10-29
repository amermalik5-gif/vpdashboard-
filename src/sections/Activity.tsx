import { History, RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { fmtTime, toArabicDigits } from '@/lib/format'
import { EXPECTATIONS, FIELD_NAMES, type AuditEntry, type Expectation } from '@/lib/types'

function show(field: string, v: unknown, labelName: (id: string) => string): string {
  if (v === null || v === undefined || v === '') return 'فارغ'
  if (field === 'label') return labelName(String(v))
  if (field === 'expectation') return EXPECTATIONS[v as Expectation]?.name ?? String(v)
  if (field === 'progress') return `${toArabicDigits(Number(v))}٪`
  if (field === 'draft') return v ? 'غير مؤكد' : 'مؤكد'
  if (Array.isArray(v)) return `${toArabicDigits(v.length)} عناصر`
  if (typeof v === 'number') return toArabicDigits(v)
  const s = String(v)
  return s.length > 40 ? `${s.slice(0, 39)}…` : s
}

const KIND = { task: 'المهمة', event: 'الفعالية', settings: '' }

function sentence(a: AuditEntry, labelName: (id: string) => string) {
  const what = a.entity === 'settings' ? FIELD_NAMES[a.field] ?? a.field : `${KIND[a.entity]} «${a.entityTitle}»`
  switch (a.action) {
    case 'create':
      return `أضاف ${what}`
    case 'delete':
      return `حذف ${what}`
    case 'restore':
      return a.field ? `استرجع ${FIELD_NAMES[a.field] ?? a.field} في ${what} إلى ${show(a.field, a.new, labelName)}` : `استرجع ${what}`
    default:
      if (a.entity === 'settings') return `غيّر ${what}${typeof a.new === 'number' ? ` من ${show(a.field, a.old, labelName)} إلى ${show(a.field, a.new, labelName)}` : ''}`
      if (a.field === 'draft') return `أكّد ${what}`
      return `غيّر ${FIELD_NAMES[a.field] ?? a.field} في ${what} من ${show(a.field, a.old, labelName)} إلى ${show(a.field, a.new, labelName)}`
  }
}

export function Activity() {
  const { audit, isAdmin, run, labelName } = useBoardCtx()
  return (
    <Card padding="none" className="overflow-hidden">
      {audit.length ? (
        <ol className="max-h-[520px] divide-y divide-line-subtle overflow-y-auto">
          {audit.map((a) => (
            <li key={a.id} className="flex items-start gap-3 px-4 py-3 md:px-5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-fg-secondary">
                <History size={15} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{a.by}</span> {sentence(a, labelName)}
                </p>
                <p className="mt-0.5 text-xs text-fg-tertiary">{fmtTime(a.at)}</p>
              </div>
              {isAdmin && (a.action === 'update' || a.action === 'delete') && (
                <button
                  type="button"
                  onClick={() => run(() => api.restore(a.id), 'تم الاسترجاع')}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-brand hover:bg-blue-50"
                  title={a.action === 'delete' ? 'إعادة العنصر المحذوف' : 'إعادة القيمة السابقة'}
                >
                  <RotateCcw size={14} aria-hidden />
                  استرجاع
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="p-8 text-center text-fg-tertiary">لا توجد تعديلات بعد. كل إضافة أو تعديل يظهر هنا مع اسم من قام به.</p>
      )}
    </Card>
  )
}
