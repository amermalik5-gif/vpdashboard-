import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { api } from './routes.ts'
import { DB_FILE } from './db.ts'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1) // Railway terminates TLS in front of the app

app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' })
  next()
})
app.use('/api', express.json({ limit: '64kb' }), api)
app.get('/healthz', (_req, res) => res.json({ ok: true }))

const dist = fileURLToPath(new URL('../dist', import.meta.url))
if (existsSync(dist)) {
  app.use('/assets', express.static(`${dist}/assets`, { immutable: true, maxAge: '1y' }))
  app.use(express.static(dist, { index: false }))
  app.get('*', (_req, res) => res.sendFile(`${dist}/index.html`))
}

const port = Number(process.env.PORT) || 3001
app.listen(port, () => console.log(`[vp-dashboard] http://localhost:${port}  (database: ${DB_FILE})`))
