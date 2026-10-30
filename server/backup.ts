import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { db, DB_FILE } from './db.ts'

/** Snapshots live next to the database, on the same Railway volume. */
export const BACKUP_DIR = join(dirname(DB_FILE), 'backups')
const KEEP_DAILY = 14

const stamp = (d = new Date()) => d.toISOString().slice(0, 19).replace(/[:T]/g, '-')

/** A consistent copy of the live database (SQLite VACUUM INTO). Returns the file path. */
export function snapshot(prefix: string): string {
  mkdirSync(BACKUP_DIR, { recursive: true })
  const file = join(BACKUP_DIR, `${prefix}-${stamp()}.db`)
  db.prepare('VACUUM INTO ?').run(file)
  return file
}

/** One copy per day, keeping the newest 14. Safe to call often: it skips a day already saved. */
export function dailyBackup() {
  try {
    mkdirSync(BACKUP_DIR, { recursive: true })
    const today = new Date().toISOString().slice(0, 10)
    const daily = readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('daily-') && f.endsWith('.db'))
      .sort()
    if (!daily.some((f) => f.startsWith(`daily-${today}`))) daily.push(snapshot('daily').split('/').pop()!)
    for (const f of daily.sort().slice(0, -KEEP_DAILY)) rmSync(join(BACKUP_DIR, f))
  } catch (e) {
    console.error('[backup] daily copy failed', e)
  }
}

export function scheduleBackups() {
  dailyBackup()
  setInterval(dailyBackup, 60 * 60 * 1000).unref() // checked hourly, written once a day
}
