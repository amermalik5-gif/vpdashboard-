import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { api } from './routes.ts'
import { DB_FILE } from './db.ts'
import { scheduleBackups } from './backup.ts'
import { requireAdmin } from './auth.ts'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1) // Railway terminates TLS in front of the app

// The page loads only its own files. Images may be data:/blob: URLs (the PDF export draws the
// calendar into one); inline style attributes are used by the layout and the animations.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  })
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000')
  next()
})
// a full backup file can be larger than ordinary edits; only the admin's upload is read at that size
app.use('/api/backup/restore', requireAdmin, express.json({ limit: '10mb' }))
app.use('/api', express.json({ limit: '64kb' }), api)
// a body that can't be read (too large, or not JSON): a short answer in Arabic, never a stack trace
app.use('/api', (err: { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500
  if (status === 500) console.error(err)
  const error = err.type === 'entity.too.large' ? 'الملف أو الطلب أكبر من المسموح.' : status === 500 ? 'حدث خطأ في الخادم. حاول مرة أخرى بعد قليل.' : 'طلب غير صالح.'
  res.status(status).json({ error })
})
app.get('/healthz', (_req, res) => res.json({ ok: true }))

const dist = fileURLToPath(new URL('../dist', import.meta.url))
if (existsSync(dist)) {
  app.use('/assets', express.static(`${dist}/assets`, { immutable: true, maxAge: '1y' }))
  app.use(express.static(dist, { index: false }))
  app.get('*', (_req, res) => res.sendFile(`${dist}/index.html`))
}

scheduleBackups()

const port = Number(process.env.PORT) || 3001
app.listen(port, () => console.log(`[vp-dashboard] http://localhost:${port}  (database: ${DB_FILE})`))
