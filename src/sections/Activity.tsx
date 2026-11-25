import { History, RotateCcw } from 'lucide-react'
import { Card } from '@ds/components/Card'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { fmtDate, fmtTime, toArabicDigits } from '@/lib/format'
import { parseDate } from '@/lib/schedule'
import { EXPECTATIONS, FIELD_NAMES, ITEM_KINDS, ROLES, TASK_STATUSES, type AuditEntry, type Expectation, type ItemKind, type Role, type TaskStatus } from '@/lib/types'

type Names = { labelName: (id: string) => string; titleOf: (id: string) => string }

function show(field: string, v: unknown, { labelName, titleOf }: Names): string {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return 'فارغ'
  if (field === 'label') return labelName(String(v))
  if (field === 'parentId') return `«${titleOf(String(v))}»`
  if (field === 'links' && Array.isArray(v)) return cut(v.map((l: { name?: string; url?: string }) => l.name || l.url || '').join('، '))
  if (field === 'outputs' && Array.isArray(v)) return cut(v.join('، '))
  if (field === 'expectation') return EXPECTATIONS[v as Expectation]?.name ?? String(v)
  if (field === 'progress') return `${toArabicDigits(Number(v))}٪`
  if (field === 'draft') return v ? 'غير مؤكد' : 'مؤكد'
  if (field === 'ready') return v ? 'جاهز' : 'غير جاهز'
  // stored codes and ISO dates, in the words the board uses
  if (field === 'status') return TASK_STATUSES[v as Exclude<TaskStatus, ''>] ?? String(v)
  if (field === 'kind') return ITEM_KINDS[v as Exclude<ItemKind, ''>] ?? String(v)
  if ((field === 'end' || field === 'start' || field === 'date' || field === 'actualEnd') && typeof v === 'string' && parseDate(v)) return fmtDate(parseDate(v)!)
  if (Array.isArray(v)) return `${toArabicDigits(v.length)} عناصر`
  if (typeof v === 'number') return toArabicDigits(v)
  return cut(String(v))
}
const cut = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s)
/** A settings field by name; the outputs list isn't the item's «المخرج النهائي المطلوب». */
const settingName = (field: string) => (field === 'outputs' ? 'قائمة المخرجات' : FIELD_NAMES[field] ?? field)

const KIND = { task: 'البند', event: 'الفعالية', settings: '' }

function sentence(a: AuditEntry, names: Names) {
  // personal accounts (no passwords are ever logged)
  if (a.field === 'user') {
    const acct = `حساب «${a.entityTitle}»`
    if (a.action === 'create') return `أنشأ ${acct}`
    if (a.action === 'delete') return `حذف ${acct}`
    const o = (a.old ?? {}) as { role?: string; active?: boolean }
    const n = (a.new ?? {}) as { role?: string; active?: boolean; password?: string }
    const parts = [
      o.active !== n.active && (n.active ? 'أعاد تفعيل' : 'أوقف'),
      o.role !== n.role && `غيّر صلاحية (${ROLES[n.role as Role] ?? n.role})`,
      n.password && 'غيّر كلمة مرور',
    ].filter(Boolean)
    return `${parts.length ? parts.join(' و') : 'عدّل'} ${acct}`
  }
  const what = a.entity === 'settings' ? settingName(a.field) : `${KIND[a.entity]} «${a.entityTitle}»`
  switch (a.action) {
    case 'create':
      return `أضاف ${what}`
    case 'delete':
      return `حذف ${what}`
    case 'restore':
      if (a.entityId === 'backup') {
        const n = a.new as { tasks?: number; events?: number } | null
        return `استرجع نسخة احتياطية (${toArabicDigits(n?.tasks ?? 0)} مهام، ${toArabicDigits(n?.events ?? 0)} فعاليات)`
      }
      return a.field ? `استرجع ${FIELD_NAMES[a.field] ?? a.field} في ${what} إلى ${show(a.field, a.new, names)}` : `استرجع ${what}`
    default:
      if (a.entity === 'settings') return `غيّر ${what}${typeof a.new === 'number' ? ` من ${show(a.field, a.old, names)} إلى ${show(a.field, a.new, names)}` : ''}`
      if (a.field === 'draft') return `أكّد ${what}`
      return `غيّر ${FIELD_NAMES[a.field] ?? a.field} في ${what} من ${show(a.field, a.old, names)} إلى ${show(a.field, a.new, names)}`
  }
}

export function Activity() {
  const { audit, isAdmin, run, labelName, state } = useBoardCtx()
  const titleOf = (id: string) => state?.tasks.find((t) => t.id === id)?.title ?? 'بند محذوف'
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
                  <span className="font-medium">{a.by}</span> {sentence(a, { labelName, titleOf })}
                </p>
                <p className="mt-0.5 text-xs text-fg-tertiary">{fmtTime(a.at)}</p>
              </div>
              {isAdmin && (a.action === 'update' || a.action === 'delete') && a.field !== 'user' && (
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
