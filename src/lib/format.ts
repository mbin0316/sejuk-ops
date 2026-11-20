// Display formats from DESIGN.md §3 (money, dates). Malaysia time.

const TZ = 'Asia/Kuala_Lumpur'

const money = new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('en-MY', { notation: 'compact', maximumFractionDigits: 1 })

/** `RM 1,250.00` — tables and forms. */
export const formatMoney = (n: number) => `RM ${money.format(n)}`

/** `RM 86.2K` — KPI tiles. */
export const formatMoneyCompact = (n: number) => `RM ${compact.format(n)}`

/** `19 Nov 2026, 3:45 PM` */
export function formatDateTime(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d
  const day = date.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' })
  const time = date.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
  return `${day}, ${time}`
}

/** `Thursday, 19 Nov 2026` */
export function formatLongDate(d: Date = new Date()) {
  return d.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
}

/** `3:59 PM` */
export function formatTime(d: Date = new Date()) {
  return d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
}

/** "Good morning" / "Good afternoon" / "Good evening" in Malaysia time. */
export function greeting(d: Date = new Date()) {
  const hour = Number(d.toLocaleString('en-GB', { timeZone: TZ, hour: 'numeric', hour12: false }))
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** "Siti Admin" → "SA", "Ali" → "AL" */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Format a Malaysia-time `YYYY-MM-DD` day key, e.g. `16 Nov` or `Mon, 16 Nov`. */
export function formatDayKey(key: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Date(`${key}T00:00:00+08:00`).toLocaleDateString('en-GB', { timeZone: TZ, ...opts })
}

/** Malaysia-time `YYYY-MM-DD` for a timestamp (for "today" comparisons). */
export function klDayKey(d: Date | string = new Date()) {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: TZ })
}
