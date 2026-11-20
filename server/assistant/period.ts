// Calendar periods in Malaysia time (UTC+8, no daylight saving). Weeks start on Monday.
import type { Period } from '../../shared/assistant.js'

const DAY_MS = 86_400_000
const KL_OFFSET_MS = 8 * 3_600_000

export const dayKey = (d: Date | string) => new Date(new Date(d).getTime() + KL_OFFSET_MS).toISOString().slice(0, 10)
export const startOf = (key: string) => new Date(`${key}T00:00:00+08:00`)
export const addDays = (key: string, n: number) => dayKey(new Date(startOf(key).getTime() + n * DAY_MS))
/** 0 = Monday … 6 = Sunday */
const weekday = (key: string) => (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7

const short = (key: string) =>
  startOf(key).toLocaleDateString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'short' })

export type Range = {
  period: Period
  /** Inclusive Malaysia-time day keys. */
  from: string
  to: string
  /** ISO timestamps for queries: [fromIso, toIsoExclusive). */
  fromIso: string
  toIsoExclusive: string
  label: string
}

const NAMES: Record<Period, string> = {
  today: 'today',
  yesterday: 'yesterday',
  this_week: 'this week',
  last_week: 'last week',
  this_month: 'this month',
  last_month: 'last month',
  last_7_days: 'in the last 7 days',
  last_30_days: 'in the last 30 days',
}

export function resolvePeriod(period: Period, now = new Date()): Range {
  const today = dayKey(now)
  const monthStart = `${today.slice(0, 8)}01`
  let from: string
  let to = today
  switch (period) {
    case 'today':
      from = today
      break
    case 'yesterday':
      from = to = addDays(today, -1)
      break
    case 'this_week':
      from = addDays(today, -weekday(today))
      break
    case 'last_week':
      from = addDays(today, -weekday(today) - 7)
      to = addDays(from, 6)
      break
    case 'this_month':
      from = monthStart
      break
    case 'last_month':
      to = addDays(monthStart, -1)
      from = `${to.slice(0, 8)}01`
      break
    case 'last_7_days':
      from = addDays(today, -6)
      break
    case 'last_30_days':
      from = addDays(today, -29)
      break
  }
  const dates = from === to ? short(from) : `${short(from)} – ${short(to)}`
  return {
    period,
    from,
    to,
    fromIso: startOf(from).toISOString(),
    toIsoExclusive: startOf(addDays(to, 1)).toISOString(),
    label: `${NAMES[period]} (${dates})`,
  }
}
