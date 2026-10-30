import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { AuditEntry, BoardState, EventItem, Settings, Task } from './types'

/* ---------- the editor's display name (asked once per browser) ---------- */
const NAME_KEY = 'vp:editor-name'
let editorName = (() => {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
})()
const nameListeners = new Set<() => void>()
export function setEditorName(n: string) {
  editorName = n.trim().slice(0, 60)
  try {
    localStorage.setItem(NAME_KEY, editorName)
  } catch {
    /* private mode: keep it for this visit */
  }
  nameListeners.forEach((l) => l())
}
export const useEditorName = () =>
  useSyncExternalStore(
    (cb) => (nameListeners.add(cb), () => nameListeners.delete(cb)),
    () => editorName,
  )

/** Resolved by the name dialog when a save needs a name first. */
let askName: (() => Promise<boolean>) | null = null
export const registerNamePrompt = (fn: () => Promise<boolean>) => (askName = fn)

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function call<T>(method: string, path: string, body?: unknown, anonymous = false): Promise<T> {
  const write = method !== 'GET' && !anonymous
  if (write && !editorName && askName && !(await askName())) throw new ApiError('أُلغي الحفظ.', 0)
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(write && { 'x-editor': encodeURIComponent(editorName) }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error ?? 'تعذّر الاتصال بالخادم. حاول مرة أخرى.', res.status)
  return data as T
}

export const api = {
  state: () => call<BoardState>('GET', '/state'),
  audit: (limit = 50) => call<AuditEntry[]>('GET', `/audit?limit=${limit}`),
  addTask: (t: Partial<Task>) => call<Task>('POST', '/tasks', t),
  updateTask: (id: string, patch: Partial<Task>) => call<Task>('PATCH', `/tasks/${id}`, patch),
  deleteTask: (id: string) => call<void>('DELETE', `/tasks/${id}`),
  addEvent: (e: Partial<EventItem>) => call<EventItem>('POST', '/events', e),
  updateEvent: (id: string, patch: Partial<EventItem>) => call<EventItem>('PATCH', `/events/${id}`, patch),
  deleteEvent: (id: string) => call<void>('DELETE', `/events/${id}`),
  saveSettings: (s: Partial<Settings>) => call<Settings>('PUT', '/settings', s),
  restore: (auditId: number) => call<{ ok: true }>('POST', `/audit/${auditId}/restore`),
  restoreBackup: (file: unknown) => call<{ ok: true; tasks: number; events: number }>('POST', '/backup/restore', file),
  login: (password: string) => call<{ isAdmin: boolean }>('POST', '/login', { password }, true),
  logout: () => call<{ isAdmin: boolean }>('POST', '/logout', undefined, true),
}

/* ---------- board state, refreshed live over Server-Sent Events ---------- */
export type Conn = 'loading' | 'live' | 'offline'

export function useBoard() {
  const [state, setState] = useState<BoardState | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [conn, setConn] = useState<Conn>('loading')
  const busy = useRef<Promise<void> | null>(null)
  const again = useRef(false)

  const refresh = useCallback((): Promise<void> => {
    // one fetch at a time; a change that arrives mid-fetch triggers one more fetch afterwards,
    // so the screen never settles on data older than the last save
    if (busy.current) {
      again.current = true
      return busy.current
    }
    busy.current = api
      .state()
      .then(async (s) => {
        setState(s)
        // the change log is for the admin only; the server refuses it to everyone else
        setAudit(s.isAdmin ? await api.audit(50).catch(() => []) : [])
      })
      .catch(() => setConn('offline'))
      .finally(() => {
        busy.current = null
        if (again.current) {
          again.current = false
          void refresh()
        }
      })
    return busy.current
  }, [])

  useEffect(() => {
    refresh()
    const es = new EventSource('/api/stream')
    es.addEventListener('hello', () => {
      setConn('live')
      refresh()
    })
    es.addEventListener('change', () => refresh())
    es.onerror = () => setConn('offline')
    return () => es.close()
  }, [refresh])

  return { state, audit, conn, refresh, setState }
}
