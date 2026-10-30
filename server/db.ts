import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AuditEntry, EventItem, Settings, Task } from '../src/lib/types.ts'
import { seed } from './seed.ts'

const FILE = process.env.DATABASE_PATH ?? (process.env.NODE_ENV === 'production' ? '/data/vp.db' : './data/vp.db')
mkdirSync(dirname(FILE), { recursive: true })

export const db = new Database(FILE)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', label TEXT NOT NULL DEFAULT '',
    priority INTEGER, urgency INTEGER, expectation TEXT NOT NULL DEFAULT '', effort INTEGER, progress INTEGER NOT NULL DEFAULT 0,
    start TEXT NOT NULL DEFAULT '', "end" TEXT NOT NULL DEFAULT '', owner TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
    draft INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, updated_by TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
    draft INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, updated_by TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, entity_id TEXT NOT NULL, entity_title TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL, field TEXT NOT NULL DEFAULT '', old TEXT, new TEXT, by TEXT NOT NULL, at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS audit_at ON audit(at DESC);
`)

type Row = Record<string, unknown>

const toTask = (r: Row): Task => ({
  id: r.id as string,
  title: r.title as string,
  category: r.category as string,
  label: r.label as string,
  priority: r.priority as number | null,
  urgency: r.urgency as number | null,
  expectation: r.expectation as Task['expectation'],
  effort: r.effort as number | null,
  progress: r.progress as number,
  start: r.start as string,
  end: r.end as string,
  owner: r.owner as string,
  notes: r.notes as string,
  draft: !!r.draft,
  createdAt: r.created_at as number,
  updatedAt: r.updated_at as number,
  updatedBy: r.updated_by as string,
})

const toEvent = (r: Row): EventItem => ({
  id: r.id as string,
  name: r.name as string,
  date: r.date as string,
  type: r.type as string,
  notes: r.notes as string,
  draft: !!r.draft,
  createdAt: r.created_at as number,
  updatedAt: r.updated_at as number,
  updatedBy: r.updated_by as string,
})

const parse = (v: unknown) => (v == null ? null : JSON.parse(v as string))
const toAudit = (r: Row): AuditEntry => ({
  id: r.id as number,
  entity: r.entity as AuditEntry['entity'],
  entityId: r.entity_id as string,
  entityTitle: r.entity_title as string,
  action: r.action as AuditEntry['action'],
  field: r.field as string,
  old: parse(r.old),
  new: parse(r.new),
  by: r.by as string,
  at: r.at as number,
})

/* ---------- tasks ---------- */
const COLS: Record<string, string> = { end: '"end"' }
const col = (k: string) => COLS[k] ?? k
const sqlValue = (v: unknown) => (typeof v === 'boolean' ? Number(v) : v)

export const listTasks = (): Task[] => (db.prepare('SELECT * FROM tasks ORDER BY created_at').all() as Row[]).map(toTask)
export const getTask = (id: string): Task | undefined => {
  const r = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row | undefined
  return r && toTask(r)
}

export function insertTask(t: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'> & { id?: string; createdAt?: number }, by: string): Task {
  const now = Date.now()
  const id = t.id ?? randomUUID()
  db.prepare(
    `INSERT INTO tasks (id,title,category,label,priority,urgency,expectation,effort,progress,start,"end",owner,notes,draft,created_at,updated_at,updated_by)
     VALUES (@id,@title,@category,@label,@priority,@urgency,@expectation,@effort,@progress,@start,@end,@owner,@notes,@draft,@created_at,@updated_at,@updated_by)`,
  ).run({ ...t, id, draft: Number(t.draft), created_at: t.createdAt ?? now, updated_at: now, updated_by: by })
  return getTask(id)!
}

export function updateRow(table: 'tasks' | 'events', id: string, patch: Record<string, unknown>, by: string) {
  const keys = Object.keys(patch)
  if (!keys.length) return
  const set = keys.map((k) => `${col(k)} = @${k}`).join(', ')
  const params: Record<string, unknown> = { id, updated_at: Date.now(), updated_by: by }
  for (const k of keys) params[k] = sqlValue(patch[k])
  db.prepare(`UPDATE ${table} SET ${set}, updated_at = @updated_at, updated_by = @updated_by WHERE id = @id`).run(params)
}

export const deleteRow = (table: 'tasks' | 'events', id: string) => db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id)

/* ---------- events ---------- */
export const listEvents = (): EventItem[] => (db.prepare('SELECT * FROM events ORDER BY created_at').all() as Row[]).map(toEvent)
export const getEvent = (id: string): EventItem | undefined => {
  const r = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Row | undefined
  return r && toEvent(r)
}
export function insertEvent(e: Omit<EventItem, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'> & { id?: string; createdAt?: number }, by: string): EventItem {
  const now = Date.now()
  const id = e.id ?? randomUUID()
  db.prepare(
    `INSERT INTO events (id,name,date,type,notes,draft,created_at,updated_at,updated_by) VALUES (@id,@name,@date,@type,@notes,@draft,@created_at,@updated_at,@updated_by)`,
  ).run({ ...e, id, draft: Number(e.draft), created_at: e.createdAt ?? now, updated_at: now, updated_by: by })
  return getEvent(id)!
}

/* ---------- settings ---------- */
export const DEFAULT_SETTINGS: Settings = {
  weeklyCapacity: 8,
  labels: [
    { id: 'ceo', name: 'الرئيس التنفيذي' },
    { id: 'evp', name: 'نائب الرئيس التنفيذي' },
    { id: 'vp', name: 'نائب الرئيس' },
    { id: 'internal', name: 'داخلي' },
    { id: 'other', name: 'أخرى' },
  ],
  categories: [
    'تصميم العروض',
    'ترجمة العروض',
    'التصميم الجرافيكي',
    'كتابة المحتوى',
    'إدارة الفعاليات وتنسيق الاجتماعات',
    'فيديو',
    'فيديو موشن جرافيك',
    'الإعلانات',
    'أخرى',
  ],
  eventTypes: [
    { id: 'award', name: 'جائزة' },
    { id: 'certification', name: 'شهادة' },
    { id: 'event', name: 'فعالية' },
    { id: 'board', name: 'مجلس الإدارة' },
    { id: 'deadline', name: 'موعد نهائي' },
  ],
}

export function getSettings(): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const r of rows) s[r.key] = JSON.parse(r.value)
  return s as unknown as Settings
}
export const setSetting = (key: keyof Settings, value: unknown) =>
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value))

/* ---------- audit ---------- */
export function audit(e: Omit<AuditEntry, 'id' | 'at'>) {
  db.prepare('INSERT INTO audit (entity,entity_id,entity_title,action,field,old,new,by,at) VALUES (?,?,?,?,?,?,?,?,?)').run(
    e.entity,
    e.entityId,
    e.entityTitle,
    e.action,
    e.field,
    e.old === undefined ? null : JSON.stringify(e.old),
    e.new === undefined ? null : JSON.stringify(e.new),
    e.by,
    Date.now(),
  )
}
export const listAudit = (limit: number): AuditEntry[] =>
  (db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT ?').all(limit) as Row[]).map(toAudit)
export const allAudit = (): AuditEntry[] => (db.prepare('SELECT * FROM audit ORDER BY id').all() as Row[]).map(toAudit)
export const getAudit = (id: number): AuditEntry | undefined => {
  const r = db.prepare('SELECT * FROM audit WHERE id = ?').get(id) as Row | undefined
  return r && toAudit(r)
}

/* first run: the items from the kickoff sketch, waiting for the VP to confirm */
const empty = (db.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }).n === 0 && (db.prepare('SELECT COUNT(*) AS n FROM audit').get() as { n: number }).n === 0
if (empty) db.transaction(() => seed(insertTask, insertEvent))()

/* one-time migrations, recorded in settings.migrations so each runs once */
const done = new Set<string>(JSON.parse((db.prepare("SELECT value FROM settings WHERE key = 'migrations'").get() as { value: string } | undefined)?.value ?? '[]'))
const migrate = (id: string, fn: () => void) => {
  if (done.has(id)) return
  db.transaction(() => {
    fn()
    done.add(id)
    db.prepare("INSERT INTO settings (key, value) VALUES ('migrations', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify([...done]))
  })()
}

// categories became the team's services list (drop-down in the task form)
migrate('services-categories', () => {
  const OLD = ['فعالية', 'جائزة', 'شهادة', 'برنامج', 'محتوى', 'مبادرة', 'بند مجلس الإدارة']
  const row = db.prepare("SELECT value FROM settings WHERE key = 'categories'").get() as { value: string } | undefined
  if (row && JSON.stringify(JSON.parse(row.value)) === JSON.stringify(OLD)) db.prepare("DELETE FROM settings WHERE key = 'categories'").run()
  const byTitle: Record<string, string> = { 'فيلم توعوي': 'فيديو', 'الإعلانات والأخبار': 'الإعلانات' }
  const byCategory: Record<string, string> = { فعالية: 'إدارة الفعاليات وتنسيق الاجتماعات', محتوى: 'كتابة المحتوى' }
  for (const t of listTasks()) {
    if (!OLD.includes(t.category)) continue
    const next = byTitle[t.title] ?? byCategory[t.category] ?? 'أخرى'
    db.prepare('UPDATE tasks SET category = ? WHERE id = ?').run(next, t.id)
    audit({ entity: 'task', entityId: t.id, entityTitle: t.title, action: 'update', field: 'category', old: t.category, new: next, by: 'النظام' })
  }
})

export const DB_FILE = FILE
