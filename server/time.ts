/**
 * The board's days are Riyadh days. Saudi Arabia keeps UTC+3 all year (no daylight saving), so a
 * fixed offset is exact; the server itself runs on UTC.
 */
const RIYADH = 3 * 60 * 60 * 1000
const local = (d: Date | number) => new Date(+d + RIYADH).toISOString()

/** «2026-11-05» */
export const riyadhDay = (d: Date | number = Date.now()) => local(d).slice(0, 10)
/** «2026-11-05 14:03» */
export const riyadhTime = (d: Date | number = Date.now()) => local(d).slice(0, 16).replace('T', ' ')
/** «2026-11-05-14-03-22-123», for file names */
export const riyadhStamp = (d: Date | number = Date.now()) => local(d).slice(0, 23).replace(/[:.T]/g, '-')
