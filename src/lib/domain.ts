// Shared domain constants for the front-end (follows the assessment brief).
import type { OrderStatus } from '../../shared/orders.ts'

export const ROLES = ['admin', 'technician', 'manager'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  technician: 'Technician',
  manager: 'Manager',
}

// Statuses and service types live in shared/orders.ts (also used by the API).
export { ORDER_STATUSES, SERVICE_TYPES, type OrderStatus, type ServiceType } from '../../shared/orders.ts'

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In progress',
  job_done: 'Job done',
  reviewed: 'Reviewed',
  closed: 'Closed',
}

/**
 * Status → colour tone, mapped onto the design's status table (DESIGN.md §3).
 * Single source of truth: badges, chart marks and dots all read from here.
 */
export type Tone = 'neutral' | 'accent' | 'warning' | 'success' | 'danger'

export const STATUS_TONE: Record<OrderStatus, Tone> = {
  new: 'neutral',
  assigned: 'accent',
  in_progress: 'accent',
  job_done: 'warning', // waiting for manager / accounts review
  reviewed: 'success',
  closed: 'success',
}

/** Badge background + text classes per tone. */
export const TONE_BADGE: Record<Tone, string> = {
  neutral: 'bg-line text-ink-muted',
  accent: 'bg-accent-tint text-accent-text',
  warning: 'bg-warning-tint text-warning-text',
  success: 'bg-success-tint text-success-text',
  danger: 'bg-danger-tint text-danger-text',
}

/** Solid mark colour per tone (bars, dots, segments). Never used as text colour. */
export const TONE_MARK: Record<Tone, string> = {
  neutral: 'bg-ink-muted',
  accent: 'bg-accent',
  warning: 'bg-warning',
  success: 'bg-success',
  danger: 'bg-danger',
}

/** Mock technicians from the assessment brief. */
export const TECHNICIANS = ['Ali', 'John', 'Bala', 'Yusoff'] as const

/** Landing route per role. Admin and manager share one desktop app with role-based nav. */
export const ROLE_HOME: Record<Role, string> = {
  admin: '/overview',
  manager: '/overview',
  technician: '/tech/jobs',
}
