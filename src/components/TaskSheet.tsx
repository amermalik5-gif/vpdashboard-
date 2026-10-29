import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { fmtDay, fmtTime, toArabicDigits } from '@/lib/format'
import { addDays, isoDate, parseDate, STATUS, statusOf, today } from '@/lib/schedule'
import { EXPECTATIONS, type Expectation, type Task } from '@/lib/types'

type Form = Pick<Task, 'title' | 'category' | 'label' | 'priority' | 'urgency' | 'expectation' | 'effort' | 'progress' | 'start' | 'end' | 'owner' | 'notes'>

const blank = (): Form => ({
  title: '',
  category: '',
  label: '',
  priority: 5,
  urgency: 5,
  expectation: '2w',
  effort: 3,
  progress: 0,
  start: isoDate(today()),
  end: '',
  owner: '',
  notes: '',
})

function Scale({ id, label, hint, value, min, max, step = 1, suffix = '', onChange }: { id: string; label: string; hint?: string; value: number | null; min: number; max: number; step?: number; suffix?: string; onChange: (v: number | null) => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <span className="font-ui text-lg font-medium tabular text-brand">{value == null ? '–' : `${toArabicDigits(value)}${suffix}`}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value ?? min} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--nwc-blue-500)]" />
      <div className="flex justify-between text-2xs text-fg-tertiary">
        <span>{toArabicDigits(min)}</span>
        {hint && <span>{hint}</span>}
        <span>{toArabicDigits(max)}</span>
      </div>
    </div>
  )
}

function Group({ title, note, tone, children }: { title: string; note: string; tone: 'vp' | 'team'; children: ReactNode }) {
  return (
    <fieldset className={tone === 'vp' ? 'rounded-xl border border-blue-100 bg-brand-soft p-4 md:p-5' : 'rounded-xl border border-line-subtle bg-surface p-4 md:p-5'}>
      <legend className="px-1 text-sm font-medium text-brand">{title}</legend>
      <p className="mb-4 text-xs text-fg-tertiary">{note}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

/** Drawer to add or edit one task: one form for every field (the booklet's Sheet). */
export function TaskSheet() {
  const { state, editing, closeTask, isAdmin, run, labels } = useBoardCtx()
  const task = editing.id ? state?.tasks.find((t) => t.id === editing.id) : undefined
  const [f, setF] = useState<Form>(blank)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  // load the task when the drawer opens (not on every live refresh, so typing is never overwritten)
  useEffect(() => {
    if (!editing.open) return
    setConfirmDelete(false)
    setF(task ? { ...task } : blank())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing.open, editing.id])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const categories = state?.settings.categories ?? []

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    let ok: unknown
    if (task) {
      const patch: Partial<Task> = {}
      for (const k of Object.keys(f) as (keyof Form)[]) if (f[k] !== task[k]) (patch as Record<string, unknown>)[k] = f[k]
      if (task.draft) patch.draft = false
      ok = Object.keys(patch).length ? await run(() => api.updateTask(task.id, patch), task.draft ? 'حُفظت المهمة وأُكّدت' : 'حُفظت التعديلات') : true
    } else ok = await run(() => api.addTask(f), 'أُضيفت المهمة')
    setSaving(false)
    if (ok) closeTask()
  }

  const remove = async () => {
    if (!task) return
    if (await run(() => api.deleteTask(task.id), 'حُذفت المهمة')) closeTask()
  }

  // end date preview when only the expected time is set
  const startD = parseDate(f.start) ?? today()
  const derivedEnd = f.end ? null : addDays(startD, f.expectation ? EXPECTATIONS[f.expectation].days : 14)
  const st = STATUS[statusOf({ ...(task ?? ({} as Task)), progress: f.progress })]

  return (
    <Sheet
      open={editing.open}
      onClose={closeTask}
      labelledBy="task-sheet-title"
      header={
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: st.color }} />
          <h2 id="task-sheet-title" className="truncate text-lg font-medium">
            {task ? 'تعديل المهمة' : 'مهمة جديدة'}
          </h2>
          {task?.draft && (
            <Badge tone="warning" size="xs">
              بانتظار التأكيد
            </Badge>
          )}
        </div>
      }
    >
      <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-5 p-5 md:p-8">
        {task?.draft && (
          <p className="rounded-lg border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
            هذه القيم مقترحة من اجتماع الانطلاق. راجعها ثم اضغط «حفظ وتأكيد» لاعتمادها.
          </p>
        )}
        <div>
          <label htmlFor="t-title" className="field-label">
            عنوان المهمة
          </label>
          <input id="t-title" className="field h-12 text-md" required maxLength={160} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="مثال: اليوم الرقمي ١٠" />
        </div>

        <Group tone="vp" title="يحددها نائب الرئيس" note="الفئة والمستوى ودرجة الأهمية ومستوى الاستعجال والمدة المتوقعة تحدد موقع المهمة في المصفوفة.">
          <div>
            <label htmlFor="t-cat" className="field-label">
              الفئة
            </label>
            <input id="t-cat" className="field" list="t-cats" maxLength={80} value={f.category} onChange={(e) => set('category', e.target.value)} />
            <datalist id="t-cats">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="t-label" className="field-label">
              المستوى
            </label>
            <select id="t-label" className="field" value={f.label} onChange={(e) => set('label', e.target.value)}>
              <option value="">بدون مستوى</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <Scale id="t-p" label="درجة الأهمية (مهمة)" hint="١٠ = مهمة جدًا" value={f.priority} min={0} max={10} onChange={(v) => set('priority', v)} />
          <Scale id="t-u" label="مستوى الاستعجال (طارئة)" hint="١٠ = طارئة جدًا" value={f.urgency} min={0} max={10} onChange={(v) => set('urgency', v)} />
          <div className="sm:col-span-2">
            <label htmlFor="t-exp" className="field-label">
              المدة المتوقعة
            </label>
            <select
              id="t-exp"
              className="field"
              value={f.expectation}
              onChange={(e) => {
                const v = e.target.value as Expectation | ''
                set('expectation', v)
                if (v && f.urgency == null) set('urgency', EXPECTATIONS[v].urgency)
              }}
            >
              <option value="">غير محددة</option>
              {(Object.keys(EXPECTATIONS) as Expectation[]).map((k) => (
                <option key={k} value={k}>
                  {EXPECTATIONS[k].name}
                </option>
              ))}
            </select>
            <p className="field-hint">إذا لم يُحدَّد تاريخ الإطلاق، يُقدَّر بعد هذه المدة من تاريخ البدء.</p>
          </div>
        </Group>

        <Group tone="team" title="يحدّثها الفريق" note="الجهد يحدد حجم الفقاعة ويُحسب في مؤشر الطاقة. نسبة الإنجاز تحدد اللون.">
          <Scale id="t-e" label="الجهد" hint="١٠ = مثل اليوم الرقمي" value={f.effort} min={1} max={10} onChange={(v) => set('effort', v)} />
          <Scale id="t-pr" label="نسبة الإنجاز" value={f.progress} min={0} max={100} step={5} suffix="٪" onChange={(v) => set('progress', v ?? 0)} />
          <div>
            <label htmlFor="t-start" className="field-label">
              تاريخ البدء
            </label>
            <input id="t-start" type="date" className="field" value={f.start} onChange={(e) => set('start', e.target.value)} />
          </div>
          <div>
            <label htmlFor="t-end" className="field-label">
              تاريخ الإطلاق
            </label>
            <input id="t-end" type="date" className="field" value={f.end} min={f.start || undefined} onChange={(e) => set('end', e.target.value)} />
            {derivedEnd && <p className="field-hint">غير محدد: تقديريًا {fmtDay(derivedEnd)}</p>}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="t-owner" className="field-label">
              المسؤول
            </label>
            <input id="t-owner" className="field" maxLength={80} value={f.owner} onChange={(e) => set('owner', e.target.value)} />
          </div>
        </Group>

        <div>
          <label htmlFor="t-notes" className="field-label">
            ملاحظات
          </label>
          <textarea id="t-notes" rows={3} className="field" maxLength={2000} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        {task && (
          <p className="text-xs text-fg-tertiary">
            آخر تعديل: {task.updatedBy} · {fmtTime(task.updatedAt)}
          </p>
        )}

        <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-line-subtle bg-page px-5 py-4 md:-mx-8 md:px-8">
          <Button type="submit" size="lg" disabled={saving}>
            {task?.draft ? 'حفظ وتأكيد' : task ? 'حفظ التعديلات' : 'إضافة المهمة'}
          </Button>
          <Button variant="ghost" size="lg" onClick={closeTask}>
            إلغاء
          </Button>
          {task && isAdmin && (
            <div className="ms-auto flex items-center gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-sm text-danger-700">حذف نهائي؟ يمكن استرجاعه من سجل التعديلات.</span>
                  <Button variant="outline" className="border-danger-500 text-danger-700 hover:bg-danger-50" onClick={remove}>
                    نعم، احذف
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    تراجع
                  </Button>
                </>
              ) : (
                <Button variant="ghost" className="text-danger-700 hover:bg-danger-50" icon={<Trash2 size={16} aria-hidden />} onClick={() => setConfirmDelete(true)}>
                  حذف المهمة
                </Button>
              )}
            </div>
          )}
        </div>
      </form>
    </Sheet>
  )
}
