import { Router, type Request, type Response } from 'express'
import { editsAll, EXPECTATIONS, EVENT_FIELDS, ITEM_KINDS, ROLES, TASK_FIELDS, TASK_STATUSES, TEAM_FIELDS, type Role, type EventItem, type Option, type Settings, type Task } from '../src/lib/types.ts'
import * as store from './db.ts'
import { snapshot } from './backup.ts'
import { ADMIN_USERNAME, checkPassword, clearSessionCookie, currentUser, hashPassword, rateLimit, requireAdmin, requireEditor, requireVP, setSessionCookie, verifyPassword } from './auth.ts'

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
    case 'kind': {
      const k = str(v, 20, 'النوع')
      if (k && !(k in ITEM_KINDS)) throw new Invalid('نوع غير معروف.')
      return k
    }
    case 'status': {
      const s = str(v, 20, 'الحالة')
      if (s && !(s in TASK_STATUSES)) throw new Invalid('حالة غير معروفة.')
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
    case 'ready':
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

/** Who made the change: the signed-in account's name (the routes are guarded, so there is one). */
function editor(req: Request): string {
  const u = currentUser(req)
  if (!u) throw new Invalid('سجّل الدخول لتتمكن من التعديل.')
  return u.name
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

/** Fields the VP sets; changing one of them confirms a seeded draft. */
const VP_FIELDS = ['priority', 'urgency', 'expectation', 'category', 'label', 'kind', 'end']

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export const api = Router()
const writes = rateLimit(120, 60_000, 'تعديلات كثيرة خلال دقيقة. انتظر قليلًا ثم حاول مجددًا.')

api.get('/state', (req, res) => {
  const u = currentUser(req)
  res.json({ tasks: store.listTasks(), events: store.listEvents(), settings: store.getSettings(), user: u && { name: u.name, role: u.role }, isAdmin: u?.role === 'admin', version })
})

api.get('/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  res.flushHeaders()
  res.write(`retry: 5000\nevent: hello\ndata: ${version}\n\n`)
  clients.add(res)
  req.on('close', () => clients.delete(res))
})

api.get('/audit', requireAdmin, (req, res) => {
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
  const head = ['المهمة / الفعالية', 'النوع', 'الفئة', 'المستوى', 'درجة الأهمية', 'مستوى الاستعجال', 'المدة المتوقعة', 'الجهد', 'نسبة الإنجاز', 'الحالة', 'جاهز للإطلاق', 'تاريخ البدء', 'التاريخ', 'المسؤول', 'الملاحظات', 'بانتظار التأكيد', 'آخر تعديل بواسطة', 'آخر تعديل']
  const rows = store.listTasks().map((t) => [
    t.title,
    t.kind ? ITEM_KINDS[t.kind] : '',
    t.category,
    labelName(t.label),
    t.priority,
    t.urgency,
    t.expectation ? EXPECTATIONS[t.expectation].name : '',
    t.effort,
    t.progress,
    t.status ? TASK_STATUSES[t.status] : '',
    t.ready ? 'نعم' : 'لا',
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

/* restore a full JSON backup (admin): a safety copy first, then replace everything in one go */
api.post(
  '/backup/restore',
  requireAdmin,
  handle((req, res) => {
    const by = editor(req)
    const b = req.body as { app?: unknown; format?: unknown; tasks?: unknown; events?: unknown; settings?: Partial<Settings> }
    if (!b || b.app !== 'vp-dashboard' || b.format !== 1 || !Array.isArray(b.tasks) || !Array.isArray(b.events) || !b.settings)
      throw new Invalid('هذا الملف ليس نسخة احتياطية من هذه اللوحة.')
    if (b.tasks.length > 2000 || b.events.length > 2000) throw new Invalid('الملف أكبر من المتوقع.')
    const id = (v: unknown) => {
      const x = typeof v === 'string' ? v.trim().slice(0, 64) : ''
      if (!/^[\w-]+$/.test(x)) throw new Invalid('معرّف غير صالح في الملف.')
      return x
    }
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Date.now())
    const tasks = b.tasks.map((raw) => {
      const t = pick(raw, TASK_FIELDS, cleanTaskField) as Task
      if (!t.title) throw new Invalid('مهمة بلا عنوان في الملف.')
      const r = raw as Record<string, unknown>
      return { ...t, id: id(r.id), createdAt: num(r.createdAt), position: typeof r.position === 'number' && Number.isFinite(r.position) ? Math.round(r.position) : undefined, progress: t.progress ?? 0, draft: !!t.draft }
    })
    const events = b.events.map((raw) => {
      const e = pick(raw, EVENT_FIELDS, cleanEventField) as EventItem
      if (!e.name) throw new Invalid('فعالية بلا اسم في الملف.')
      const r = raw as Record<string, unknown>
      return { ...e, id: id(r.id), createdAt: num(r.createdAt), draft: !!e.draft }
    })
    const st = b.settings
    const settings: Partial<Settings> = {
      weeklyCapacity: intIn(st.weeklyCapacity, 1, 1000, 'الطاقة الأسبوعية', false)!,
      labels: cleanOptions(st.labels, 'المستويات'),
      eventTypes: cleanOptions(st.eventTypes, 'أنواع الفعاليات'),
      categories: Array.isArray(st.categories) ? [...new Set(st.categories.map((c) => str(c, 80, 'الفئة')).filter(Boolean))] : [],
    }
    const safety = snapshot('before-restore')
    store.db.transaction(() => {
      store.db.prepare('DELETE FROM tasks').run()
      store.db.prepare('DELETE FROM events').run()
      for (const t of tasks)
        store.insertTask(
          { id: t.id, createdAt: t.createdAt, title: t.title, kind: t.kind ?? '', category: t.category ?? '', label: t.label ?? '', priority: t.priority ?? null, urgency: t.urgency ?? null, expectation: t.expectation ?? '', effort: t.effort ?? null, progress: t.progress, status: t.status ?? '', ready: !!t.ready, start: t.start ?? '', end: t.end ?? '', owner: t.owner ?? '', notes: t.notes ?? '', draft: t.draft, position: t.position },
          by,
        )
      // events from backups made before events and tasks were merged become items of type «فعالية»
      for (const e of events)
        store.insertTask({ id: e.id, createdAt: e.createdAt, title: e.name, kind: 'event', category: '', label: '', priority: null, urgency: null, expectation: '', effort: null, progress: 0, start: '', end: e.date ?? '', owner: '', notes: e.notes ?? '', draft: e.draft }, by)
      for (const [k, v] of Object.entries(settings)) store.setSetting(k as keyof Settings, v)
      store.audit({ entity: 'settings', entityId: 'backup', entityTitle: 'استرجاع نسخة احتياطية', action: 'restore', field: '', old: null, new: { tasks: tasks.length, events: events.length }, by })
    })()
    console.log(`[backup] restored ${tasks.length} tasks and ${events.length} events; previous data kept at ${safety}`)
    changed()
    res.json({ ok: true, tasks: tasks.length, events: events.length })
  }),
)

/* ---------- tasks: signed-in accounts add, edit and delete (visitors only view); the admin can restore from the change log ---------- */
api.post(
  '/tasks',
  requireVP,
  writes,
  handle((req, res) => {
    const by = editor(req)
    const f = pick(req.body, TASK_FIELDS, cleanTaskField) as Partial<Task>
    if (!f.title) throw new Invalid('اكتب عنوانًا للمهمة.')
    const task = store.insertTask(
      {
        title: f.title,
        kind: f.kind ?? '',
        category: f.category ?? '',
        label: f.label ?? '',
        priority: f.priority ?? null,
        urgency: f.urgency ?? null,
        expectation: f.expectation ?? '',
        effort: f.effort ?? null,
        progress: f.progress ?? 0,
        status: f.status ?? '',
        ready: !!f.ready,
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
  requireEditor,
  writes,
  handle((req, res) => {
    const by = editor(req)
    const before = store.getTask(req.params.id)
    if (!before) return res.status(404).json({ error: 'لم تعد هذه المهمة موجودة.' })
    const f = pick(req.body, TASK_FIELDS, cleanTaskField) as Record<string, unknown>
    const diff: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(f)) if (!same(v, before[k as keyof Task])) diff[k] = v
    const all = editsAll(currentUser(req)?.role)
    // a team account updates the «يحدّثها الفريق» part only
    if (!all && Object.keys(diff).some((k) => !(TEAM_FIELDS as readonly string[]).includes(k)))
      return res.status(403).json({ error: 'حساب الفريق يحدّث حقول الفريق فقط: الجهد ونسبة الإنجاز والحالة وجاهز للإطلاق وتاريخ البدء والمسؤول.' })
    // «بانتظار تأكيد نائب الرئيس» clears when the VP's own values are set, or the VP or the admin confirms
    if (diff.draft === false && !all && !VP_FIELDS.some((k) => k in diff)) delete diff.draft
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

/* drag an item to another place in the list: any signed-in account, like any other edit */
api.post(
  '/tasks/:id/move',
  requireVP,
  writes,
  handle((req, res) => {
    const by = editor(req)
    const to = intIn(req.body?.to, 1, 100_000, 'الترتيب', false)!
    const before = store.getTask(req.params.id)
    if (!before) return res.status(404).json({ error: 'لم تعد هذه المهمة موجودة.' })
    const moved = store.db.transaction(() => {
      const r = store.moveTask(before.id, to, by)!
      if (r[0] !== r[1]) store.audit({ entity: 'task', entityId: before.id, entityTitle: before.title, action: 'update', field: 'position', old: r[0], new: r[1], by })
      return r
    })()
    if (moved[0] !== moved[1]) changed()
    res.json({ from: moved[0], to: moved[1] })
  }),
)

api.delete(
  '/tasks/:id',
  requireVP,
  writes,
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
  requireVP,
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
  requireVP,
  writes,
  handle((req, res) => {
    const by = editor(req)
    const before = store.getEvent(req.params.id)
    if (!before) return res.status(404).json({ error: 'لم تعد هذه الفعالية موجودة.' })
    const f = pick(req.body, EVENT_FIELDS, cleanEventField) as Record<string, unknown>
    const diff: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(f)) if (!same(v, before[k as keyof EventItem])) diff[k] = v
    // an event is confirmed by the admin, or by setting its date
    if (diff.draft === false && !editsAll(currentUser(req)?.role) && !diff.date) delete diff.draft
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
      } else if (entry.field === 'user') {
        throw new Invalid('تعديلات الحسابات لا تُسترجع من السجل. عدّل الحساب من قائمة المستخدمين.')
      } else if ((entry.action === 'update' || entry.action === 'restore') && entry.field) {
        if (entry.entity === 'settings') store.setSetting(entry.field as keyof Settings, entry.old)
        else {
          const table = entry.entity === 'task' ? 'tasks' : 'events'
          const exists = entry.entity === 'task' ? store.getTask(entry.entityId) : store.getEvent(entry.entityId)
          if (!exists) throw new Invalid('العنصر محذوف. استرجع الحذف أولًا.')
          // a place in the list: move it back, renumbering the others
          if (entry.field === 'position') store.moveTask(entry.entityId, Number(entry.old), by)
          else store.updateRow(table, entry.entityId, { [entry.field]: entry.old }, by)
        }
      } else throw new Invalid('لا يمكن استرجاع هذا النوع من التعديلات. احذف العنصر بدلًا من ذلك.')
      store.audit({ ...entry, action: 'restore', old: entry.new, new: entry.old, by })
    })()
    changed()
    res.json({ ok: true })
  }),
)

/* ---------- sign-in: personal accounts, plus the built-in admin ---------- */
// only failed attempts count: 10 wrong passwords from one address lock it out for a quarter of an hour
const failures = new Map<string, { n: number; reset: number }>()
const FAIL_MAX = 10
const FAIL_WINDOW = 15 * 60_000
api.post('/login', (req, res) => {
  const ip = req.ip ?? 'unknown'
  const now = Date.now()
  const f = failures.get(ip)
  if (f && f.reset > now && f.n >= FAIL_MAX) {
    res.setHeader('Retry-After', Math.ceil((f.reset - now) / 1000))
    return res.status(429).json({ error: 'محاولات دخول خاطئة كثيرة. حاول بعد ربع ساعة.' })
  }
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const wrong = () => {
    const cur = failures.get(ip)
    if (!cur || cur.reset <= now) failures.set(ip, { n: 1, reset: now + FAIL_WINDOW })
    else cur.n++
    if (failures.size > 5000) for (const [k, v] of failures) if (v.reset <= now) failures.delete(k)
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' })
  }
  if (!username || !password) return wrong()
  if (username.toLowerCase() === ADMIN_USERNAME) {
    if (!checkPassword(password)) return wrong()
    setSessionCookie(req, res, ADMIN_USERNAME, 0)
    return res.json({ user: { name: 'المشرف', role: 'admin' } })
  }
  const u = store.findUser(username)
  if (!u || !u.active || !verifyPassword(password, u.pass)) return wrong()
  store.updateUser(u.id, { lastLoginAt: Date.now() })
  setSessionCookie(req, res, u.id, u.tokenVersion)
  res.json({ user: { name: u.name, role: u.role } })
})
api.post('/logout', (_req, res) => {
  clearSessionCookie(res)
  res.json({ user: null })
})

/* ---------- accounts (admin) ---------- */
const USERNAME = /^[a-z0-9._-]{2,32}$/i
const cleanRole = (v: unknown): Role => {
  if (typeof v !== 'string' || !(v in ROLES)) throw new Invalid('صلاحية غير معروفة.')
  return v as Role
}
const cleanPassword = (v: unknown) => {
  if (typeof v !== 'string' || v.length < 8 || v.length > 200) throw new Invalid('كلمة المرور ٨ أحرف على الأقل.')
  return v
}
const cleanName = (v: unknown) => {
  const name = str(v, 60, 'الاسم')
  if (!name) throw new Invalid('اكتب اسمًا يظهر في سجل التعديلات.')
  return name
}
const userLog = (req: Request, action: 'create' | 'update' | 'delete', u: { id: string; name: string; username: string; role: Role }, old: unknown, next: unknown) =>
  store.audit({ entity: 'settings', entityId: u.id, entityTitle: u.name, action, field: 'user', old, new: next, by: editor(req) })

api.get('/users', requireAdmin, (_req, res) => res.json(store.listUsers().map(store.publicUser)))

api.post(
  '/users',
  requireAdmin,
  handle((req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>
    const username = str(b.username, 32, 'اسم المستخدم')
    if (!USERNAME.test(username)) throw new Invalid('اسم المستخدم من حرفين إلى ٣٢ حرفًا لاتينيًا أو رقمًا (ويمكن . _ -).')
    if (username.toLowerCase() === ADMIN_USERNAME || store.findUser(username)) throw new Invalid('اسم المستخدم مستخدم بالفعل.')
    const u = store.insertUser({ username, name: cleanName(b.name), role: cleanRole(b.role ?? 'team'), pass: hashPassword(cleanPassword(b.password)) })
    userLog(req, 'create', u, null, { username: u.username, name: u.name, role: u.role })
    res.status(201).json(store.publicUser(u))
  }),
)

api.patch(
  '/users/:id',
  requireAdmin,
  handle((req, res) => {
    const before = store.getUser(req.params.id)
    if (!before) return res.status(404).json({ error: 'لم يعد هذا الحساب موجودًا.' })
    const b = (req.body ?? {}) as Record<string, unknown>
    const patch: Parameters<typeof store.updateUser>[1] = {}
    if ('name' in b) patch.name = cleanName(b.name)
    if ('role' in b) patch.role = cleanRole(b.role)
    if ('active' in b) patch.active = !!b.active
    if ('password' in b) patch.pass = hashPassword(cleanPassword(b.password))
    // an admin can't lock themselves out
    if (before.id === currentUser(req)?.id && ((patch.role && patch.role !== 'admin') || patch.active === false)) throw new Invalid('لا يمكنك إيقاف حسابك أو إزالة صلاحية المشرف عنه.')
    // a new password or a stopped account ends its sessions
    if (patch.pass || patch.active === false) patch.bumpVersion = true
    store.updateUser(before.id, patch)
    const after = store.getUser(before.id)!
    const shown = (u: typeof before) => ({ name: u.name, role: u.role, active: u.active })
    userLog(req, 'update', after, shown(before), { ...shown(after), ...(patch.pass ? { password: 'تغيّرت' } : {}) })
    res.json(store.publicUser(after))
  }),
)

api.delete(
  '/users/:id',
  requireAdmin,
  handle((req, res) => {
    const before = store.getUser(req.params.id)
    if (!before) return res.status(404).json({ error: 'لم يعد هذا الحساب موجودًا.' })
    if (before.id === currentUser(req)?.id) throw new Invalid('لا يمكنك حذف حسابك.')
    store.deleteUser(before.id)
    userLog(req, 'delete', before, { username: before.username, name: before.name, role: before.role }, null)
    res.status(204).end()
  }),
)
