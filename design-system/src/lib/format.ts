const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** 2026 → «٢٠٢٦». Leaves every other character untouched. */
export const toArabicDigits = (v: string | number): string => String(v).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)])

// Arabic, Gregorian calendar, Arabic-Indic digits: the same in every browser language
const dayMonth = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', { day: 'numeric', month: 'long' })
const dayMonthYear = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', { day: 'numeric', month: 'long', year: 'numeric' })
const monthShort = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', { month: 'long' })
const timeFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** «١٩ نوفمبر» */
export const fmtDay = (d: Date) => dayMonth.format(d)
/** «١٩ نوفمبر ٢٠٢٦» */
export const fmtDate = (d: Date) => dayMonthYear.format(d)
/** «نوفمبر» */
export const fmtMonth = (d: Date) => monthShort.format(d)
/** «٥ نوفمبر» this year, «٣١ مارس ٢٠٢٧» otherwise. */
export const fmtWhen = (d: Date) => (d.getFullYear() === new Date().getFullYear() ? fmtDay(d) : fmtDate(d))
/** «١٩ نوفمبر، ٨:١١ ص» */
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
