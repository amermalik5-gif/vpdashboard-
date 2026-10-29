import { useEffect, useState } from 'react'
import { DatabaseBackup, Download, FileSpreadsheet, Plus, X } from 'lucide-react'
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

/** Admin-only: the weekly capacity behind the meter, and the lists everyone picks from. */
export function AdminPanel() {
  const { state, run } = useBoardCtx()
  const saved = state?.settings
  const [s, setS] = useState<Settings | null>(saved ?? null)
  const [cats, setCats] = useState('')
  useEffect(() => {
    if (saved) {
      setS(saved)
      setCats(saved.categories.join('\n'))
    }
  }, [saved])
  if (!s || !saved) return null

  const dirty = JSON.stringify({ ...s, categories: cats.split('\n').map((c) => c.trim()).filter(Boolean) }) !== JSON.stringify(saved)

  const save = () =>
    run(
      () =>
        api.saveSettings({
          weeklyCapacity: Math.max(1, Math.round(s.weeklyCapacity || 1)),
          labels: s.labels.filter((l) => l.name.trim()),
          eventTypes: s.eventTypes.filter((l) => l.name.trim()),
          categories: cats.split('\n').map((c) => c.trim()).filter(Boolean),
        }),
      'حُفظت الإعدادات',
    )

  return (
    <div className="grid gap-6">
      <Card padding="none" className="p-4 md:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle pb-6">
          <div>
            <label htmlFor="cap" className="font-medium">
              الطاقة الأسبوعية (نقاط جهد)
            </label>
            <p className="text-xs text-fg-tertiary">مجموع الجهد الذي يستطيع الفريق تحمّله في الأسبوع. مؤشر الطاقة يقارن حِمل الأسبوع الحالي بهذا الرقم.</p>
          </div>
          <input
            id="cap"
            type="number"
            min={1}
            max={1000}
            inputMode="numeric"
            className="field w-28 text-center tabular"
            value={s.weeklyCapacity}
            onChange={(e) => setS({ ...s, weeklyCapacity: Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          <OptionList
            title="المستويات"
            note="تظهر في عمود المستوى ومسارات الخط الزمني. إزالة مستوى تنقل مهامه إلى «بدون مستوى»."
            items={s.labels}
            onChange={(labels) => setS({ ...s, labels })}
          />
          <OptionList title="أنواع الفعاليات" note="تظهر عند إضافة فعالية." items={s.eventTypes} onChange={(eventTypes) => setS({ ...s, eventTypes })} />
          <div>
            <h4 className="font-medium">الفئات المقترحة</h4>
            <p className="mb-3 text-xs text-fg-tertiary">فئة في كل سطر. تظهر في القائمة المنسدلة عند إضافة مهمة.</p>
            <label htmlFor="cats" className="sr-only">
              الفئات
            </label>
            <textarea id="cats" rows={8} className="field" value={cats} onChange={(e) => setCats(e.target.value)} />
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3 border-t border-line-subtle pt-4">
          <Button onClick={save} disabled={!dirty}>
            حفظ الإعدادات
          </Button>
          {dirty && (
            <Button
              variant="ghost"
              onClick={() => {
                setS(saved)
                setCats(saved.categories.join('\n'))
              }}
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
function Backup() {
  const { state } = useBoardCtx()
  return (
    <Card padding="none" className="p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-prose">
          <h4 className="flex items-center gap-2 font-medium">
            <DatabaseBackup size={18} aria-hidden className="text-brand" />
            النسخ الاحتياطي
          </h4>
          <p className="mt-1 text-sm text-fg-secondary">
            نزّل نسخة من كل ما في اللوحة: {toArabicDigits(state?.tasks.length ?? 0)} مهام، و{toArabicDigits(state?.events.length ?? 0)} فعاليات، والإعدادات، وسجل التعديلات كاملًا. يُنصح بتنزيلها قبل أي تعديل كبير وفي نهاية كل شهر.
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
        </div>
      </div>
    </Card>
  )
}
