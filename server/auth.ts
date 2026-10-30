import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

const COOKIE = 'vp_admin'
const TTL_MS = 12 * 60 * 60 * 1000

const PASSWORD = process.env.ADMIN_PASSWORD ?? ''
// without a configured secret, sessions only survive until the next restart
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex')

if (!PASSWORD) console.warn('[auth] ADMIN_PASSWORD is not set: admin sign-in is disabled.')
if (!process.env.SESSION_SECRET) console.warn('[auth] SESSION_SECRET is not set: admin sessions end on every restart.')

const sign = (v: string) => createHmac('sha256', SECRET).update(v).digest('base64url')

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export const checkPassword = (p: unknown) => !!PASSWORD && typeof p === 'string' && safeEqual(sign(p), sign(PASSWORD))

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie
  if (!raw) return
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
}

export function isAdmin(req: Request): boolean {
  const c = readCookie(req, COOKIE)
  if (!c) return false
  const [exp, mac] = c.split('.')
  if (!exp || !mac || !safeEqual(mac, sign(exp))) return false
  return Number(exp) > Date.now()
}

export function setAdminCookie(req: Request, res: Response) {
  const exp = String(Date.now() + TTL_MS)
  res.cookie(COOKIE, `${exp}.${sign(exp)}`, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: TTL_MS, path: '/' })
}
export const clearAdminCookie = (res: Response) => res.clearCookie(COOKIE, { path: '/' })

/** Admin-only routes: a valid session cookie and a same-origin request. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin
  let host = ''
  try {
    host = origin ? new URL(origin).host : ''
  } catch {
    /* «null» or a malformed origin: refuse below */
  }
  if (origin && host !== req.headers.host) return res.status(403).json({ error: 'طلب من مصدر غير معروف.' })
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
