import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useBoard, type Conn } from './api'
import { editsAll, type AuditEntry, type BoardState, type Option, type Task } from './types'

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}

interface BoardApi {
  state: BoardState | null
  audit: AuditEntry[]
  conn: Conn
  /** the signed-in account; null for a visitor */
  user: BoardState['user']
  /** signed in: may update at least the team's fields (visitors only view) */
  canEdit: boolean
  /** the VP or the admin: every field, adding, deleting, dragging and confirming drafts */
  canEditAll: boolean
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
  /** The table shows only the items ready for launch (from the summary tile). */
  readyOnly: boolean
  setReadyOnly: (on: boolean) => void
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
  const [readyOnly, setReadyOnly] = useState(false)
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
        // the server's message (e.g. a session that ended), and back to the saved values
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
      user: state?.user ?? null,
      canEdit: !!state?.user,
      canEditAll: editsAll(state?.user?.role),
      isAdmin: state?.user?.role === 'admin',
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
      readyOnly,
      setReadyOnly,
    }
  }, [state, audit, conn, refresh, editing, toast, toasts, run, patchLocal, readyOnly])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
