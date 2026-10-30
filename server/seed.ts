import type { ItemKind, Task } from '../src/lib/types.ts'

type NewTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Titles of the sample rows from the first version, removed when the real list arrives. */
export const SAMPLE_TITLES = [
  'اليوم الرقمي ١٠',
  'فيلم توعوي',
  'الإعلانات والأخبار',
  'نظام إدارة علاقات العملاء (CRM)',
  'لجنة المسؤولية الاجتماعية (CSR)',
  'الإيرادات غير التعريفية (Non-Tariff)',
  'جوائز ICXA',
  'جوائز Gartner',
  'شهادة ISO',
  'الاجتماع السنوي',
]

const EVENTS = 'إدارة الفعاليات وتنسيق الاجتماعات'
const PENDING = 'بانتظار موافقة نائب الرئيس والتنسيق مع مكتب الرئيس التنفيذي'

/**
 * The VP's list of tasks and events (30 Oct 2026): importance and urgency from the table the VP
 * scored, dates from the "events timeline" slide and the follow-up call. Fields nobody gave
 * (effort, progress, most levels and dates) are left empty for the team to fill in.
 */
export function realItems(): NewTask[] {
  const today = iso(new Date())
  const item = (title: string, kind: ItemKind, priority: number | null, urgency: number | null, more: Partial<NewTask> = {}): NewTask => ({
    title,
    kind,
    category: '',
    label: '',
    priority,
    urgency,
    expectation: '',
    effort: null,
    progress: 0,
    start: today,
    end: '',
    owner: '',
    notes: '',
    draft: false,
    ...more,
  })
  return [
    item('إطلاق IT Ops', 'launch', 8, 7),
    item('تصميم نشرة إمداد الأسبوعية', 'other', 8, 9, { category: 'التصميم الجرافيكي' }),
    item('فيديو الذكاء الاصطناعي', 'other', 9, 6, { category: 'فيديو' }),
    item('فيديو الدرونز', 'other', 8, 5, { category: 'فيديو' }),
    item('فيديو جيرا', 'other', 2, 2, { category: 'فيديو' }),
    item('EY CoE', '', 8, 7, { notes: PENDING, draft: true }),
    item('HSE', '', 8, 6, { notes: PENDING, draft: true }),
    item('Revenue Assurance', '', 8, 4, { notes: PENDING, draft: true }),
    item('زيارة الرئيس لجامعة الأميرة نورة', 'event', 10, 10, { category: EVENTS, label: 'ceo', end: '2026-11-01' }),
    item('حفل تدشين الاستراتيجية', 'event', 9, 8, { category: EVENTS, end: '2026-11-19' }),
    item('اليوم الرقمي', 'event', 10, 6, { category: EVENTS, end: '2026-12-15' }),
    item('حفل نهاية السنة', 'event', 7, 4, { category: EVENTS, end: '2026-12-31', notes: 'نهاية ديسمبر' }),
    // mentioned by the VP without scores yet
    item('حفل جوائز ICXA', 'event', null, null, { category: EVENTS, end: '2026-11-05' }),
    item('CRM', '', null, null, { start: '2027-01-01', expectation: 'q', notes: 'الربع الأول ٢٠٢٧' }),
    item('CSR', '', null, null, { start: '2027-01-01', expectation: 'q', notes: 'الربع الأول ٢٠٢٧ (مشروع خاص بالعملاء)' }),
    item('Non-Tariff', '', null, null, { start: '2027-01-01', expectation: 'q', notes: 'الربع الأول ٢٠٢٧' }),
    item('جوائز Gartner', 'event', null, null),
    item('شهادة ISO', 'other', null, null),
  ]
}

export function seed(addTask: (t: NewTask & { createdAt?: number }, by: string) => unknown) {
  // one millisecond apart, so the items keep the VP's numbering (1, 2, 3…)
  const base = Date.now()
  realItems().forEach((t, i) => addTask({ ...t, createdAt: base + i }, 'النظام'))
}
