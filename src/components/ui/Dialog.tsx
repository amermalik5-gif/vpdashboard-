import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AnimatePresence, motion, EASE } from '@/lib/motion'
import { useFocusTrap } from '@/lib/focusTrap'
import { useScrollLock } from '@/lib/scroll'

/** Small centred dialog (name prompt, admin sign-in, confirmations) in the Sheet's visual language. */
export function Dialog({ open, onClose, title, children, id }: { open: boolean; onClose: () => void; title: string; children: ReactNode; id: string }) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useScrollLock(open)
  useFocusTrap(panel, open, { onEscape: () => close.current() })
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-sheet grid place-items-center p-4">
          <motion.div
            className="absolute inset-0 bg-blue-900/60 backdrop-blur-glass"
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
            aria-labelledby={id}
            tabIndex={-1}
            className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl outline-none"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id={id} className="text-xl font-medium text-fg-primary">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="-m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-secondary hover:bg-neutral-100 hover:text-fg-primary"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
