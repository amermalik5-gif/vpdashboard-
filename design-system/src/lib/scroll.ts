import { useEffect } from 'react'

/** Freeze page scrolling while a dialog is open (keeps the scrollbar gutter, so nothing jumps). */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prev
    }
  }, [locked])
}
