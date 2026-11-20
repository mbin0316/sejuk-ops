import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
  DASHBOARD_RANGES,
  RANGE_DAYS,
  type ActivityItem,
  type DashboardData,
  type DashboardPoint,
  type DashboardRange,
  type LeaderboardRow,
} from '../../shared/dashboard.js'
import { ORDER_STATUSES, type OrderStatus } from '../../shared/orders.js'
import { requireRole, type AuthEnv } from '../auth.js'
import { check, db } from '../db.js'

// ---------------------------------------------------------------------------
// Malaysia-time day keys (UTC+8 all year, no daylight saving)
// ---------------------------------------------------------------------------
const DAY_MS = 86_400_000
const KL_OFFSET_MS = 8 * 3_600_000

/** `YYYY-MM-DD` of the Malaysia calendar day containing `d`. */
const dayKey = (d: Date | string) => new Date(new Date(d).getTime() + KL_OFFSET_MS).toISOString().slice(0, 10)
/** Midnight (Malaysia) at the start of a day key. */
const startOf = (key: string) => new Date(`${key}T00:00:00+08:00`)
const addDays = (key: string, n: number) => dayKey(new Date(startOf(key).getTime() + n * DAY_MS))
const daysBetween = (from: string, to: string) => Math.round((startOf(to).getTime() - startOf(from).getTime()) / DAY_MS)

type Row = Record<string, unknown>
const one = (v: unknown): Row | null => (Array.isArray(v) ? (v[0] ?? null) : ((v as Row | null) ?? null))

export const dashboardRoutes = new Hono<AuthEnv>()

/**
 * GET /api/dashboard?range=1w|1m|3m: KPIs for the admin / manager overview.
 * Jobs completed, total amount and reschedules per technician (leaderboard), a daily
 * (or weekly for 3m) series for the chart, the status pipeline and recent activity.
 */
dashboardRoutes.get('/', requireRole('admin', 'manager'), async (c) => {
  const rangeParam = c.req.query('range') ?? '1w'
  if (!DASHBOARD_RANGES.includes(rangeParam as DashboardRange)) {
    throw new HTTPException(400, { message: `range must be one of ${DASHBOARD_RANGES.join(', ')}` })
  }
  const range = rangeParam as DashboardRange
  const days = RANGE_DAYS[range]
  const bucket = range === '3m' ? 'week' : 'day'

  const now = new Date()
  const today = dayKey(now)
  const from = addDays(today, -(days - 1))
  const prevFrom = addDays(from, -days)
  // Reports back to the start of the previous period, for the "vs previous" deltas (always covers yesterday).
  const reportsSince = startOf(prevFrom).toISOString()

  const sb = db()
  const cutoff48h = new Date(now.getTime() - 48 * 3_600_000).toISOString()
  // Counts are done by the database (head: true returns only the count), so this doesn't grow with order history.
  const countWhere = (status: OrderStatus) => sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', status)
  const [reports, reschedules, openJobs, technicians, recent, over48h, ...statusResults] = await Promise.all([
    sb.from('job_reports').select('technician_id, final_amount, completed_at').gte('completed_at', reportsSince),
    sb
      .from('order_events')
      .select('created_at, details, order:orders(technician_id)')
      .eq('action', 'rescheduled')
      .gte('created_at', startOf(from).toISOString()),
    // Only jobs being worked on right now, for each technician's open count.
    sb.from('orders').select('technician_id').in('status', ['assigned', 'in_progress']).not('technician_id', 'is', null),
    sb.from('technicians').select('id, name, active').order('id'),
    sb
      .from('order_events')
      .select('id, action, from_status, to_status, actor_name, details, created_at, order:orders(id, order_no, service_type)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(6),
    countWhere('job_done').lt('completed_at', cutoff48h),
    ...ORDER_STATUSES.map(countWhere),
  ])
  const reportRows = check(reports, 'load completed jobs') ?? []
  const rescheduleRows = check(reschedules, 'load reschedules') ?? []
  const openRows = check(openJobs, 'load open jobs') ?? []
  const techRows = check(technicians, 'load technicians') ?? []
  const recentRows = check(recent, 'load recent activity') ?? []

  // ---- Chart series: one bucket per day (or per 7 days for 3m), oldest first ----
  const step = bucket === 'week' ? 7 : 1
  const series: DashboardPoint[] = []
  for (let i = 0; i < days; i += step) series.push({ date: addDays(from, i), completed: 0, rescheduled: 0 })
  const bucketOf = (key: string) => {
    const offset = daysBetween(from, key)
    return offset < 0 || key > today ? null : series[Math.floor(offset / step)]
  }

  // ---- Per-technician KPIs ----
  const board = new Map<number, LeaderboardRow>()
  for (const t of techRows) {
    board.set(Number(t.id), {
      technicianId: Number(t.id),
      name: String(t.name),
      completed: 0,
      revenue: 0,
      rescheduled: 0,
      openJobs: 0,
    })
  }

  let completed = 0
  let completedPrev = 0
  let revenue = 0
  let revenuePrev = 0
  let completedToday = 0
  let completedYesterday = 0
  const yesterday = addDays(today, -1)

  for (const r of reportRows) {
    const key = dayKey(String(r.completed_at))
    const amount = Number(r.final_amount)
    if (key === today) completedToday++
    if (key === yesterday) completedYesterday++
    if (key >= from && key <= today) {
      completed++
      revenue += amount
      bucketOf(key)!.completed++
      const row = board.get(Number(r.technician_id))
      if (row) {
        row.completed++
        row.revenue += amount
      }
    } else if (key >= prevFrom && key < from) {
      completedPrev++
      revenuePrev += amount
    }
  }

  let rescheduled = 0
  for (const e of rescheduleRows) {
    const key = dayKey(String(e.created_at))
    const point = bucketOf(key)
    if (!point) continue
    point.rescheduled++
    rescheduled++
    const details = (e.details ?? {}) as Row
    const techId = Number(details.technicianId ?? one(e.order)?.technician_id)
    const row = board.get(techId)
    if (row) row.rescheduled++
  }

  // ---- Pipeline: every order by current status (counted in the database) ----
  const countOf = (r: { count: number | null; error: { message: string } | null }, what: string) => {
    if (r.error) {
      console.error(`[dashboard] could not count ${what}:`, r.error.message)
      throw new HTTPException(500, { message: 'Could not load the dashboard' })
    }
    return r.count ?? 0
  }
  const statusCounts = Object.fromEntries(
    ORDER_STATUSES.map((s, i) => [s, countOf(statusResults[i], `${s} orders`)]),
  ) as Record<OrderStatus, number>
  const waitingReview = statusCounts.job_done
  const waitingReviewOver48h = countOf(over48h, 'jobs waiting over 48 hours')
  for (const o of openRows) {
    const row = board.get(Number(o.technician_id))
    if (row) row.openJobs++
  }

  // Active technicians, plus anyone inactive who still has numbers in this period.
  const activeIds = new Set(techRows.filter((t) => t.active).map((t) => Number(t.id)))
  const leaderboard = [...board.values()]
    .filter((r) => activeIds.has(r.technicianId) || r.completed || r.rescheduled || r.openJobs)
    .map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }))
    .sort((a, b) => b.completed - a.completed || b.revenue - a.revenue || a.rescheduled - b.rescheduled || a.name.localeCompare(b.name))

  const recentItems: ActivityItem[] = recentRows.flatMap((e) => {
    const order = one(e.order)
    if (!order) return []
    return [
      {
        id: Number(e.id),
        orderId: String(order.id),
        orderNo: String(order.order_no),
        serviceType: String(order.service_type),
        action: String(e.action),
        fromStatus: (e.from_status as OrderStatus | null) ?? null,
        toStatus: (e.to_status as OrderStatus | null) ?? null,
        actorName: String(e.actor_name),
        details: (e.details as Record<string, unknown>) ?? {},
        createdAt: String(e.created_at),
      },
    ]
  })

  const data: DashboardData = {
    range,
    bucket,
    from,
    to: today,
    generatedAt: now.toISOString(),
    completed,
    completedPrev,
    revenue: Math.round(revenue * 100) / 100,
    revenuePrev: Math.round(revenuePrev * 100) / 100,
    rescheduled,
    series,
    leaderboard,
    statusCounts,
    completedToday,
    completedYesterday,
    waitingReview,
    waitingReviewOver48h,
    recent: recentItems,
  }
  return c.json(data)
})
