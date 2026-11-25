import { useEffect, useState, type ReactNode } from 'react'
import logoWhite from '../assets/brand/logos/logo-white-horizontal-ar.svg'
import logoColor from '../assets/brand/logos/logo-colorful-horizontal-ar.svg'
import { cn } from '../lib/cn'

export interface NavItem {
  /** the id of the section the link scrolls to */
  id: string
  label: string
}

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

/** Scroll progress bar (teal, 3px) at the very top. */
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
 * The NWC site header: navy bar, 72px, fixed at the top, the white logo on the start side, the
 * section links, and the site's own controls on the end side (`children`), with a teal scroll
 * progress line. Pages leave `--header-h` (72px) free at the top.
 */
export function SiteHeader({
  nav,
  navLabel,
  homeHref = '#top',
  homeLabel = 'شركة المياه الوطنية — العودة إلى البداية',
  children,
  placement = 'fixed',
}: {
  nav: NavItem[]
  /** what the links are, for screen readers, e.g. «أقسام اللوحة» */
  navLabel: string
  homeHref?: string
  homeLabel?: string
  /** the end side: sign-in, status, language… */
  children?: ReactNode
  /** «static» only for the style guide, where the header sits in the page flow */
  placement?: 'fixed' | 'static'
}) {
  const scrolled = useScrolled(8)
  return (
    <header
      data-tone="dark"
      className={cn(
        placement === 'fixed' ? 'fixed inset-x-0 top-0 z-header' : 'relative',
        'border-b border-white/10 bg-blue-900 pt-[env(safe-area-inset-top)] transition-shadow duration-slow ease-standard',
        scrolled && placement === 'fixed' && 'shadow-sm',
      )}
    >
      <ScrollProgress />
      <div className="container-page flex h-[71px] items-center gap-4 lg:gap-6">
        <a href={homeHref} className="relative block h-11 w-[128px] shrink-0" aria-label={homeLabel}>
          <img src={logoWhite} alt="" className="absolute inset-0 h-full w-auto opacity-100 transition-opacity duration-slow" />
          <img src={logoColor} alt="" className="absolute inset-0 h-full w-auto opacity-0 transition-opacity duration-slow" />
        </a>

        <nav aria-label={navLabel} className="ms-2 hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  className="group relative inline-flex h-10 items-center rounded-md px-3 text-sm font-medium text-white/85 transition-colors duration-fast hover:text-white"
                >
                  {n.label}
                  <span aria-hidden className="absolute inset-x-3 bottom-1 h-0.5 origin-center scale-x-0 rounded-full bg-current transition-transform duration-base group-hover:scale-x-100" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-3">{children}</div>
      </div>
    </header>
  )
}
