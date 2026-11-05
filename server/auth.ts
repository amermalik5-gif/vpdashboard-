import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { editsAll, type Role } from '../src/lib/types.ts'
import { getUser } from './db.ts'

const COOKIE = 'vp_session'
const TTL_MS = 30 * 24 * 60 * 60 * 1000

/** The built-in admin (username «admin»): always there, so nobody can be locked out. */
const PASSWORD = process.env.ADMIN_PASSWORD ?? ''
export const ADMIN_USERNAME = 'admin'
// without a configured secret, sessions only survive until the next restart
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex')

if (!PASSWORD) console.warn('[auth] ADMIN_PASSWORD is not set: the built-in admin cannot sign in.')
if (!process.env.SESSION_SECRET) console.warn('[auth] SESSION_SECRET is not set: sessions end on every restart.')

const sign = (v: string) => createHmac('sha256', SECRET).update(v).digest('base64url')

const safeEqual = (a: string | Buffer, b: string | Buffer) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export const checkPassword = (p: unknown) => !!PASSWORD && typeof p === 'string' && safeEqual(sign(p), sign(PASSWORD))
// changing ADMIN_PASSWORD ends the built-in admin's sessions
const ADMIN_VERSION = sign(`admin:${PASSWORD}`).slice(0, 12)

/* ---------- passwords: scrypt with a random salt; only the hash is stored ---------- */
export function hashPassword(p: string): string {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('base64')}$${scryptSync(p, salt, 32).toString('base64')}`
}
export function verifyPassword(p: string, stored: string): boolean {
  const [kind, salt, hash] = stored.split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  return safeEqual(scryptSync(p, Buffer.from(salt, 'base64'), 32), Buffer.from(hash, 'base64'))
}

/* ---------- sessions ---------- */
export interface SessionUser {
  id: string
  name: string
  role: Role
}

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie
  if (!raw) return
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
}

/**
 * The signed-in person, checked on every request: a disabled or deleted account, or a reset
 * password (a new token version), ends the session at once.
 */
export function currentUser(req: Request): SessionUser | null {
  const c = readCookie(req, COOKIE)
  if (!c) return null
  const [exp, uid, ver, mac] = c.split('.')
  if (!exp || !uid || !ver || !mac || !safeEqual(mac, sign(`${exp}.${uid}.${ver}`)) || Number(exp) <= Date.now()) return null
  if (uid === ADMIN_USERNAME) return PASSWORD && ver === ADMIN_VERSION ? { id: ADMIN_USERNAME, name: 'المشرف', role: 'admin' } : null
  const u = getUser(uid)
  if (!u || !u.active || String(u.tokenVersion) !== ver) return null
  return { id: u.id, name: u.name, role: u.role }
}
export const isAdmin = (req: Request) => currentUser(req)?.role === 'admin'

export function setSessionCookie(req: Request, res: Response, uid: string, version: number) {
  const exp = String(Date.now() + TTL_MS)
  const body = `${exp}.${uid}.${uid === ADMIN_USERNAME ? ADMIN_VERSION : version}`
  res.cookie(COOKIE, `${body}.${sign(body)}`, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: TTL_MS, path: '/' })
}
export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE, { path: '/' })
  res.clearCookie('vp_admin', { path: '/' }) // the old admin-only cookie
}

/** Same-origin requests only, so another site can't act with someone's session. */
function sameOrigin(req: Request, res: Response) {
  const origin = req.headers.origin
  let host = ''
  try {
    host = origin ? new URL(origin).host : ''
  } catch {
    /* «null» or a malformed origin: refuse below */
  }
  if (origin && host !== req.headers.host) {
    res.status(403).json({ error: 'طلب من مصدر غير معروف.' })
    return false
  }
  return true
}

/** Any change to the board needs a signed-in account; visitors can only view. */
export function requireEditor(req: Request, res: Response, next: NextFunction) {
  if (!sameOrigin(req, res)) return
  if (!currentUser(req)) return res.status(401).json({ error: 'اللوحة للعرض فقط. سجّل الدخول لتتمكن من التعديل.' })
  next()
}

/** Adding, deleting, dragging and every field: the VP and the admin (team accounts only update their fields). */
export function requireVP(req: Request, res: Response, next: NextFunction) {
  if (!sameOrigin(req, res)) return
  const u = currentUser(req)
  if (!u) return res.status(401).json({ error: 'اللوحة للعرض فقط. سجّل الدخول لتتمكن من التعديل.' })
  if (!editsAll(u.role)) return res.status(403).json({ error: 'حساب الفريق يحدّث حقول الفريق فقط: الجهد ونسبة الإنجاز والحالة وجاهز للإطلاق وتاريخ البدء والمسؤول.' })
  next()
}

/** Admin-only routes: an account with the admin role. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!sameOrigin(req, res)) return
  if (!isAdmin(req)) return res.status(401).json({ error: 'هذا الإجراء متاح للمشرف فقط. سجّل الدخول ثم حاول مجددًا.' })
  next()
}

/** Small in-memory fixed-window limiter (one instance, so no shared store needed). */
export function rateLimit(max: number, windowMs: number, message: string) {
  const hits = new Map<string, { n: number; reset: number }>()
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown'
    const now = Date.now()
    const h = hits.get(key)
    if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + windowMs })
    else if (++h.n > max) {
      res.setHeader('Retry-After', Math.ceil((h.reset - now) / 1000))
      return res.status(429).json({ error: message })
    }
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
    next()
  }
}
