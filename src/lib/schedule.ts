import { EXPECTATIONS, TASK_STATUSES, type Task, type TaskStatus } from './types'

/* ---------- dates (local, day precision) ---------- */
export const parseDate = (s: string): Date | null => {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (d: Date, n: number) => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
export const today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
/** Saudi work week: weeks start on Sunday. */
export const weekStart = (d: Date) => addDays(d, -d.getDay())
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5)

/** Start and end of a task. Without an end date it runs start + expected time (2 weeks if none). */
export function span(t: Task): [Date, Date] {
  const s = parseDate(t.start) ?? today()
  let e = parseDate(t.end)
  if (!e) e = addDays(s, t.expectation ? EXPECTATIONS[t.expectation].days : 14)
  return [s, e < s ? s : e]
}

/* ---------- status ---------- */
/**
 * The colour follows the item's status, set by the team (31 Oct 2026). Complete is always green;
 * a passed date makes an open item late; with no status set it reads from the progress.
 */
export type Status = Exclude<TaskStatus, ''>
export const isDone = (t: Task) => t.status === 'done' || (!t.status && t.progress >= 100)
export const isOpen = (t: Task) => !isDone(t)
export const statusOf = (t: Task): Status => {
  if (isDone(t)) return 'done'
  if (isOverdue(t)) return 'late'
  if (t.status) return t.status
  return t.progress > 0 ? 'on-track' : 'not-started'
}
export const STATUS: Record<Status, { name: string; color: string }> = {
  'not-started': { name: TASK_STATUSES['not-started'], color: 'var(--status-not-started)' },
  'on-track': { name: TASK_STATUSES['on-track'], color: 'var(--status-on-track)' },
  'at-risk': { name: TASK_STATUSES['at-risk'], color: 'var(--status-at-risk)' },
  late: { name: TASK_STATUSES.late, color: 'var(--status-late)' },
  done: { name: TASK_STATUSES.done, color: 'var(--status-done)' },
}
/** The patch for a new status: complete also fills the progress. */
export const statusPatch = (status: Status): Partial<Task> => (status === 'done' ? { status, progress: 100 } : { status })
/** The patch for a new progress: 100% completes the item, going back below reopens it. */
export const progressPatch = (t: Task, progress: number): Partial<Task> =>
  progress >= 100 && t.status && t.status !== 'done' ? { progress, status: 'done' } : progress < 100 && t.status === 'done' ? { progress, status: '' } : { progress }

/** The item has a date: one set by the VP, or one estimated from an expected duration. */
export const hasDate = (t: Task) => !!t.end || !!t.expectation
/** Open, dated, and its day has passed. */
export const isOverdue = (t: Task, now = today()) => isOpen(t) && hasDate(t) && span(t)[1] < now
export const daysOverdue = (t: Task, now = today()) => Math.max(0, daysBetween(span(t)[1], now))

/**
 * Each item's number: its place in the list, which anyone can change by dragging it
 * (new items go to the end). The matrix bubbles, the list beside them and the table share it.
 */
export function itemNumbers(tasks: Task[]): Map<string, number> {
  const order = [...tasks].sort((a, b) => a.position - b.position || a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  return new Map(order.map((t, i) => [t.id, i + 1]))
}

/* ---------- capacity ---------- */
/**
 * This week's share of the team's effort. Effort is a task's total size (1–10, entered by hand),
 * so what is still left of it (effort × remaining progress) is spread evenly over the weeks left
 * until launch. Overdue work lands entirely in the current week; a task counts nothing before
 * the week it starts.
 */
export function weekShare(t: Task, ws: Date): number {
  if (!isOpen(t) || !t.effort) return 0
  const remaining = (t.effort * (100 - t.progress)) / 100
  const [a, b] = span(t)
  const we = addDays(ws, 6)
  if (b < ws) return remaining
  if (a > we) return 0
  const from = weekStart(a > ws ? a : ws)
  const weeks = Math.floor(daysBetween(from, weekStart(b)) / 7) + 1
  return remaining / Math.max(1, weeks)
}
export const weekLoad = (tasks: Task[], ws: Date): number => tasks.reduce((sum, t) => sum + weekShare(t, ws), 0)
export const loadTone = (pct: number) => (pct > 100 ? 'red' : pct >= 80 ? 'amber' : 'green')

/* ---------- bubble layout ---------- */
export interface Bubble {
  t: Task
  x: number
  y: number
  r: number
}

/**
 * Tasks that land on the same priority/urgency point would hide each other: push overlapping
 * bubbles apart (a few relaxation passes), keeping them inside the plot.
 */
export function spreadBubbles(items: Bubble[], box: { x0: number; x1: number; y0: number; y1: number }): Bubble[] {
  const out = items.map((b) => ({ ...b }))
  for (let it = 0; it < 120; it++) {
    let moved = false
    for (let a = 0; a < out.length; a++)
      for (let b = a + 1; b < out.length; b++) {
        const A = out[a]
        const B = out[b]
        let dx = B.x - A.x
        let dy = B.y - A.y
        let d = Math.hypot(dx, dy)
        const min = A.r + B.r + 3
        if (d >= min) continue
        if (d < 0.01) {
          const ang = b * 2.4
          dx = Math.cos(ang)
          dy = Math.sin(ang)
          d = 1
        }
        const push = (min - d) / 2
        A.x -= (dx / d) * push
        A.y -= (dy / d) * push
        B.x += (dx / d) * push
        B.y += (dy / d) * push
        moved = true
      }
    for (const p of out) {
      p.x = Math.min(box.x1 - p.r * 0.5, Math.max(box.x0 + p.r * 0.5, p.x))
      p.y = Math.min(box.y1 - p.r * 0.5, Math.max(box.y0 + p.r * 0.5, p.y))
    }
    if (!moved) break
  }
  return out
}

/* ---------- timeline rows ---------- */
/**
 * Greedy packing: each item occupies a span of the track (its marker plus its label, as % of the
 * track) and goes on the first row where it overlaps nothing already placed.
 */
export function packRows<T>(items: T[], extent: (o: T) => [number, number]): T[][] {
  const rows: [number, number][][] = []
  const out: T[][] = []
  const sorted = [...items].sort((a, b) => extent(a)[0] - extent(b)[0])
  for (const o of sorted) {
    const [lo, hi] = extent(o)
    let i = rows.findIndex((r) => r.every(([a, b]) => hi + 0.5 < a || lo > b + 0.5))
    if (i < 0) {
      i = rows.length
      rows.push([])
      out.push([])
    }
    rows[i].push([lo, hi])
    out[i].push(o)
  }
  return out
}
