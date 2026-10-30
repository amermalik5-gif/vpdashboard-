import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, useBoard, type Conn } from './api'
import type { AuditEntry, BoardState, Option, Task } from './types'

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}

interface BoardApi {
  state: BoardState | null
  audit: AuditEntry[]
  conn: Conn
  isAdmin: boolean
  refresh: () => void
  labelName: (id: string) => string
  labels: Option[]
  /** Open the task drawer (null = new task) */
  openTask: (id: string | null) => void
  editing: { open: boolean; id: string | null }
  closeTask: () => void
  toast: (text: string, tone?: Toast['tone']) => void
  toasts: Toast[]
  /** Runs a save: shows the server's message on failure, refreshes on success. */
  run: <T>(p: () => Promise<T>, done?: string) => Promise<T | undefined>
  /** Optimistic local patch so drags and edits feel instant before the live refresh. */
  patchLocal: (id: string, patch: Partial<Task>) => void
}

const Ctx = createContext<BoardApi | null>(null)
export const useBoardCtx = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('BoardProvider missing')
  return c
}

export function BoardProvider({ children }: { children: ReactNode }) {
  const { state, audit, conn, refresh, setState } = useBoard()
  const [editing, setEditing] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++seq.current
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const run = useCallback(
    async <T,>(p: () => Promise<T>, done?: string) => {
      try {
        const r = await p()
        if (done) toast(done)
        refresh()
        return r
      } catch (e) {
        // cancelled at the name prompt: drop any optimistic change (e.g. a dragged bubble)
        if (e instanceof ApiError && e.status === 0) return void refresh()
        toast(e instanceof Error ? e.message : 'تعذّر الحفظ.', 'error')
        refresh()
      }
    },
    [refresh, toast],
  )

  const patchLocal = useCallback(
    (id: string, patch: Partial<Task>) => setState((s) => s && { ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
    [setState],
  )

  const value = useMemo<BoardApi>(() => {
    const labels = state?.settings.labels ?? []
    return {
      state,
      audit,
      conn,
      isAdmin: !!state?.isAdmin,
      refresh,
      labels,
      labelName: (id) => labels.find((l) => l.id === id)?.name ?? 'بدون مستوى',
      openTask: (id) => setEditing({ open: true, id }),
      editing,
      closeTask: () => setEditing((e) => ({ ...e, open: false })),
      toast,
      toasts,
      run,
      patchLocal,
    }
  }, [state, audit, conn, refresh, editing, toast, toasts, run, patchLocal])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
