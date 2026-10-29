import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { fmtDay, toArabicDigits } from '@/lib/format'
import { addDays, loadTone, today, weekLoad, weekStart } from '@/lib/schedule'

const BAR_H = 72

const TONE = {
  green: { color: 'var(--status-green)', name: 'متسع لمهام إضافية' },
  amber: { color: 'var(--status-amber)', name: 'قريب من الطاقة القصوى' },
  red: { color: 'var(--status-red)', name: 'تجاوز الطاقة الاستيعابية' },
}

/** Health meter: this week's load against the team's weekly capacity, plus the next 8 weeks. */
export function Capacity() {
  const { state, isAdmin, run } = useBoardCtx()
  const tasks = state?.tasks ?? []
  const cap = Math.max(1, state?.settings.weeklyCapacity ?? 20)
  const [draft, setDraft] = useState(String(cap))
  useEffect(() => setDraft(String(cap)), [cap])

  const ws = weekStart(today())
  const load = weekLoad(tasks, ws)
  const pct = (load / cap) * 100
  const tone = TONE[loadTone(pct)]

  // gauge: 0–150 % on a half circle
  const cx = 150
  const cy = 150
  const R = 118
  const MAX = 150
  const ang = (v: number) => Math.PI * (1 - Math.min(MAX, Math.max(0, v)) / MAX)
  // RTL reading: 0 % sits on the right, the needle sweeps leftward as the load grows
  const pt = (v: number, r = R) => [cx - r * Math.cos(ang(v)), cy - r * Math.sin(ang(v))]
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a)
    const [x2, y2] = pt(b)
    return `M${x1},${y1} A${R},${R} 0 0 0 ${x2},${y2}`
  }
  const [nx, ny] = pt(pct, R - 22)

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const s = addDays(ws, i * 7)
    return { s, load: weekLoad(tasks, s) }
  })
  const top = Math.max(cap * 1.3, ...weeks.map((w) => w.load), 1)

  const saveCap = () => {
    const v = Math.round(Number(draft))
    if (!Number.isFinite(v) || v < 1 || v === cap) return setDraft(String(cap))
    run(() => api.saveSettings({ weeklyCapacity: v }), 'حُدّثت الطاقة الأسبوعية')
  }

  return (
    <Card padding="none" className="p-4 md:p-6">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xl font-medium">الطاقة الاستيعابية</h3>
        <span className="text-sm text-fg-tertiary">أسبوع {fmtDay(ws)}</span>
      </div>
      <svg viewBox="0 0 300 222" className="mx-auto w-full max-w-[300px]" style={{ direction: 'ltr' }} role="img" aria-label={`حِمل هذا الأسبوع ${Math.round(pct)}٪ من الطاقة`}>
        <path d={arc(0, 80)} stroke="var(--status-green)" strokeWidth={20} fill="none" />
        <path d={arc(80, 100)} stroke="var(--status-amber)" strokeWidth={20} fill="none" />
        <path d={arc(100, 150)} stroke="var(--status-red)" strokeWidth={20} fill="none" />
        {[0, 50, 100, 150].map((v) => {
          const [x, y] = pt(v, R + 20)
          return (
            <text key={v} x={x} y={y + 4} textAnchor="middle" fontSize={11} fill="var(--tertiary-500)">
              {toArabicDigits(v)}٪
            </text>
          )
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--neutral-800)" strokeWidth={4} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={9} fill="var(--neutral-800)" />
        <text x={cx} y={cy + 46} textAnchor="middle" fontSize={34} fontWeight={500} fill="var(--neutral-800)">
          {toArabicDigits(Math.round(pct))}٪
        </text>
        <text x={cx} y={cy + 70} textAnchor="middle" direction="rtl" fontSize={13} fill="var(--neutral-600)">
          {toArabicDigits(load)} من {toArabicDigits(cap)} نقطة جهد
        </text>
      </svg>
      <p className="mt-1 text-center text-sm font-medium" style={{ color: tone.color }}>
        {tone.name}
      </p>

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium">الأسابيع الثمانية القادمة</p>
        <div className="relative flex items-end gap-1.5" style={{ height: BAR_H + 36 }} role="list" aria-label="الحِمل الأسبوعي">
          <span aria-hidden className="absolute inset-x-0 border-t border-dashed border-neutral-500" style={{ bottom: 18 + (cap / top) * BAR_H }} />
          {weeks.map((w, i) => {
            const c = TONE[loadTone((w.load / cap) * 100)].color
            return (
              <div key={i} role="listitem" className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${fmtDay(w.s)}: ${w.load} من ${cap}`}>
                <span className="text-2xs tabular text-fg-secondary">{toArabicDigits(w.load)}</span>
                <span className="w-full rounded-t-xs" style={{ height: Math.max(2, (w.load / top) * BAR_H), background: c, opacity: i === 0 ? 1 : 0.75 }} />
                <span className="h-3.5 truncate text-2xs leading-none text-fg-tertiary">{toArabicDigits(w.s.getDate())}/{toArabicDigits(w.s.getMonth() + 1)}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-fg-tertiary">الحِمل = مجموع جهد كل مهمة غير مكتملة نشطة في ذلك الأسبوع (يبدأ الأسبوع يوم الأحد). الخط المتقطع = الطاقة.</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
        <label htmlFor="cap" className="text-sm text-fg-secondary">
          الطاقة الأسبوعية (نقاط جهد)
        </label>
        {isAdmin ? (
          <input
            id="cap"
            type="number"
            min={1}
            max={1000}
            inputMode="numeric"
            className="field h-9 w-24 text-center tabular"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveCap}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <span id="cap" className="text-md font-medium tabular" title="يغيّرها المشرف">
            {toArabicDigits(cap)}
          </span>
        )}
      </div>
    </Card>
  )
}
