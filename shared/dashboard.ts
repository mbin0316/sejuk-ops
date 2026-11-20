// KPI dashboard contract shared by the API and the web app.
import type { OrderStatus } from './orders.js'

/** Period toggle on the dashboard. Weekly is the default (assessment: weekly data at minimum). */
export const DASHBOARD_RANGES = ['1w', '1m', '3m'] as const
export type DashboardRange = (typeof DASHBOARD_RANGES)[number]

export const RANGE_DAYS: Record<DashboardRange, number> = { '1w': 7, '1m': 30, '3m': 91 }

/** One chart bar: a day (1w, 1m) or a week starting on `date` (3m). Dates are Malaysia-time YYYY-MM-DD. */
export type DashboardPoint = { date: string; completed: number; rescheduled: number }

/** Per-technician KPIs for the period. */
export type LeaderboardRow = {
  technicianId: number
  name: string
  /** Jobs marked done in the period. */
  completed: number
  /** Sum of final amounts of those jobs (RM). */
  revenue: number
  /** Visits postponed / rescheduled in the period. */
  rescheduled: number
  /** Jobs currently assigned or in progress. */
  openJobs: number
}

export type ActivityItem = {
  id: number
  orderId: string
  orderNo: string
  serviceType: string
  action: string
  fromStatus: OrderStatus | null
  toStatus: OrderStatus | null
  actorName: string
  details: Record<string, unknown>
  createdAt: string
}

export type DashboardData = {
  range: DashboardRange
  bucket: 'day' | 'week'
  from: string
  to: string
  generatedAt: string
  completed: number
  completedPrev: number
  revenue: number
  revenuePrev: number
  rescheduled: number
  series: DashboardPoint[]
  leaderboard: LeaderboardRow[]
  /** Every order by its current status (not limited to the period). */
  statusCounts: Record<OrderStatus, number>
  completedToday: number
  completedYesterday: number
  waitingReview: number
  waitingReviewOver48h: number
  recent: ActivityItem[]
}
