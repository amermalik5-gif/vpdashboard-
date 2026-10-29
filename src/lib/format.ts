const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** 2026 → «٢٠٢٦». Leaves every other character untouched (as in the booklet). */
export const toArabicDigits = (v: string | number): string => String(v).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)])

const dayMonth = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', { day: 'numeric', month: 'long' })
const dayMonthYear = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', { day: 'numeric', month: 'long', year: 'numeric' })
const monthShort = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', { month: 'long' })
const timeFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export const fmtDay = (d: Date) => dayMonth.format(d)
export const fmtDate = (d: Date) => dayMonthYear.format(d)
export const fmtMonth = (d: Date) => monthShort.format(d)
export const fmtTime = (ms: number) => timeFmt.format(new Date(ms))

/** «بعد ٢٢ يومًا» / «اليوم» / «منذ ٣ أيام» */
export function relDays(n: number): string {
  if (n === 0) return 'اليوم'
  if (n === 1) return 'غدًا'
  if (n === -1) return 'أمس'
  const a = Math.abs(n)
  const unit = a === 2 ? 'يومين' : a <= 10 ? `${toArabicDigits(a)} أيام` : `${toArabicDigits(a)} يومًا`
  return n > 0 ? `بعد ${unit}` : `منذ ${unit}`
}

/** Arabic counted noun for tasks: 1 → «مهمة واحدة», 2 → «مهمتان», 3–10 → «مهام», 11+ → «مهمة». */
export function countTasks(n: number): string {
  if (n === 1) return 'مهمة واحدة'
  if (n === 2) return 'مهمتان'
  const m = n % 100
  return `${toArabicDigits(n)} ${m >= 3 && m <= 10 ? 'مهام' : 'مهمة'}`
}
