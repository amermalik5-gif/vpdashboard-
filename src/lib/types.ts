/** Shared between the server (server/*) and the app. */

export type Expectation = '1w' | '2w' | '1m' | '2m' | 'q' | '6m'

export type ItemKind = '' | 'event' | 'launch' | 'other'

/** The item's type: an event, a launch, or something else (videos, designs…). */
export const ITEM_KINDS: Record<Exclude<ItemKind, ''>, string> = { event: 'فعالية', launch: 'إطلاق', other: 'أخرى' }

export interface Task {
  id: string
  title: string
  kind: ItemKind
  category: string
  /** id of an entry in Settings.labels (ceo, evp, vp, internal, other…) */
  label: string
  /** 0–10, set by the VP */
  priority: number | null
  /** 0–10, 10 = act now */
  urgency: number | null
  expectation: Expectation | ''
  /** 1–10, set by the team */
  effort: number | null
  /** 0–100 */
  progress: number
  start: string
  end: string
  owner: string
  notes: string
  /** Seeded row still waiting for the VP to confirm the values */
  draft: boolean
  createdAt: number
  updatedAt: number
  updatedBy: string
}

export interface EventItem {
  id: string
  name: string
  /** YYYY-MM-DD or '' when the date is not known yet */
  date: string
  type: string
  notes: string
  draft: boolean
  createdAt: number
  updatedAt: number
  updatedBy: string
}

export interface Option {
  id: string
  name: string
}

export interface Settings {
  weeklyCapacity: number
  labels: Option[]
  categories: string[]
  eventTypes: Option[]
}

export interface AuditEntry {
  id: number
  entity: 'task' | 'event' | 'settings'
  entityId: string
  entityTitle: string
  action: 'create' | 'update' | 'delete' | 'restore'
  field: string
  old: unknown
  new: unknown
  by: string
  at: number
}

export interface BoardState {
  tasks: Task[]
  events: EventItem[]
  settings: Settings
  isAdmin: boolean
  version: number
}

export const EXPECTATIONS: Record<Expectation, { name: string; days: number; urgency: number }> = {
  '1w': { name: 'أسبوع', days: 7, urgency: 9 },
  '2w': { name: 'أسبوعان', days: 14, urgency: 8 },
  '1m': { name: 'شهر', days: 30, urgency: 6 },
  '2m': { name: 'شهران', days: 61, urgency: 4 },
  q: { name: 'ربع سنة', days: 89, urgency: 3 }, // a quarter starting on the 1st ends on its last day (1 Jan → 31 Mar)
  '6m': { name: 'ستة أشهر', days: 182, urgency: 1 },
}

/** Editable task fields and how the server validates them. */
export const TASK_FIELDS = ['title', 'kind', 'category', 'label', 'priority', 'urgency', 'expectation', 'effort', 'progress', 'start', 'end', 'owner', 'notes', 'draft'] as const
export const EVENT_FIELDS = ['name', 'date', 'type', 'notes', 'draft'] as const

export const FIELD_NAMES: Record<string, string> = {
  title: 'العنوان',
  kind: 'النوع',
  category: 'الفئة',
  label: 'المستوى',
  priority: 'درجة الأهمية',
  urgency: 'مستوى الاستعجال',
  expectation: 'المدة المتوقعة',
  effort: 'الجهد',
  progress: 'نسبة الإنجاز',
  start: 'تاريخ البدء',
  end: 'التاريخ',
  owner: 'المسؤول',
  notes: 'الملاحظات',
  draft: 'التأكيد',
  name: 'الاسم',
  date: 'التاريخ',
  type: 'النوع',
  weeklyCapacity: 'الطاقة الأسبوعية',
  labels: 'قائمة المستويات',
  categories: 'قائمة الفئات',
  eventTypes: 'أنواع الفعاليات',
}
