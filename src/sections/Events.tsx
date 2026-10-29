import { useState, type FormEvent } from 'react'
import { CalendarClock, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { api } from '@/lib/api'
import { useBoardCtx } from '@/lib/board'
import { fmtDate, relDays, toArabicDigits } from '@/lib/format'
import { daysBetween, parseDate, today } from '@/lib/schedule'
import type { EventItem } from '@/lib/types'

function EventRow({ ev }: { ev: EventItem }) {
  const { state, isAdmin, run } = useBoardCtx()
  const [confirm, setConfirm] = useState(false)
  const types = state?.settings.eventTypes ?? []
  const d = parseDate(ev.date)
  const days = d ? daysBetween(today(), d) : null
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-brand">
        <CalendarClock size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{ev.name}</p>
          {ev.draft && (
            <Badge tone="warning" size="xs">
              بانتظار التأكيد
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-fg-tertiary">
          {types.find((t) => t.id === ev.type)?.name ?? 'فعالية'} ·{' '}
          {d ? (
            <>
              {fmtDate(d)} · <span className={days! < 0 ? '' : days! <= 14 ? 'font-medium text-danger-700' : 'text-fg-secondary'}>{relDays(days!)}</span>
            </>
          ) : (
            'التاريخ لاحقًا'
          )}
        </p>
        <label className="mt-2 flex items-center gap-2 text-xs text-fg-secondary">
          <span className="sr-only">تاريخ {ev.name}</span>
          <input
            type="date"
            className="field h-8 w-auto px-2 text-xs"
            value={ev.date}
            onChange={(e) => run(() => api.updateEvent(ev.id, { date: e.target.value, draft: false }), 'حُفظ التاريخ')}
          />
        </label>
      </div>
      {isAdmin &&
        (confirm ? (
          <span className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="outline" className="h-8 border-danger-500 px-2.5 text-danger-700 hover:bg-danger-50" onClick={() => run(() => api.deleteEvent(ev.id), 'حُذفت الفعالية')}>
              حذف
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2.5" onClick={() => setConfirm(false)}>
              إبقاء
            </Button>
          </span>
        ) : (
          <button
            type="button"
            aria-label={`حذف ${ev.name}`}
            onClick={() => setConfirm(true)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-tertiary hover:bg-danger-50 hover:text-danger-700"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        ))}
    </li>
  )
}

export function Events() {
  const { state, run } = useBoardCtx()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const types = state?.settings.eventTypes ?? []
  const [type, setType] = useState('')
  const events = [...(state?.events ?? [])].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
  const upcoming = events.filter((e) => e.date && e.date >= new Date().toISOString().slice(0, 10)).length

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const ok = await run(() => api.addEvent({ name, date, type: type || types[0]?.id }), 'أُضيفت الفعالية')
    if (ok) {
      setName('')
      setDate('')
    }
  }

  return (
    <Card padding="none" className="p-4 md:p-6">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-xl font-medium">الفعاليات والمحطات</h3>
        <span className="text-sm text-fg-tertiary">{toArabicDigits(upcoming)} قادمة</span>
      </div>
      {events.length ? (
        <ul className="max-h-[420px] divide-y divide-line-subtle overflow-y-auto">
          {events.map((ev) => (
            <EventRow key={ev.id} ev={ev} />
          ))}
        </ul>
      ) : (
        <p className="py-6 text-sm text-fg-tertiary">لا توجد فعاليات بعد. أضف الجوائز والشهادات ومواعيد مجلس الإدارة من النموذج أدناه.</p>
      )}
      <form onSubmit={add} className="mt-3 grid grid-cols-2 gap-2 border-t border-line-subtle pt-4">
        <label className="col-span-2">
          <span className="sr-only">اسم الفعالية</span>
          <input className="field" placeholder="اسم الفعالية" value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} />
        </label>
        <label>
          <span className="sr-only">التاريخ</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">النوع</span>
          <select className="field" value={type || types[0]?.id} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="col-span-2">
          إضافة فعالية
        </Button>
      </form>
    </Card>
  )
}
