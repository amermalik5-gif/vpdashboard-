import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ExternalLink, Plus, Trash2, X } from 'lucide-react'
import { Badge } from '@ds/components/Badge'
import { Button } from '@ds/components/Button'
import { Sheet } from '@ds/components/Sheet'
import { DateInput } from '@ds/components/DateInput'
import { ReadyStar } from '@/components/ReadyStar'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { cn } from '@ds/lib/cn'
import { fmtWhen, fmtTime, toArabicDigits } from '@/lib/format'
import { arabicCheck } from '@ds/lib/forms'
import { addDays, chosenStatus, isoDate, isReady, itemNumbers, needsReason, parseDate, progressPatch, STATUS, statusOf, statusPatch, today, type Status } from '@/lib/schedule'
import { EXPECTATIONS, ITEM_KINDS, TASK_STATUSES, type Expectation, type ItemKind, type OutputLink, type Task } from '@/lib/types'

/** Fields the VP sets (the shaded group); changing one confirms a seeded draft. */
const VP_FIELDS = ['priority', 'urgency', 'expectation', 'label', 'kind', 'end'] as const

type Form = Pick<
  Task,
  | 'title'
  | 'kind'
  | 'label'
  | 'priority'
  | 'urgency'
  | 'expectation'
  | 'effort'
  | 'progress'
  | 'status'
  | 'ready'
  | 'start'
  | 'end'
  | 'owner'
  | 'notes'
  | 'teamNotes'
  | 'outputs'
  | 'links'
  | 'sponsor'
  | 'actualEnd'
  | 'parentId'
>
const FORM_KEYS = ['title', 'kind', 'label', 'priority', 'urgency', 'expectation', 'effort', 'progress', 'status', 'ready', 'start', 'end', 'owner', 'notes', 'teamNotes', 'outputs', 'links', 'sponsor', 'actualEnd', 'parentId'] as const
const pickForm = (t: Task): Form => Object.fromEntries(FORM_KEYS.map((k) => [k, t[k]])) as Form
/** What is sent: links without an address are dropped. */
const tidy = (f: Form): Form => ({ ...f, links: f.links.filter((l) => l.url.trim()).map((l) => ({ name: l.name.trim(), url: l.url.trim() })) })

const blank = (): Form => ({
  title: '',
  kind: '',
  label: '',
  priority: null,
  urgency: null,
  expectation: '',
  effort: null,
  progress: 0,
  status: '',
  ready: false,
  start: isoDate(today()),
  end: '',
  owner: '',
  notes: '',
  teamNotes: '',
  outputs: [],
  links: [],
  sponsor: '',
  actualEnd: '',
  parentId: '',
})

/** «روابط المخرجات»: a name and an address per link; links only, no files. */
function LinksField({ links, onChange }: { links: OutputLink[]; onChange: (v: OutputLink[]) => void }) {
  const at = (i: number, patch: Partial<OutputLink>) => onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  return (
    <div className="sm:col-span-2">
      <span id="t-links-label" className="field-label">
        روابط المخرجات
      </span>
      <ul aria-labelledby="t-links-label" className="flex flex-col gap-2">
        {links.map((l, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] items-center gap-2">
            <input aria-label={`اسم الرابط ${toArabicDigits(i + 1)}`} className="field h-10" maxLength={120} placeholder="مثال: الفيديو النهائي" value={l.name} onChange={(e) => at(i, { name: e.target.value })} />
            <input
              aria-label={`الرابط ${toArabicDigits(i + 1)}`}
              type="url"
              dir="ltr"
              required
              className="field h-10"
              maxLength={1000}
              placeholder="https://"
              value={l.url}
              onChange={(e) => at(i, { url: e.target.value })}
              {...arabicCheck('اكتب الرابط أو احذف هذا السطر.', 'اكتب الرابط كاملًا، يبدأ بـ https://')}
            />
            <span className="flex items-center">
              {/^https?:\/\//i.test(l.url) && (
                <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={`فتح ${l.name || 'الرابط'}`} title="فتح الرابط" className="rounded p-2 text-brand hover:bg-blue-50">
                  <ExternalLink size={16} aria-hidden />
                </a>
              )}
              <button type="button" aria-label={`حذف الرابط ${toArabicDigits(i + 1)}`} title="حذف الرابط" onClick={() => onChange(links.filter((_, j) => j !== i))} className="rounded p-2 text-fg-muted hover:bg-danger-50 hover:text-danger-700">
                <X size={16} aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>
      {!links.length && <p className="text-sm text-fg-muted">لا روابط بعد.</p>}
      <Button className="mt-2" size="sm" variant="outline" icon={<Plus size={16} aria-hidden />} onClick={() => onChange([...links, { name: '', url: '' }])}>
        إضافة رابط
      </Button>
      <p className="field-hint">رابط لكل مخرج جاهز: فيديو أو عرض أو بريد أو مجلد على Drive. تُضاف الروابط فقط، لا الملفات.</p>
    </div>
  )
}

function Scale({ id, label, hint, value, min, max, step = 1, suffix = '', onChange }: { id: string; label: string; hint?: string; value: number | null; min: number; max: number; step?: number; suffix?: string; onChange: (v: number | null) => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <span className="font-ui text-lg font-medium tabular text-brand">{value == null ? '—' : `${toArabicDigits(value)}${suffix}`}</span>
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

function Group({ title, note, tone, disabled, children }: { title: string; note: string; tone: 'vp' | 'team'; disabled?: boolean; children: ReactNode }) {
  return (
    <fieldset disabled={disabled} className={tone === 'vp' ? 'rounded-xl border border-blue-100 bg-brand-soft p-4 md:p-5' : 'rounded-xl border border-line-subtle bg-surface p-4 md:p-5'}>
      <legend className="px-1 text-sm font-medium text-brand">{title}</legend>
      <p className="mb-4 text-xs text-fg-tertiary">{note}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

/** Drawer to add or edit one task: one form for every field (the booklet's Sheet). */
export function TaskSheet() {
  const { state, editing, closeTask, canEdit, canEditAll, run, labels } = useBoardCtx()
  const tasks = useMemo(() => state?.tasks ?? [], [state?.tasks])
  const task = editing.id ? tasks.find((t) => t.id === editing.id) : undefined
  const numbers = useMemo(() => itemNumbers(tasks), [tasks])
  // the earlier notes and directions (signed-in accounts)
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.history>> | null>(null)
  useEffect(() => {
    setHistory(null)
    if (!editing.open || !task || !canEdit) return
    let live = true
    api
      .history(task.id)
      .then((h) => live && setHistory(h))
      .catch(() => live && setHistory([]))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing.open, editing.id, task?.updatedAt, canEdit])
  const [f, setF] = useState<Form>(blank)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  // the values the form was opened with: a save sends only what this person changed, so edits
  // others make meanwhile (live updates) are never overwritten with stale values
  const loaded = useRef<Form | null>(null)
  // the item was deleted (here or on another screen) while the drawer was open
  const gone = !!editing.id && !task

  // load the task when the drawer opens (not on every live refresh, so typing is never overwritten)
  useEffect(() => {
    if (!editing.open) return
    setConfirmDelete(false)
    if (!task) {
      loaded.current = null
      return setF(blank())
    }
    const form = pickForm(task)
    loaded.current = form
    setF(form)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing.open, editing.id])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))

  // a seeded draft is confirmed when the VP's own values change, or when the admin confirms as is
  const save = async (confirm: boolean) => {
    setSaving(true)
    let ok: unknown
    if (editing.id) {
      // never turn an item deleted meanwhile into a new one
      if (!task || !loaded.current) return setSaving(false)
      const from = loaded.current
      const next = tidy(f)
      const patch: Partial<Task> = {}
      for (const k of FORM_KEYS) if (JSON.stringify(next[k]) !== JSON.stringify(from[k])) (patch as Record<string, unknown>)[k] = next[k]
      const vpChanged = VP_FIELDS.some((k) => k in patch)
      if (task.draft && (confirm || vpChanged)) patch.draft = false
      const done = patch.draft === false ? 'حُفظ واعتُمد' : 'حُفظت التعديلات'
      ok = Object.keys(patch).length ? await run(() => api.updateTask(task.id, patch), done) : true
    } else ok = await run(() => api.addTask(tidy(f)), 'أُضيف إلى القائمة')
    setSaving(false)
    if (ok) closeTask()
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void save(false)
  }

  const remove = async () => {
    if (!task) return
    // the server answers «204 No Content»: success has to be marked explicitly
    if (await run(() => api.deleteTask(task.id).then(() => true), 'حُذف البند')) closeTask()
  }

  // end date preview when only the expected time is set
  // as on the board: without a start date, an estimate runs from the day the item was added
  const startD = parseDate(f.start) ?? (task ? new Date(new Date(task.createdAt).setHours(0, 0, 0, 0)) : today())
  const derivedEnd = f.end || !f.expectation ? null : addDays(startD, EXPECTATIONS[f.expectation].days)
  const current = { ...(task ?? ({} as Task)), ...f }
  const st = STATUS[statusOf(current)]
  // red or amber: the team says why (18 Nov 2026)
  const reasonNeeded = needsReason(current)
  // «جزء من»: main items only, one level
  const hasParts = !!task && tasks.some((t) => t.parentId === task.id)
  const mains = tasks.filter((t) => !t.parentId && t.id !== task?.id).sort((a, b) => numbers.get(a.id)! - numbers.get(b.id)!)
  const outputChoices = [...new Set([...(state?.settings.outputs ?? []), ...f.outputs])]
  const known = (k: 'owner' | 'sponsor') => [...new Set(tasks.map((t) => t[k].trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'))

  return (
    <Sheet
      open={editing.open}
      onClose={closeTask}
      labelledBy="task-sheet-title"
      header={
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: st.color }} />
          <h2 id="task-sheet-title" className="truncate text-lg font-medium">
            {gone ? 'حُذف هذا البند' : !task ? 'مهمة أو فعالية جديدة' : canEditAll ? 'تعديل' : canEdit ? 'تحديث حقول الفريق' : 'تفاصيل البند'}
          </h2>
          {isReady(current) && <ReadyStar size={16} />}
          {task?.draft && (
            <Badge tone="warning" size="xs">
              بانتظار الموافقة
            </Badge>
          )}
        </div>
      }
    >
      <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-5 p-5 md:p-8">
        {gone && (
          <p role="alert" className="rounded-lg border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            حُذف هذا البند، فلا يمكن حفظ التغييرات عليه. يستطيع المشرف استرجاعه من سجل التعديلات.
          </p>
        )}
        <fieldset disabled={!canEdit || gone} className="flex min-w-0 flex-col gap-5">
        {task?.draft && (
          <p className="rounded-lg border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
            هذا البند بانتظار موافقة نائب الرئيس. يُعتمد عند تغيير أيٍّ من قيم نائب الرئيس، ويستطيع نائب الرئيس أو المشرف اعتماده كما هو بزر «تأكيد القيم».
          </p>
        )}
        <div>
          <label htmlFor="t-title" className="field-label">
            المهمة / الفعالية
          </label>
          <input id="t-title" className="field h-12 text-md" disabled={!canEditAll} required maxLength={160} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="مثال: حفل تدشين الاستراتيجية" />
        </div>

        <Group tone="vp" disabled={!canEditAll} title="يحددها نائب الرئيس" note="درجة الأهمية ومستوى الاستعجال تحددان الموقع في المصفوفة، والتاريخ يحدد الموقع في الخط الزمني.">
          <div>
            <label htmlFor="t-kind" className="field-label">
              النوع
            </label>
            <select id="t-kind" className="field" value={f.kind} onChange={(e) => set('kind', e.target.value as ItemKind)}>
              <option value="">اختر النوع</option>
              {(Object.entries(ITEM_KINDS) as [ItemKind, string][]).map(([k, name]) => (
                <option key={k} value={k}>
                  {name}
                </option>
              ))}
            </select>
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
          <div>
            <label htmlFor="t-end" className="field-label">
              التاريخ المحدد
            </label>
            <DateInput id="t-end" look="field" value={f.end} disabled={!canEdit || !canEditAll} onChange={(v) => set('end', v)} />
            {derivedEnd ? <p className="field-hint">غير محدد: تقديريًا {fmtWhen(derivedEnd)}</p> : <p className="field-hint">يوم الفعالية أو الإطلاق.</p>}
          </div>
          <div>
            <label htmlFor="t-exp" className="field-label">
              أو المدة المتوقعة
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
            <p className="field-hint">إن لم يُحدَّد تاريخ، يُقدَّر بعد هذه المدة من تاريخ البدء.</p>
          </div>
          <div className="sm:col-span-2">
            <span id="t-outputs-label" className="field-label">
              المخرج النهائي المطلوب
            </span>
            <div role="group" aria-labelledby="t-outputs-label" className="flex flex-wrap gap-2">
              {outputChoices.map((o) => {
                const on = f.outputs.includes(o)
                return (
                  <label key={o} className={cn('inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-fast', on ? 'border-brand bg-surface font-medium text-brand' : 'border-line-subtle bg-surface/70 text-fg-secondary hover:border-blue-200')}>
                    <input type="checkbox" className="h-4 w-4 accent-[var(--nwc-blue-500)]" checked={on} onChange={(e) => set('outputs', e.target.checked ? [...f.outputs, o] : f.outputs.filter((x) => x !== o))} />
                    {o}
                  </label>
                )
              })}
            </div>
            <p className="field-hint">ما ينتظره نائب الرئيس من الفريق بالضبط. يحدده نائب الرئيس.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="t-notes" className="field-label">
              توجيهات نائب الرئيس
            </label>
            <textarea id="t-notes" rows={3} className="field" maxLength={2000} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
            <p className="field-hint">يكتبها نائب الرئيس.</p>
          </div>
        </Group>

        <Group tone="team" title="يحدّثها الفريق" note="الجهد يحدد حجم الفقاعة، والحالة تحدد اللون في المصفوفة والخط الزمني.">
          <Scale id="t-e" label="الجهد" hint="١٠ = مثل اليوم الرقمي" value={f.effort} min={1} max={10} onChange={(v) => set('effort', v)} />
          <Scale id="t-pr" label="نسبة الإنجاز" value={f.progress} min={0} max={100} step={5} suffix="٪" onChange={(v) => setF((x) => ({ ...x, ...progressPatch(x as Task, v ?? 0) }))} />
          <div>
            <label htmlFor="t-status" className="field-label flex items-center gap-1.5">
              الحالة
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: st.color }} />
            </label>
            <div>
              <select id="t-status" className="field" value={chosenStatus(current)} onChange={(e) => setF((x) => ({ ...x, ...statusPatch(e.target.value as Status) }))}>
                {(Object.entries(TASK_STATUSES) as [Status, string][]).map(([k, name]) => (
                  <option key={k} value={k}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <p className="field-hint">{statusOf(current) === 'late' && chosenStatus(current) !== 'late' ? 'فات تاريخ هذا البند، فيظهر «متأخرة» حتى يكتمل أو يتغيّر تاريخه.' : 'المكتملة خضراء دائمًا، وما فات تاريخه يصبح «متأخرة».'}</p>
          </div>
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-subtle p-3 hover:bg-neutral-25">
              <input
                type="checkbox"
                aria-label="جاهز للإطلاق"
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--ready-stroke)]"
                checked={f.ready}
                onChange={(e) => set('ready', e.target.checked)}
              />
              <span>
                <span className="flex items-center gap-1.5 font-medium">
                  جاهز للإطلاق
                  <ReadyStar />
                </span>
                <span className="block text-xs text-fg-tertiary">العمل منتهٍ وينتظر يوم الإطلاق. تظهر نجمة بجانبه في كل مكان، وبعد الإطلاق اجعل حالته «مكتملة».</span>
              </span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="t-team-notes" className="field-label">
              ملاحظات الفريق
            </label>
            <textarea
              id="t-team-notes"
              rows={3}
              className={cn('field', reasonNeeded && !f.teamNotes.trim() && 'border-danger-500')}
              maxLength={2000}
              required={reasonNeeded}
              value={f.teamNotes}
              onChange={(e) => set('teamNotes', e.target.value)}
              {...arabicCheck<HTMLTextAreaElement>('البند متأخر: اكتب السبب في ملاحظات الفريق قبل الحفظ.')}
            />
            {reasonNeeded ? (
              <p className="mt-1.5 text-xs font-medium text-danger-700">هذا البند بالأحمر أو البرتقالي: اكتب السبب هنا قبل الحفظ.</p>
            ) : (
              <p className="field-hint">آخر المستجدات: سبب أي تأخير، وما ينتظر الموافقة، وأي دعم مطلوب.</p>
            )}
          </div>
          <div>
            <label htmlFor="t-owner" className="field-label">
              المسؤول
            </label>
            <input
              id="t-owner"
              className="field"
              list="t-owner-list"
              required
              maxLength={80}
              value={f.owner}
              onChange={(e) => set('owner', e.target.value)}
              {...arabicCheck('اكتب المسؤول عن البند: من يتابعه نائب الرئيس معه.')}
            />
            <datalist id="t-owner-list">
              {known('owner').map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="t-sponsor" className="field-label">
              الراعي (المدير العام)
            </label>
            <input id="t-sponsor" className="field" list="t-sponsor-list" maxLength={80} value={f.sponsor} onChange={(e) => set('sponsor', e.target.value)} />
            <datalist id="t-sponsor-list">
              {known('sponsor').map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="t-parent" className="field-label">
              جزء من
            </label>
            <select id="t-parent" className="field" value={f.parentId} disabled={hasParts} onChange={(e) => set('parentId', e.target.value)}>
              <option value="">بند رئيسي (ليس جزءًا من بند آخر)</option>
              {mains.map((t) => (
                <option key={t.id} value={t.id}>
                  {toArabicDigits(numbers.get(t.id) ?? 0)}. {t.title}
                </option>
              ))}
              {f.parentId && !mains.some((t) => t.id === f.parentId) && <option value={f.parentId}>(بند لم يعد موجودًا)</option>}
            </select>
            <p className="field-hint">
              {hasParts
                ? 'لهذا البند بنود فرعية، فهو بند رئيسي.'
                : 'مثل فعاليات «إطلاق مركز العناية بالعملاء»: تظهر في المصفوفة بندًا واحدًا، وتُعرض البنود الفرعية تحته في الجدول.'}
            </p>
          </div>
          <div>
            <label htmlFor="t-start" className="field-label">
              تاريخ البدء
            </label>
            <DateInput id="t-start" look="field" value={f.start} disabled={!canEdit} onChange={(v) => set('start', v)} />
          </div>
          <div>
            <label htmlFor="t-actual" className="field-label">
              تاريخ الإطلاق الفعلي
            </label>
            <DateInput id="t-actual" look="field" value={f.actualEnd} disabled={!canEdit} onChange={(v) => set('actualEnd', v)} />
            <p className="field-hint">يوم الإطلاق الحقيقي. التاريخ الذي حدده نائب الرئيس لا يتغيّر.</p>
          </div>
          <LinksField links={f.links} onChange={(v) => set('links', v)} />
        </Group>

        {task && (
          <p className="text-xs text-fg-tertiary">
            آخر تعديل: {task.updatedBy}، {fmtTime(task.updatedAt)}
          </p>
        )}
        </fieldset>

        {task && history && history.length > 0 && (
          <details className="rounded-xl border border-line-subtle bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium">سجل الملاحظات والتوجيهات ({toArabicDigits(history.length)})</summary>
            <ol className="mt-3 flex flex-col gap-3">
              {history.map((h, i) => (
                <li key={i} className={cn('border-s-2 ps-3', h.field === 'notes' ? 'border-brand' : 'border-line-subtle')}>
                  <p className="text-xs text-fg-tertiary">
                    <span className="font-medium text-fg-secondary">{h.field === 'notes' ? 'توجيه نائب الرئيس' : 'ملاحظة الفريق'}</span>، {h.by}، {fmtTime(h.at)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-fg-primary">{h.text || <span className="text-fg-muted">(مُسحت)</span>}</p>
                </li>
              ))}
            </ol>
          </details>
        )}

        {!canEdit || gone ? (
          <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-line-subtle bg-page px-5 py-4 md:-mx-8 md:px-8">
            <Button size="lg" onClick={closeTask}>
              إغلاق
            </Button>
            {!gone && <span className="text-sm text-fg-tertiary">للعرض فقط. سجّل الدخول للتعديل.</span>}
          </div>
        ) : (
        <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-line-subtle bg-page px-5 py-4 md:-mx-8 md:px-8">
          <Button type="submit" size="lg" disabled={saving}>
            {task ? 'حفظ' : 'إضافة'}
          </Button>
          {task?.draft && canEditAll && (
            <Button variant="outline" size="lg" disabled={saving} onClick={() => void save(true)}>
              تأكيد القيم
            </Button>
          )}
          <Button variant="ghost" size="lg" onClick={closeTask}>
            إلغاء
          </Button>
          {task && canEditAll && (
            <div className="ms-auto flex items-center gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-sm text-danger-700">حذف نهائي؟ يستطيع المشرف استرجاعه من سجل التعديلات.</span>
                  <Button variant="outline" className="border-danger-500 text-danger-700 hover:bg-danger-50" onClick={remove}>
                    نعم، احذف
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    تراجع
                  </Button>
                </>
              ) : (
                <Button variant="ghost" className="text-danger-700 hover:bg-danger-50" icon={<Trash2 size={16} aria-hidden />} onClick={() => setConfirmDelete(true)}>
                  حذف
                </Button>
              )}
            </div>
          )}
        </div>
        )}
      </form>
    </Sheet>
  )
}
