import type { EventItem, Task } from '../src/lib/types.ts'

type NewTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>
type NewEvent = Omit<EventItem, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>

const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Items from the kickoff meeting (29 Oct 2026) and the VP's sketch. Every row is a draft:
 * the numbers are a starting point for the VP to confirm or change, not decisions.
 */
export function seed(addTask: (t: NewTask, by: string) => unknown, addEvent: (e: NewEvent, by: string) => unknown) {
  const today = iso(new Date())
  const base = { notes: '', owner: '', end: '', draft: true, progress: 0 }
  const tasks: NewTask[] = [
    { ...base, title: 'اليوم الرقمي ١٠', category: 'فعالية', label: 'ceo', priority: 9, urgency: 9, expectation: '1m', effort: 10, start: today },
    { ...base, title: 'فيلم توعوي', category: 'محتوى', label: 'vp', priority: 6, urgency: 7, expectation: '2w', effort: 2, start: today },
    { ...base, title: 'الإعلانات والأخبار', category: 'محتوى', label: 'vp', priority: 5, urgency: 7, expectation: '1w', effort: 1, start: today },
    { ...base, title: 'نظام إدارة علاقات العملاء (CRM)', category: 'برنامج', label: 'evp', priority: 8, urgency: 4, expectation: 'q', effort: 8, start: '2027-01-03' },
    { ...base, title: 'لجنة المسؤولية الاجتماعية (CSR)', category: 'مبادرة', label: 'evp', priority: 6, urgency: 6, expectation: '', effort: 4, start: today, end: '2026-12-31' },
    { ...base, title: 'الإيرادات غير التعريفية (Non-Tariff)', category: 'برنامج', label: 'evp', priority: 7, urgency: 4, expectation: 'q', effort: 6, start: '2027-01-03' },
  ]
  const events: NewEvent[] = [
    { name: 'جوائز ICXA', date: '', type: 'award', notes: '', draft: true },
    { name: 'جوائز Gartner', date: '', type: 'award', notes: '', draft: true },
    { name: 'شهادة ISO', date: '', type: 'certification', notes: '', draft: true },
    { name: 'الاجتماع السنوي', date: '', type: 'board', notes: '', draft: true },
  ]
  for (const t of tasks) addTask(t, 'النظام')
  for (const e of events) addEvent(e, 'النظام')
}
