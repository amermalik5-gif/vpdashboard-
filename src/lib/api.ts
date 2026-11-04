import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuditEntry, BoardState, EventItem, Role, Settings, Task, UserInfo } from './types'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

/** Changes are made by a signed-in account (the session cookie); the server records its name. */
async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
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
  /** Put the item at number `to` in the list; the others are renumbered. */
  moveTask: (id: string, to: number) => call<{ from: number; to: number }>('POST', `/tasks/${id}/move`, { to }),
  deleteTask: (id: string) => call<void>('DELETE', `/tasks/${id}`),
  addEvent: (e: Partial<EventItem>) => call<EventItem>('POST', '/events', e),
  updateEvent: (id: string, patch: Partial<EventItem>) => call<EventItem>('PATCH', `/events/${id}`, patch),
  deleteEvent: (id: string) => call<void>('DELETE', `/events/${id}`),
  saveSettings: (s: Partial<Settings>) => call<Settings>('PUT', '/settings', s),
  restore: (auditId: number) => call<{ ok: true }>('POST', `/audit/${auditId}/restore`),
  restoreBackup: (file: unknown) => call<{ ok: true; tasks: number; events: number }>('POST', '/backup/restore', file),
  login: (username: string, password: string) => call<{ user: { name: string; role: Role } }>('POST', '/login', { username, password }),
  logout: () => call<{ user: null }>('POST', '/logout'),
  users: () => call<UserInfo[]>('GET', '/users'),
  addUser: (u: { username: string; name: string; role: Role; password: string }) => call<UserInfo>('POST', '/users', u),
  updateUser: (id: string, patch: Partial<{ name: string; role: Role; active: boolean; password: string }>) => call<UserInfo>('PATCH', `/users/${id}`, patch),
  deleteUser: (id: string) => call<void>('DELETE', `/users/${id}`),
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
