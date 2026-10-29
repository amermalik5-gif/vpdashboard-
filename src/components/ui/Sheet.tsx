import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AnimatePresence, motion, EASE } from '@/lib/motion'
import { useScrollLock } from '@/lib/scroll'
import { useFocusTrap } from '@/lib/focusTrap'

interface SheetProps {
  open: boolean
  onClose: () => void
  /** Accessible title (also rendered by the caller inside the sheet). */
  labelledBy: string
  children: ReactNode
  /** Content shown in the sticky top bar (start side). */
  header?: ReactNode
  /** Extra controls in the top bar (end side, before the close button). */
  actions?: ReactNode
}

/**
 * Accessible dialog sheet sliding in from the end side (left in RTL): focus trap, Esc to
 * close, backdrop click, page scroll locked, focus restored on close. Full-screen on mobile.
 */
export function Sheet({ open, onClose, labelledBy, children, header, actions }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null)
  useScrollLock(open)

  // the trap effect only re-runs on open/close: read the latest onClose
  const close = useRef(onClose)
  close.current = onClose

  // Tab cycling + Esc + focus return; stack-aware, so a Lightbox opened inside wins
  useFocusTrap(panel, open, { onEscape: () => close.current() })

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-sheet" data-print="expand" data-sheet>
          <motion.div
            className="absolute inset-0 bg-blue-900/60 backdrop-blur-glass"
            data-print="hide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            className="absolute inset-y-0 end-0 flex w-full flex-col overflow-hidden bg-page shadow-2xl outline-none md:max-w-[880px] min-[900px]:rounded-s-2xl"
            initial={{ x: '-24%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-16%', opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <div
              data-print="hide"
              className="flex items-center gap-3 border-b border-line-subtle bg-surface py-3 pe-[max(1.25rem,env(safe-area-inset-left))] ps-[max(1.25rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] md:pe-[max(2rem,env(safe-area-inset-left))] md:ps-[max(2rem,env(safe-area-inset-right))]"
            >
              <div className="min-w-0 flex-1">{header}</div>
              {actions}
              <button
                type="button"
                onClick={onClose}
                data-autofocus
                aria-label="إغلاق"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-secondary transition-colors duration-fast hover:bg-neutral-100 hover:text-fg-primary"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <div data-lenis-prevent data-sheet-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
