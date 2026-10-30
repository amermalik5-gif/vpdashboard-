import { useEffect, useState } from 'react'
import { LogIn, LogOut, ShieldCheck } from 'lucide-react'
import logoWhite from '@/assets/brand/logos/logo-white-horizontal-ar.svg'
import logoColor from '@/assets/brand/logos/logo-colorful-horizontal-ar.svg'
import { cn } from '@/lib/cn'
import { useBoardCtx } from '@/lib/board'

export const NAV = [
  { id: 'matrix', name: 'المصفوفة' },
  { id: 'register', name: 'المهام والفعاليات' },
  { id: 'timeline', name: 'الخط الزمني' },
  { id: 'activity', name: 'سجل التعديلات', admin: true },
]

function useScrolled(y: number) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const check = () => setPast(window.scrollY > y)
    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [y])
  return past
}

/** Scroll progress bar (teal, 3px) at the very top, as in the booklet. */
function ScrollProgress() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      setP(h > 0 ? window.scrollY / h : 0)
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [])
  return <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] origin-right bg-teal-500" style={{ transform: `scaleX(${p})` }} />
}

/**
 * Fixed header in the booklet's pattern: transparent with the white logo over the navy hero,
 * white glass with the colourful logo once the page scrolls.
 */
export function Header({ onSignIn, onSignOut }: { onSignIn: () => void; onSignOut: () => void }) {
  const scrolled = useScrolled(8)
  const { isAdmin, conn } = useBoardCtx()
  // a working tool, not a story: the bar stays navy (the booklet's dark-section glass) from the start
  const onDark = true

  return (
    <header
      data-tone="dark"
      className={cn(
        'fixed inset-x-0 top-0 z-header border-b border-white/10 bg-blue-900 pt-[env(safe-area-inset-top)] transition-shadow duration-slow ease-standard',
        scrolled && 'shadow-sm',
      )}
    >
      <ScrollProgress />
      <div className="container-page flex h-[71px] items-center gap-4 lg:gap-6">
        <a href="#top" className="relative block h-11 w-[128px] shrink-0" aria-label="شركة المياه الوطنية — العودة إلى البداية">
          <img src={logoWhite} alt="" className={cn('absolute inset-0 h-full w-auto transition-opacity duration-slow', onDark ? 'opacity-100' : 'opacity-0')} />
          <img src={logoColor} alt="" className={cn('absolute inset-0 h-full w-auto transition-opacity duration-slow', onDark ? 'opacity-0' : 'opacity-100')} />
        </a>

        <nav aria-label="أقسام اللوحة" className="ms-2 hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.filter((n) => !n.admin || isAdmin).map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  className={cn(
                    'group relative inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors duration-fast',
                    onDark ? 'text-white/85 hover:text-white' : 'text-fg-secondary hover:text-brand',
                  )}
                >
                  {n.name}
                  <span aria-hidden className="absolute inset-x-3 bottom-1 h-0.5 origin-center scale-x-0 rounded-full bg-current transition-transform duration-base group-hover:scale-x-100" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <span
            className={cn('hidden items-center gap-2 text-xs sm:inline-flex', onDark ? 'text-white/80' : 'text-fg-tertiary')}
            title={conn === 'live' ? 'التعديلات تظهر لدى الجميع فور حفظها' : 'انقطع الاتصال المباشر. ستُحدَّث اللوحة عند عودته.'}
          >
            <span className={cn('h-2 w-2 rounded-full', conn === 'live' ? 'bg-teal-400' : conn === 'loading' ? 'bg-neutral-300' : 'bg-danger-500')} />
            {conn === 'live' ? 'مباشر' : conn === 'loading' ? 'جارٍ الاتصال' : 'غير متصل'}
          </span>
          {isAdmin ? (
            <button
              type="button"
              onClick={onSignOut}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors duration-fast',
                onDark ? 'border-white/30 text-white hover:bg-white/10' : 'border-line-subtle text-fg-primary hover:border-blue-200 hover:text-brand',
              )}
            >
              <ShieldCheck size={16} aria-hidden className={onDark ? 'text-teal-300' : 'text-teal-600'} />
              <span>مشرف</span>
              <span aria-hidden className="h-3 w-px bg-current opacity-30" />
              <LogOut size={15} aria-hidden />
              <span className="sr-only">تسجيل الخروج</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-fast',
                onDark ? 'bg-white text-brand hover:bg-blue-50' : 'bg-brand text-white hover:bg-brand-hover',
              )}
            >
              <LogIn size={16} aria-hidden />
              دخول المشرف
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
