import { EXPECTATIONS, type Task } from './types'

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
export type Status = 'red' | 'amber' | 'green' | 'done'
export const statusOf = (t: Task): Status => (t.progress >= 100 ? 'done' : t.progress >= 40 ? 'green' : t.progress >= 20 ? 'amber' : 'red')
export const STATUS: Record<Status, { name: string; color: string; badge: 'danger' | 'warning' | 'success' | 'neutral' }> = {
  red: { name: 'أقل من ٢٠٪', color: 'var(--status-red)', badge: 'danger' },
  amber: { name: '٢٠–٣٩٪', color: 'var(--status-amber)', badge: 'warning' },
  green: { name: '٤٠٪ فأكثر', color: 'var(--status-green)', badge: 'success' },
  done: { name: 'مكتملة', color: 'var(--status-done)', badge: 'neutral' },
}
export const isOpen = (t: Task) => t.progress < 100

/* ---------- capacity ---------- */
/** Sum of effort of every unfinished task active during the week starting `ws`. */
export function weekLoad(tasks: Task[], ws: Date): number {
  const we = addDays(ws, 6)
  return tasks.filter(isOpen).reduce((sum, t) => {
    const [a, b] = span(t)
    return a <= we && b >= ws ? sum + (t.effort ?? 0) : sum
  }, 0)
}
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
/** Greedy packing: an item goes on the first row whose last item (bar or label) ends before it starts. */
export function packRows<T extends { s: Date; e: Date }>(items: T[], pos: (d: Date) => number, labelMin: number): T[][] {
  const rows: T[][] = []
  const sorted = [...items].sort((a, b) => a.s.getTime() - b.s.getTime())
  for (const o of sorted) {
    const end = (r: T[]) => {
      const last = r[r.length - 1]
      return Math.max(pos(last.e), pos(last.s) + labelMin)
    }
    let row = rows.find((r) => end(r) + 0.5 < pos(o.s))
    if (!row) rows.push((row = []))
    row.push(o)
  }
  return rows
}
