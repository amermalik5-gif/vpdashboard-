import { useEffect, useRef, useState } from 'react'
import { DatabaseBackup, Download, FileSpreadsheet, Plus, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { toArabicDigits } from '@/lib/format'
import type { Option, Settings } from '@/lib/types'

const slug = (name: string, taken: Option[]) => {
  let base = name
    .toLowerCase()
    .replace(/[^\w-]+/g, '-')
    .replace(/^-|-$/g, '')
  if (!base) base = 'item'
  let id = base
  for (let i = 2; taken.some((o) => o.id === id); i++) id = `${base}-${i}`
  return id
}

function OptionList({ title, note, items, onChange }: { title: string; note: string; items: Option[]; onChange: (v: Option[]) => void }) {
  const [name, setName] = useState('')
  return (
    <div>
      <h4 className="font-medium">{title}</h4>
      <p className="mb-3 text-xs text-fg-tertiary">{note}</p>
      <ul className="flex flex-col gap-2">
        {items.map((o, i) => (
          <li key={o.id} className="flex items-center gap-2">
            <input
              className="field h-9"
              aria-label={`اسم ${o.name}`}
              value={o.name}
              maxLength={60}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <button
              type="button"
              aria-label={`إزالة ${o.name}`}
              disabled={items.length <= 1}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-tertiary hover:bg-danger-50 hover:text-danger-700 disabled:opacity-30"
            >
              <X size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          onChange([...items, { id: slug(name, items), name: name.trim() }])
          setName('')
        }}
      >
        <input className="field h-9" placeholder="عنصر جديد" aria-label={`إضافة إلى ${title}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <Button type="submit" size="sm" variant="outline" icon={<Plus size={16} aria-hidden />}>
          إضافة
        </Button>
      </form>
    </div>
  )
}

/** Admin-only: the list of levels everyone picks from, plus backups. */
export function AdminPanel() {
  const { state, run } = useBoardCtx()
  const saved = state?.settings
  const [s, setS] = useState<Settings | null>(saved ?? null)
  // the server copy the form was loaded from: other people's saves must not wipe unsaved edits
  const [base, setBase] = useState<Settings | null>(null)
  const edited = !!(s && base) && JSON.stringify(s) !== JSON.stringify(base)
  const load = (x: Settings) => {
    setS(x)
    setBase(x)
  }
  useEffect(() => {
    if (!saved) return
    if (!base || (!edited && JSON.stringify(saved) !== JSON.stringify(base))) load(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved])
  if (!s || !saved || !base) return null

  const dirty = JSON.stringify(s) !== JSON.stringify(saved)
  const changedElsewhere = edited && JSON.stringify(saved) !== JSON.stringify(base)

  const save = () =>
    run(
      () =>
        api.saveSettings({
          labels: s.labels.filter((l) => l.name.trim()),
        }),
      'حُفظت الإعدادات',
    ).then((r) => {
      if (r) load(r)
    })

  return (
    <div className="grid gap-6">
      <Card padding="none" className="p-4 md:p-6">
        <div className="max-w-xl">
          <OptionList
            title="المستويات"
            note="تظهر في عمود المستوى وفي تصفية المصفوفة. إزالة مستوى تنقل بنوده إلى «بدون مستوى»."
            items={s.labels}
            onChange={(labels) => setS({ ...s, labels })}
          />
        </div>
        <div className="mt-6 flex items-center gap-3 border-t border-line-subtle pt-4">
          <Button onClick={save} disabled={!dirty}>
            حفظ الإعدادات
          </Button>
          {changedElsewhere && <p className="text-sm text-warning-700">تغيّرت الإعدادات من جهاز آخر. احفظ لاعتماد تعديلاتك، أو تجاهلها لعرض الأحدث.</p>}
          {dirty && (
            <Button
              variant="ghost"
              onClick={() => load(saved)}
            >
              تجاهل التغييرات
            </Button>
          )}
        </div>
      </Card>
      <Backup />
    </div>
  )
}

const linkBtn =
  'inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-[18px] text-sm font-medium transition-colors duration-fast'

/** Download a copy of everything on the board. Plain links: the browser saves the file with the admin cookie. */
interface BackupFile {
  app: string
  format: number
  exportedAt?: string
  tasks: unknown[]
  events: unknown[]
  settings: unknown
}

function Backup() {
  const { state, run } = useBoardCtx()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [error, setError] = useState('')

  const pick = async (f: File | undefined) => {
    setError('')
    setPending(null)
    if (!f) return
    try {
      const b = JSON.parse(await f.text()) as BackupFile
      if (b.app !== 'vp-dashboard' || b.format !== 1 || !Array.isArray(b.tasks) || !Array.isArray(b.events)) throw new Error()
      setPending(b)
    } catch {
      setError('هذا الملف ليس نسخة احتياطية من هذه اللوحة. اختر ملف JSON نزّلته من زر «نسخة احتياطية كاملة».')
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  const restore = async () => {
    if (!pending) return
    // the change log stays on the server; only the board's content is replaced
    const { app, format, tasks, events, settings } = pending
    const r = await run(() => api.restoreBackup({ app, format, tasks, events, settings }), 'تم الاسترجاع من النسخة الاحتياطية')
    if (r) setPending(null)
  }

  return (
    <Card padding="none" className="p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-prose">
          <h4 className="flex items-center gap-2 font-medium">
            <DatabaseBackup size={18} aria-hidden className="text-brand" />
            النسخ الاحتياطي
          </h4>
          <p className="mt-1 text-sm text-fg-secondary">
            نزّل نسخة من كل ما في اللوحة: {toArabicDigits(state?.tasks.length ?? 0)} بندًا (مهام وفعاليات)، والإعدادات، وسجل التعديلات كاملًا. يُنصح بتنزيلها قبل أي تعديل كبير وفي نهاية كل شهر.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/backup" download className={linkBtn + ' bg-brand text-white hover:bg-brand-hover'}>
            <Download size={18} aria-hidden />
            نسخة احتياطية كاملة (JSON)
          </a>
          <a href="/api/backup/tasks.csv" download className={linkBtn + ' border border-brand bg-surface text-brand hover:bg-blue-50'}>
            <FileSpreadsheet size={18} aria-hidden />
            جدول المهام (Excel)
          </a>
          <Button variant="ghost" icon={<Upload size={18} aria-hidden />} onClick={() => input.current?.click()}>
            استرجاع من نسخة احتياطية
          </Button>
          <input ref={input} id="restore-file" type="file" accept="application/json,.json" className="sr-only" aria-label="ملف النسخة الاحتياطية" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      </div>
      {error && <p className="mt-4 text-sm text-danger-700">{error}</p>}
      {pending && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-warning-100 bg-warning-50 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-warning-700">
            سيستبدل هذا كل المهام والفعاليات والإعدادات الحالية بما في الملف: {toArabicDigits(pending.tasks.length + pending.events.length)} بندًا
            {pending.exportedAt ? ` (نسخة ${new Date(pending.exportedAt).toLocaleDateString('ar-SA-u-ca-gregory')})` : ''}. يحتفظ الخادم بنسخة من الوضع الحالي قبل الاسترجاع.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button className="bg-danger-700 hover:bg-danger-700" onClick={restore}>
              نعم، استرجع
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
