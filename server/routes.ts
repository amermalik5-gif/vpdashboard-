import { Router, type Request, type Response } from 'express'
import { EXPECTATIONS, EVENT_FIELDS, TASK_FIELDS, type EventItem, type Option, type Settings, type Task } from '../src/lib/types.ts'
import * as store from './db.ts'
import { checkPassword, clearAdminCookie, isAdmin, rateLimit, requireAdmin, setAdminCookie } from './auth.ts'

/* ---------- live updates (Server-Sent Events) ---------- */
let version = Date.now()
const clients = new Set<Response>()
function changed() {
  version = Date.now()
  for (const c of clients) c.write(`event: change\ndata: ${version}\n\n`)
}
setInterval(() => {
  for (const c of clients) c.write(': ping\n\n')
}, 25_000).unref()

/* ---------- validation ---------- */
class Invalid extends Error {}
const DATE = /^\d{4}-\d{2}-\d{2}$/

const str = (v: unknown, max: number, field: string) => {
  if (v == null) return ''
  if (typeof v !== 'string') throw new Invalid(`${field}: قيمة غير صالحة.`)
  return v.trim().slice(0, max)
}
const intIn = (v: unknown, lo: number, hi: number, field: string, nullable = true): number | null => {
  if (v === null || v === '' || v === undefined) {
    if (nullable) return null
    throw new Invalid(`${field}: مطلوب.`)
  }
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Invalid(`${field}: يجب أن يكون رقمًا.`)
  return Math.round(Math.min(hi, Math.max(lo, n)))
}
const date = (v: unknown, field: string) => {
  const s = str(v, 10, field)
  if (s && (!DATE.test(s) || Number.isNaN(Date.parse(s)))) throw new Invalid(`${field}: تاريخ غير صالح.`)
  return s
}

function cleanTaskField(k: (typeof TASK_FIELDS)[number], v: unknown): unknown {
  switch (k) {
    case 'title': {
      const s = str(v, 160, 'العنوان')
      if (!s) throw new Invalid('اكتب عنوانًا للمهمة.')
      return s
    }
    case 'category':
    case 'owner':
      return str(v, 80, k)
    case 'label':
      return str(v, 40, k)
    case 'notes':
      return str(v, 2000, k)
    case 'priority':
    case 'urgency':
      return intIn(v, 0, 10, k)
    case 'effort':
      return intIn(v, 1, 10, k)
    case 'progress':
      return intIn(v, 0, 100, k, false)
    case 'expectation': {
      const s = str(v, 4, k)
      if (s && !(s in EXPECTATIONS)) throw new Invalid('مدة متوقعة غير معروفة.')
      return s
    }
    case 'start':
    case 'end':
      return date(v, k)
    case 'draft':
      return !!v
  }
}

function cleanEventField(k: (typeof EVENT_FIELDS)[number], v: unknown): unknown {
  switch (k) {
    case 'name': {
      const s = str(v, 160, 'الاسم')
      if (!s) throw new Invalid('اكتب اسمًا للفعالية.')
      return s
    }
    case 'date':
      return date(v, k)
    case 'type':
      return str(v, 40, k)
    case 'notes':
      return str(v, 2000, k)
    case 'draft':
      return !!v
  }
}

function pick<K extends string>(body: unknown, fields: readonly K[], clean: (k: K, v: unknown) => unknown) {
  if (!body || typeof body !== 'object') throw new Invalid('طلب غير صالح.')
  const out: Partial<Record<K, unknown>> = {}
  for (const k of fields) if (k in (body as object)) out[k] = clean(k, (body as Record<string, unknown>)[k])
  return out
}

/** Who made the change: the display name each browser asks for once. */
function editor(req: Request): string {
  const raw = req.get('x-editor')
  let name = ''
  try {
    name = raw ? decodeURIComponent(raw).trim().slice(0, 60) : ''
  } catch {
    /* malformed header */
  }
  if (!name) throw new Invalid('اكتب اسمك قبل الحفظ ليظهر في سجل التعديلات.')
  return isAdmin(req) ? `${name} (مشرف)` : name
}

const handle = (fn: (req: Request, res: Response) => unknown) => (req: Request, res: Response) => {
  try {
    fn(req, res)
  } catch (e) {
    if (e instanceof Invalid) return res.status(400).json({ error: e.message })
    console.error(e)
    res.status(500).json({ error: 'تعذّر الحفظ. حاول مرة أخرى بعد قليل.' })
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export const api = Router()
const writes = rateLimit(120, 60_000, 'تعديلات كثيرة خلال دقيقة. انتظر قليلًا ثم حاول مجددًا.')

api.get('/state', (req, res) => {
  res.json({ tasks: store.listTasks(), events: store.listEvents(), settings: store.getSettings(), isAdmin: isAdmin(req), version })
})

api.get('/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  res.flushHeaders()
  res.write(`retry: 5000\nevent: hello\ndata: ${version}\n\n`)
  clients.add(res)
  req.on('close', () => clients.delete(res))
})

api.get('/audit', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50))
  res.json(store.listAudit(limit))
})

/* ---------- backups (admin): a full JSON copy, and the tasks as a spreadsheet ---------- */
const stamp = () => new Date().toISOString().slice(0, 10)

api.get('/backup', requireAdmin, (_req, res) => {
  const body = {
    app: 'vp-dashboard',
    format: 1,
    exportedAt: new Date().toISOString(),
    settings: store.getSettings(),
    tasks: store.listTasks(),
    events: store.listEvents(),
    audit: store.allAudit(),
  }
  res.set('Content-Disposition', `attachment; filename="vp-dashboard-backup-${stamp()}.json"`)
  res.type('application/json').send(JSON.stringify(body, null, 2))
})

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

api.get('/backup/tasks.csv', requireAdmin, (_req, res) => {
  const { labels } = store.getSettings()
  const labelName = (id: string) => labels.find((l) => l.id === id)?.name ?? id
  const head = ['المهمة', 'الفئة', 'المستوى', 'درجة الأهمية', 'مستوى الاستعجال', 'المدة المتوقعة', 'الجهد', 'نسبة الإنجاز', 'تاريخ البدء', 'تاريخ الإطلاق', 'المسؤول', 'الملاحظات', 'بانتظار التأكيد', 'آخر تعديل بواسطة', 'آخر تعديل']
  const rows = store.listTasks().map((t) => [
    t.title,
    t.category,
    labelName(t.label),
    t.priority,
    t.urgency,
    t.expectation ? EXPECTATIONS[t.expectation].name : '',
    t.effort,
    t.progress,
    t.start,
    t.end,
    t.owner,
    t.notes,
    t.draft ? 'نعم' : 'لا',
    t.updatedBy,
    new Date(t.updatedAt).toISOString().replace('T', ' ').slice(0, 16),
  ])
  // UTF-8 BOM so Excel opens the Arabic text correctly
  const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
  res.set('Content-Disposition', `attachment; filename="vp-dashboard-tasks-${stamp()}.csv"`)
  res.type('text/csv; charset=utf-8').send(csv)
})

/* ---------- tasks: everyone adds and edits, admin deletes ---------- */
api.post(
  '/tasks',
  writes,
  handle((req, res) => {
    const by = editor(req)
    const f = pick(req.body, TASK_FIELDS, cleanTaskField) as Partial<Task>
    if (!f.title) throw new Invalid('اكتب عنوانًا للمهمة.')
    const task = store.insertTask(
      {
        title: f.title,
        category: f.category ?? '',
        label: f.label ?? '',
        priority: f.priority ?? null,
        urgency: f.urgency ?? null,
        expectation: f.expectation ?? '',
        effort: f.effort ?? null,
        progress: f.progress ?? 0,
        start: f.start || new Date().toISOString().slice(0, 10),
        end: f.end ?? '',
        owner: f.owner ?? '',
        notes: f.notes ?? '',
        draft: false,
      },
      by,
    )
    store.audit({ entity: 'task', entityId: task.id, entityTitle: task.title, action: 'create', field: '', old: null, new: task, by })
    changed()
    res.status(201).json(task)
  }),
)

api.patch(
  '/tasks/:id',
  writes,
  handle((req, res) => {
    const by = editor(req)
    const before = store.getTask(req.params.id)
    if (!before) return res.status(404).json({ error: 'لم تعد هذه المهمة موجودة.' })
    const f = pick(req.body, TASK_FIELDS, cleanTaskField) as Record<string, unknown>
    const diff: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(f)) if (!same(v, before[k as keyof Task])) diff[k] = v
    if (Object.keys(diff).length) {
      store.db.transaction(() => {
        store.updateRow('tasks', before.id, diff, by)
        for (const [k, v] of Object.entries(diff))
          store.audit({ entity: 'task', entityId: before.id, entityTitle: (diff.title as string) ?? before.title, action: 'update', field: k, old: before[k as keyof Task], new: v, by })
      })()
      changed()
    }
    res.json(store.getTask(before.id))
  }),
)

api.delete(
  '/tasks/:id',
  requireAdmin,
  handle((req, res) => {
    const by = editor(req)
    const before = store.getTask(req.params.id)
    if (!before) return res.status(404).json({ error: 'لم تعد هذه المهمة موجودة.' })
    store.deleteRow('tasks', before.id)
    store.audit({ entity: 'task', entityId: before.id, entityTitle: before.title, action: 'delete', field: '', old: before, new: null, by })
    changed()
    res.status(204).end()
  }),
)

/* ---------- events ---------- */
api.post(
  '/events',
  writes,
  handle((req, res) => {
    const by = editor(req)
    const f = pick(req.body, EVENT_FIELDS, cleanEventField) as Partial<EventItem>
    if (!f.name) throw new Invalid('اكتب اسمًا للفعالية.')
    const ev = store.insertEvent({ name: f.name, date: f.date ?? '', type: f.type ?? 'event', notes: f.notes ?? '', draft: false }, by)
    store.audit({ entity: 'event', entityId: ev.id, entityTitle: ev.name, action: 'create', field: '', old: null, new: ev, by })
    changed()
    res.status(201).json(ev)
  }),
)

api.patch(
  '/events/:id',
  writes,
  handle((req, res) => {
    const by = editor(req)
    const before = store.getEvent(req.params.id)
    if (!before) return res.status(404).json({ error: 'لم تعد هذه الفعالية موجودة.' })
    const f = pick(req.body, EVENT_FIELDS, cleanEventField) as Record<string, unknown>
    const diff: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(f)) if (!same(v, before[k as keyof EventItem])) diff[k] = v
    if (Object.keys(diff).length) {
      store.db.transaction(() => {
        store.updateRow('events', before.id, diff, by)
        for (const [k, v] of Object.entries(diff))
          store.audit({ entity: 'event', entityId: before.id, entityTitle: (diff.name as string) ?? before.name, action: 'update', field: k, old: before[k as keyof EventItem], new: v, by })
      })()
      changed()
    }
    res.json(store.getEvent(before.id))
  }),
)

api.delete(
  '/events/:id',
  requireAdmin,
  handle((req, res) => {
    const by = editor(req)
    const before = store.getEvent(req.params.id)
    if (!before) return res.status(404).json({ error: 'لم تعد هذه الفعالية موجودة.' })
    store.deleteRow('events', before.id)
    store.audit({ entity: 'event', entityId: before.id, entityTitle: before.name, action: 'delete', field: '', old: before, new: null, by })
    changed()
    res.status(204).end()
  }),
)

/* ---------- settings (admin) ---------- */
const cleanOptions = (v: unknown, field: string): Option[] => {
  if (!Array.isArray(v) || !v.length || v.length > 30) throw new Invalid(`${field}: قائمة غير صالحة.`)
  const seen = new Set<string>()
  return v.map((o) => {
    const id = str((o as Option)?.id, 40, field).replace(/[^\w-]/g, '')
    const name = str((o as Option)?.name, 60, field)
    if (!id || !name || seen.has(id)) throw new Invalid(`${field}: كل عنصر يحتاج اسمًا فريدًا.`)
    seen.add(id)
    return { id, name }
  })
}

api.put(
  '/settings',
  requireAdmin,
  handle((req, res) => {
    const by = editor(req)
    const body = (req.body ?? {}) as Partial<Settings>
    const before = store.getSettings()
    const next: Partial<Settings> = {}
    if ('weeklyCapacity' in body) next.weeklyCapacity = intIn(body.weeklyCapacity, 1, 1000, 'الطاقة الأسبوعية', false)!
    if ('labels' in body) next.labels = cleanOptions(body.labels, 'المستويات')
    if ('eventTypes' in body) next.eventTypes = cleanOptions(body.eventTypes, 'أنواع الفعاليات')
    if ('categories' in body) {
      if (!Array.isArray(body.categories) || body.categories.length > 40) throw new Invalid('قائمة الفئات غير صالحة.')
      next.categories = [...new Set(body.categories.map((c) => str(c, 80, 'الفئة')).filter(Boolean))]
    }
    let any = false
    store.db.transaction(() => {
      for (const [k, v] of Object.entries(next)) {
        if (same(v, before[k as keyof Settings])) continue
        store.setSetting(k as keyof Settings, v)
        store.audit({ entity: 'settings', entityId: k, entityTitle: 'الإعدادات', action: 'update', field: k, old: before[k as keyof Settings], new: v, by })
        any = true
      }
    })()
    if (any) changed()
    res.json(store.getSettings())
  }),
)

/* ---------- restore from the change log (admin) ---------- */
api.post(
  '/audit/:id/restore',
  requireAdmin,
  handle((req, res) => {
    const by = editor(req)
    const entry = store.getAudit(Number(req.params.id))
    if (!entry) return res.status(404).json({ error: 'لم يُعثر على هذا التعديل.' })
    store.db.transaction(() => {
      if (entry.action === 'delete') {
        if (entry.entity === 'task') {
          if (store.getTask(entry.entityId)) throw new Invalid('هذه المهمة موجودة بالفعل.')
          const t = entry.old as Task
          store.insertTask({ ...t }, by)
        } else if (entry.entity === 'event') {
          if (store.getEvent(entry.entityId)) throw new Invalid('هذه الفعالية موجودة بالفعل.')
          store.insertEvent({ ...(entry.old as EventItem) }, by)
        }
      } else if (entry.action === 'update' || entry.action === 'restore') {
        if (entry.entity === 'settings') store.setSetting(entry.field as keyof Settings, entry.old)
        else {
          const table = entry.entity === 'task' ? 'tasks' : 'events'
          const exists = entry.entity === 'task' ? store.getTask(entry.entityId) : store.getEvent(entry.entityId)
          if (!exists) throw new Invalid('العنصر محذوف. استرجع الحذف أولًا.')
          store.updateRow(table, entry.entityId, { [entry.field]: entry.old }, by)
        }
      } else throw new Invalid('لا يمكن استرجاع هذا النوع من التعديلات. احذف العنصر بدلًا من ذلك.')
      store.audit({ ...entry, action: 'restore', old: entry.new, new: entry.old, by })
    })()
    changed()
    res.json({ ok: true })
  }),
)

/* ---------- admin session ---------- */
const logins = rateLimit(10, 15 * 60_000, 'محاولات دخول كثيرة. حاول بعد ربع ساعة.')
api.post('/login', logins, (req, res) => {
  if (!checkPassword(req.body?.password)) return res.status(401).json({ error: 'كلمة المرور غير صحيحة.' })
  setAdminCookie(req, res)
  res.json({ isAdmin: true })
})
api.post('/logout', (_req, res) => {
  clearAdminCookie(res)
  res.json({ isAdmin: false })
})
