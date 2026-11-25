import { Eye, LogIn, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { SiteHeader } from '@ds/components/SiteHeader'
import { cn } from '@ds/lib/cn'
import { useBoardCtx } from '@/lib/board'

export const NAV = [
  { id: 'matrix', name: 'المصفوفة' },
  { id: 'timeline', name: 'الخط الزمني' },
  { id: 'register', name: 'المهام والفعاليات' },
  { id: 'activity', name: 'سجل التعديلات', admin: true },
]

/** The design system's header, with the board's own controls: live status and sign-in. */
export function Header({ onSignIn, onSignOut }: { onSignIn: () => void; onSignOut: () => void }) {
  const { isAdmin, user, conn } = useBoardCtx()
  // a working tool, not a story: the bar stays navy from the start
  const onDark = true

  return (
    <SiteHeader navLabel="أقسام اللوحة" nav={NAV.filter((n) => !n.admin || isAdmin).map((n) => ({ id: n.id, label: n.name }))}>
          <span
            className={cn('hidden items-center gap-2 text-xs sm:inline-flex', onDark ? 'text-white/80' : 'text-fg-tertiary')}
            title={conn === 'live' ? 'التعديلات تظهر لدى الجميع فور حفظها' : 'انقطع الاتصال المباشر. ستُحدَّث اللوحة عند عودته.'}
          >
            <span className={cn('h-2 w-2 rounded-full', conn === 'live' ? 'bg-teal-400' : conn === 'loading' ? 'bg-neutral-300' : 'bg-danger-500')} />
            {conn === 'live' ? 'مباشر' : conn === 'loading' ? 'جارٍ الاتصال' : 'غير متصل'}
          </span>
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              title="تسجيل الخروج"
              className={cn(
                'inline-flex h-9 max-w-[220px] items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors duration-fast',
                onDark ? 'border-white/30 text-white hover:bg-white/10' : 'border-line-subtle text-fg-primary hover:border-blue-200 hover:text-brand',
              )}
            >
              {isAdmin ? <ShieldCheck size={16} aria-hidden className="shrink-0 text-teal-300" /> : <UserRound size={16} aria-hidden className="shrink-0 text-teal-300" />}
              <span className="truncate">{user.name}</span>
              <span aria-hidden className="h-3 w-px shrink-0 bg-current opacity-30" />
              <LogOut size={15} aria-hidden className="shrink-0" />
              <span className="sr-only">تسجيل الخروج</span>
            </button>
          ) : (
            <>
            <span className="hidden items-center gap-1.5 rounded-full border border-white/25 px-2.5 py-1 text-xs text-white/85 sm:inline-flex">
              <Eye size={13} aria-hidden />
              للعرض فقط
            </span>
            <button
              type="button"
              onClick={onSignIn}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-fast',
                onDark ? 'bg-white text-brand hover:bg-blue-50' : 'bg-brand text-white hover:bg-brand-hover',
              )}
            >
              <LogIn size={16} aria-hidden />
              تسجيل الدخول
            </button>
            </>
          )}
    </SiteHeader>
  )
}
