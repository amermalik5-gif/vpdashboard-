/** Shared between the server (server/*) and the app. */

export type Expectation = '1w' | '2w' | '1m' | '2m' | 'q' | '6m'

export type ItemKind = '' | 'event' | 'launch' | 'news' | 'announce-internal' | 'announce-site' | 'other'

/** The item's one classification (the VP's list, 31 Oct 2026); «أخرى» for videos, designs… */
export const ITEM_KINDS: Record<Exclude<ItemKind, ''>, string> = {
  event: 'فعالية',
  launch: 'إطلاق',
  news: 'خبر',
  'announce-internal': 'إعلان داخلي',
  'announce-site': 'إعلان على الموقع',
  other: 'أخرى',
}

/** Where the item stands, set by the team ('' = worked out from the progress). */
export type TaskStatus = '' | 'not-started' | 'on-track' | 'at-risk' | 'late' | 'done' | 'on-hold'
export const TASK_STATUSES: Record<Exclude<TaskStatus, ''>, string> = {
  'not-started': 'لم تبدأ',
  'on-track': 'على المسار',
  'at-risk': 'متأخرة قليلًا',
  late: 'متأخرة',
  done: 'مكتملة',
  // stopped on someone's direction (18 Nov 2026): never turns red, not counted as open
  'on-hold': 'متوقفة',
}

/** A link to something the team delivered (a video, a presentation, an email, a Drive folder). */
export interface OutputLink {
  name: string
  url: string
}

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
  /** set by the team; decides the colour */
  status: TaskStatus
  /** set by the team: the work is done and the item waits for its launch day (shown with ★) */
  ready: boolean
  start: string
  end: string
  owner: string
  /** «توجيهات نائب الرئيس»: the VP's directions (VP and admin only) */
  notes: string
  /** «ملاحظات الفريق»: the team's latest update, e.g. the reason for a delay (18 Nov 2026) */
  teamNotes: string
  /** «المخرج النهائي المطلوب»: what the VP expects, from Settings.outputs (VP and admin only) */
  outputs: string[]
  /** «روابط المخرجات»: links to what was delivered */
  links: OutputLink[]
  /** «الراعي (المدير العام)»: the general manager who sponsors the item */
  sponsor: string
  /** «تاريخ الإطلاق الفعلي»: the day it really launched; the VP's date never changes */
  actualEnd: string
  /** «جزء من»: the bigger item this one is part of ('' = a main item); one level only */
  parentId: string
  /** Seeded row still waiting for the VP to confirm the values */
  draft: boolean
  /** Place in the list (1, 2, 3…): the item's number, changed by dragging it in the list */
  position: number
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
  /** the choices of «المخرج النهائي المطلوب» */
  outputs: string[]
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

/**
 * Three levels (5 Nov 2026): the VP changes anything on the board; the team only the fields in
 * «يحدّثها الفريق»; the admin also runs accounts, settings, backups and the change log.
 */
export type Role = 'vp' | 'team' | 'admin'
export const ROLES: Record<Role, string> = { vp: 'نائب الرئيس (كل البنود)', team: 'الفريق (حقول الفريق فقط)', admin: 'مشرف' }
/** The short names, for sentences («تغيّرت صلاحية «سارة» إلى «الفريق»»). */
export const ROLE_NAMES: Record<Role, string> = { vp: 'نائب الرئيس', team: 'الفريق', admin: 'مشرف' }
/** What a team account may change: the «يحدّثها الفريق» part of an item. */
export const TEAM_FIELDS = ['effort', 'progress', 'status', 'ready', 'start', 'owner', 'teamNotes', 'links', 'sponsor', 'actualEnd'] as const
/** May change every field, add, delete, drag and confirm the VP's values. */
export const editsAll = (role: Role | undefined | null) => role === 'vp' || role === 'admin'

/** A personal account (the password never leaves the server). */
export interface UserInfo {
  id: string
  username: string
  /** shown in the change log, e.g. «نائب الرئيس» */
  name: string
  role: Role
  active: boolean
  createdAt: number
  lastLoginAt: number | null
}

export interface BoardState {
  tasks: Task[]
  events: EventItem[]
  settings: Settings
  /** who is signed in; null = a visitor, who can only view */
  user: { name: string; role: Role } | null
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
export const TASK_FIELDS = [
  'title',
  'kind',
  'category',
  'label',
  'priority',
  'urgency',
  'expectation',
  'effort',
  'progress',
  'status',
  'ready',
  'start',
  'end',
  'owner',
  'notes',
  'teamNotes',
  'outputs',
  'links',
  'sponsor',
  'actualEnd',
  'parentId',
  'draft',
] as const
/** Fields added on 18 Nov 2026: optional when an item is created (they start empty). */
export type NewFields = 'teamNotes' | 'outputs' | 'links' | 'sponsor' | 'actualEnd' | 'parentId'
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
  status: 'الحالة',
  ready: 'جاهز للإطلاق',
  start: 'تاريخ البدء',
  end: 'التاريخ',
  owner: 'المسؤول',
  notes: 'توجيهات نائب الرئيس',
  teamNotes: 'ملاحظات الفريق',
  outputs: 'المخرج النهائي المطلوب',
  links: 'روابط المخرجات',
  sponsor: 'الراعي (المدير العام)',
  actualEnd: 'تاريخ الإطلاق الفعلي',
  parentId: 'جزء من',
  draft: 'التأكيد',
  position: 'الترتيب',
  name: 'الاسم',
  date: 'التاريخ',
  type: 'النوع',
  weeklyCapacity: 'الطاقة الأسبوعية',
  labels: 'قائمة المستويات',
  categories: 'قائمة الفئات',
  eventTypes: 'أنواع الفعاليات',
}
