import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Header } from '@/components/layout/Header'
import { TaskSheet } from '@/components/TaskSheet'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Section } from '@/components/ui/Section'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { api, registerNamePrompt, setEditorName, useEditorName } from '@/lib/api'
import { BoardProvider, useBoardCtx } from '@/lib/board'
import { cn } from '@/lib/cn'
import { AnimatePresence, motion, EASE } from '@/lib/motion'
import { Activity } from '@/sections/Activity'
import { AdminPanel } from '@/sections/AdminPanel'
import { Capacity } from '@/sections/Capacity'
import { Events } from '@/sections/Events'
import { Hero } from '@/sections/Hero'
import { Matrix } from '@/sections/Matrix'
import { Register } from '@/sections/Register'
import { Timeline } from '@/sections/Timeline'

/** Asked once per browser, the first time someone saves: the name shown in the change log. */
function NamePrompt() {
  const [open, setOpen] = useState(false)
  const current = useEditorName()
  const [name, setName] = useState(current)
  const resolver = useRef<((ok: boolean) => void) | null>(null)
  useEffect(() => {
    registerNamePrompt(
      () =>
        new Promise<boolean>((resolve) => {
          resolver.current = resolve
          setOpen(true)
        }),
    )
  }, [])
  const finish = (ok: boolean) => {
    setOpen(false)
    resolver.current?.(ok)
    resolver.current = null
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setEditorName(name)
    finish(true)
  }
  return (
    <Dialog id="name-title" open={open} onClose={() => finish(false)} title="قبل الحفظ: ما اسمك؟">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-fg-secondary">يظهر اسمك في سجل التعديلات بجانب كل تغيير تحفظه، ليعرف الجميع من حدّث ماذا. يُطلب مرة واحدة على هذا الجهاز.</p>
        <div>
          <label htmlFor="editor-name" className="field-label">
            الاسم
          </label>
          <input id="editor-name" data-autofocus className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoComplete="name" />
        </div>
        <div className="flex gap-2">
          <Button type="submit">متابعة الحفظ</Button>
          <Button variant="ghost" onClick={() => finish(false)}>
            إلغاء
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function SignIn({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refresh, toast } = useBoardCtx()
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setPw('')
      setError('')
    }
  }, [open])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.login(pw)
      onClose()
      toast('دخلت بصفة المشرف')
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الدخول.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog id="signin-title" open={open} onClose={onClose} title="دخول المشرف">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-fg-secondary">الجميع يستطيع إضافة المهام وتعديلها. المشرف يستطيع أيضًا الحذف وتغيير الطاقة الأسبوعية والقوائم واسترجاع التعديلات.</p>
        <div>
          <label htmlFor="admin-pw" className="field-label">
            كلمة المرور
          </label>
          <input
            id="admin-pw"
            data-autofocus
            type="password"
            className="field"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={!!error}
            aria-describedby={error ? 'admin-pw-err' : undefined}
          />
          {error && (
            <p id="admin-pw-err" className="mt-1.5 text-sm text-danger-700">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" disabled={busy}>
          دخول
        </Button>
      </form>
    </Dialog>
  )
}

function Toasts() {
  const { toasts } = useBoardCtx()
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-toast flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className={cn('rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm', t.tone === 'error' ? 'bg-danger-700 text-white' : 'bg-blue-900 text-white')}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function Board() {
  const { isAdmin, refresh, toast, state, conn } = useBoardCtx()
  const [signIn, setSignIn] = useState(false)
  const signOut = async () => {
    await api.logout()
    toast('خرجت من وضع المشرف')
    refresh()
  }
  return (
    <>
      <Header onSignIn={() => setSignIn(true)} onSignOut={signOut} />
      <main>
        <Hero />
        {!state && conn === 'offline' && (
          <div className="container-page py-10">
            <p className="rounded-xl border border-danger-100 bg-danger-50 p-4 text-danger-700">تعذّر تحميل اللوحة. تأكد من الاتصال ثم حدّث الصفحة.</p>
          </div>
        )}
        <Section id="matrix" spacing="none" className="py-8" labelledBy="matrix-title">
          <SectionHeading id="matrix-title" title="الأولويات والطاقة والفعاليات" className="sr-only" />
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Matrix />
            <div className="grid content-start gap-6 md:grid-cols-2 xl:grid-cols-1">
              <Capacity />
              <Events />
            </div>
          </div>
        </Section>
        <Section id="register" tone="soft" spacing="none" className="py-8" labelledBy="register-title">
          <SectionHeading id="register-title" title="سجل المهام" note="اضغط على أي مهمة لتعديلها" />
          <Register />
        </Section>
        <Section id="timeline" spacing="none" className="py-8" labelledBy="timeline-title">
          <SectionHeading id="timeline-title" title="الخط الزمني" />
          <Timeline />
        </Section>
        {isAdmin && (
          <Section id="activity" tone="soft" spacing="none" className="py-8" labelledBy="activity-title">
            <SectionHeading id="activity-title" title="سجل التعديلات" note="آخر ٥٠ تعديلًا ومن قام بها · للمشرف فقط" />
            <Activity />
          </Section>
        )}
        {isAdmin && (
          <Section id="admin" spacing="none" className="py-8" labelledBy="admin-title">
            <SectionHeading id="admin-title" title="إعدادات اللوحة" note="للمشرف فقط" />
            <AdminPanel />
          </Section>
        )}
      </main>
      <footer data-tone="dark" className="bg-brand-dark py-8 text-sm text-white/70">
        <div className="container-page flex flex-wrap items-center justify-between gap-3">
          <span>شركة المياه الوطنية · مكتب نائب الرئيس</span>
          <span>التعديلات تُحفظ فورًا وتظهر لدى الجميع</span>
        </div>
      </footer>
      <TaskSheet />
      <NamePrompt />
      <SignIn open={signIn} onClose={() => setSignIn(false)} />
      <Toasts />
    </>
  )
}

export default function App() {
  return (
    <BoardProvider>
      <Board />
    </BoardProvider>
  )
}
