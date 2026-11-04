import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DatabaseBackup, Download, FileSpreadsheet, KeyRound, Plus, Trash2, Upload, UsersRound, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { cn } from '@/lib/cn'
import { fmtTime, toArabicDigits } from '@/lib/format'
import { ROLES, type Option, type Role, type Settings, type UserInfo } from '@/lib/types'

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

const blankUser = { name: '', username: '', password: '', role: 'editor' as Role }

/**
 * Admin-only: the personal accounts that may edit. Anyone with the link can view; the built-in
 * «admin» account always remains, so the board can never be locked.
 */
function Users() {
  const { run } = useBoardCtx()
  const [users, setUsers] = useState<UserInfo[] | null>(null)
  const [form, setForm] = useState(blankUser)
  const [reset, setReset] = useState<{ id: string; password: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const load = () =>
    api
      .users()
      .then(setUsers)
      .catch(() => setUsers([]))
  useEffect(() => {
    void load()
  }, [])
  const act = async (p: () => Promise<unknown>, done: string) => {
    const ok = await run(p, done)
    void load()
    return ok
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (await act(() => api.addUser({ ...form, username: form.username.trim(), name: form.name.trim() }), `أُنشئ حساب ${form.name.trim()}`)) setForm(blankUser)
  }

  return (
    <Card padding="none" className="p-4 md:p-6">
      <h4 className="flex items-center gap-2 font-medium">
        <UsersRound size={18} aria-hidden className="text-brand" />
        المستخدمون
      </h4>
      <p className="mt-1 max-w-prose text-sm text-fg-secondary">
        كل من لديه الرابط يرى اللوحة فقط. للتعديل يحتاج الشخص حسابًا هنا، ويظهر اسمه في سجل التعديلات. صلاحية «مشرف» تدير أيضًا الحسابات والإعدادات والنسخ الاحتياطي. الحساب المدمج «admin» يبقى دائمًا.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-xs text-fg-tertiary">
              <th className="py-2 text-start font-medium">الاسم</th>
              <th className="py-2 text-start font-medium">اسم المستخدم</th>
              <th className="py-2 text-start font-medium">الصلاحية</th>
              <th className="py-2 text-start font-medium">آخر دخول</th>
              <th className="py-2 text-start font-medium">الحالة</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className={cn('border-t border-line-subtle align-middle', !u.active && 'text-fg-muted')}>
                <td className="py-2 pe-3 font-medium">{u.name}</td>
                <td className="py-2 pe-3 font-ui" dir="ltr">
                  {u.username}
                </td>
                <td className="py-2 pe-3">
                  <select
                    aria-label={`صلاحية ${u.name}`}
                    className="field h-9 py-0"
                    value={u.role}
                    onChange={(e) => void act(() => api.updateUser(u.id, { role: e.target.value as Role }), 'تغيّرت الصلاحية')}
                  >
                    {(Object.entries(ROLES) as [Role, string][]).map(([k, name]) => (
                      <option key={k} value={k}>
                        {name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pe-3 text-xs text-fg-tertiary">{u.lastLoginAt ? fmtTime(u.lastLoginAt) : 'لم يدخل بعد'}</td>
                <td className="py-2 pe-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', u.active ? 'bg-success-50 text-success-700' : 'bg-neutral-100 text-fg-tertiary')}>{u.active ? 'فعّال' : 'موقوف'}</span>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {reset?.id === u.id ? (
                      <form
                        className="flex items-center gap-1"
                        onSubmit={async (e) => {
                          e.preventDefault()
                          if (await act(() => api.updateUser(u.id, { password: reset.password }), 'تغيّرت كلمة المرور')) setReset(null)
                        }}
                      >
                        <input
                          type="password"
                          aria-label={`كلمة مرور جديدة لـ ${u.name}`}
                          className="field h-9 w-40"
                          minLength={8}
                          required
                          autoComplete="new-password"
                          value={reset.password}
                          onChange={(e) => setReset({ id: u.id, password: e.target.value })}
                        />
                        <Button type="submit" size="sm">
                          حفظ
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setReset(null)}>
                          إلغاء
                        </Button>
                      </form>
                    ) : confirmDelete === u.id ? (
                      <>
                        <span className="text-xs text-danger-700">حذف الحساب نهائيًا؟</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-danger-500 text-danger-700 hover:bg-danger-50"
                          onClick={async () => {
                            await act(() => api.deleteUser(u.id), 'حُذف الحساب')
                            setConfirmDelete(null)
                          }}
                        >
                          نعم، احذف
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                          تراجع
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" icon={<KeyRound size={14} aria-hidden />} onClick={() => setReset({ id: u.id, password: '' })}>
                          كلمة مرور جديدة
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void act(() => api.updateUser(u.id, { active: !u.active }), u.active ? 'أُوقف الحساب' : 'أُعيد تفعيل الحساب')}>
                          {u.active ? 'إيقاف' : 'تفعيل'}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-danger-700 hover:bg-danger-50" aria-label={`حذف حساب ${u.name}`} icon={<Trash2 size={14} aria-hidden />} onClick={() => setConfirmDelete(u.id)}>
                          حذف
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users && !users.length && (
              <tr>
                <td colSpan={6} className="border-t border-line-subtle py-4 text-center text-fg-tertiary">
                  لا توجد حسابات بعد. أضف حساب نائب الرئيس وحسابات الفريق من النموذج أدناه.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={add} className="mt-5 grid gap-3 border-t border-line-subtle pt-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_0.9fr_auto] lg:items-end">
        <div>
          <label htmlFor="u-name" className="field-label">
            الاسم (يظهر في السجل)
          </label>
          <input id="u-name" className="field" required maxLength={60} placeholder="مثال: نائب الرئيس" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="u-username" className="field-label">
            اسم المستخدم
          </label>
          <input
            id="u-username"
            className="field"
            dir="ltr"
            required
            pattern="[A-Za-z0-9._\-]{2,32}"
            title="من حرفين إلى ٣٢ حرفًا لاتينيًا أو رقمًا"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            placeholder="vp"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="u-password" className="field-label">
            كلمة المرور
          </label>
          <input id="u-password" type="password" className="field" required minLength={8} autoComplete="new-password" placeholder="٨ أحرف على الأقل" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div>
          <label htmlFor="u-role" className="field-label">
            الصلاحية
          </label>
          <select id="u-role" className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {(Object.entries(ROLES) as [Role, string][]).map(([k, name]) => (
              <option key={k} value={k}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" icon={<Plus size={16} aria-hidden />}>
          إضافة حساب
        </Button>
      </form>
    </Card>
  )
}

/** Admin-only: the list of levels everyone picks from, the accounts, and backups. */
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
      <Users />
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
