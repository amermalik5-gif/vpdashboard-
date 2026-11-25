/** Arabic digits and dates come from the design system; the board's own counted nouns are below. */
import { toArabicDigits } from '@ds/lib/format'

export { fmtDate, fmtDay, fmtMonth, fmtTime, fmtWhen, relDays, toArabicDigits } from '@ds/lib/format'

/** Arabic counted noun for items: «بند واحد»، «بندان»، «٣ بنود»، «١١ بندًا»، «١٠٠ بند». */
export function countItems(n: number): string {
  if (n === 0) return 'لا بنود'
  if (n === 1) return 'بند واحد'
  if (n === 2) return 'بندان'
  const m = n % 100
  return `${toArabicDigits(n)} ${m >= 3 && m <= 10 ? 'بنود' : m >= 11 ? 'بندًا' : 'بند'}`
}

/** Arabic counted noun for tasks: 1 → «مهمة واحدة», 2 → «مهمتان», 3–10 → «مهام», 11+ → «مهمة». */
export function countTasks(n: number): string {
  if (n === 1) return 'مهمة واحدة'
  if (n === 2) return 'مهمتان'
  const m = n % 100
  return `${toArabicDigits(n)} ${m >= 3 && m <= 10 ? 'مهام' : 'مهمة'}`
}
