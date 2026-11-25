import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])'

const visible = (el: HTMLElement) => el.offsetParent !== null || el.getClientRects().length > 0

const focusablesIn = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible)

/**
 * Modal focus management for dialogs (sheet, mobile menu, lightbox):
 *  - Tab / Shift+Tab cycle inside `ref`
 *  - Escape calls `onEscape`
 *  - on close, focus returns to `returnTo` (or whatever was focused when it opened)
 * Only the innermost open trap reacts (a lightbox inside the sheet wins).
 */
const stack: HTMLElement[] = []

export function useFocusTrap(
  ref: RefObject<HTMLElement>,
  open: boolean,
  { onEscape, returnTo }: { onEscape?: () => void; returnTo?: () => HTMLElement | null | undefined } = {},
) {
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    let node: HTMLElement | null = null
    // the dialog element mounts in the same commit; wait a frame for AnimatePresence children
    const raf = requestAnimationFrame(() => {
      node = ref.current
      if (!node) return
      stack.push(node)
      const target = node.querySelector<HTMLElement>('[data-autofocus]') ?? node
      target.focus({ preventScroll: true })
    })
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current
      if (!el || stack[stack.length - 1] !== el) return
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault()
        e.stopPropagation()
        onEscape()
        return
      }
      if (e.key !== 'Tab') return
      const f = focusablesIn(el)
      if (!f.length) {
        e.preventDefault()
        el.focus()
        return
      }
      const first = f[0]
      const last = f[f.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === el || !el.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !el.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey, true)
      const i = node ? stack.lastIndexOf(node) : -1
      if (i >= 0) stack.splice(i, 1)
      const back = returnTo?.() ?? opener
      if (back && document.contains(back)) back.focus({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}
