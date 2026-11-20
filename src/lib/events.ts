import { formatDayKey } from './format.ts'

// Human-readable labels for audit-trail events (order page history and dashboard activity).

type EventLike = { action: string; details: Record<string, unknown> }

const LABEL: Record<string, (e: EventLike) => string> = {
  created: () => 'Order created',
  assigned: (e) => `Assigned to ${String(e.details.technician ?? 'technician')}`,
  reassigned: (e) => `Reassigned from ${String(e.details.previousTechnician ?? '?')} to ${String(e.details.technician ?? '?')}`,
  started: () => 'Job started',
  rescheduled: (e) =>
    ['Visit rescheduled', e.details.reason && `: ${String(e.details.reason)}`, e.details.newDate && ` (new date ${formatDayKey(String(e.details.newDate))})`]
      .filter(Boolean)
      .join(''),
  completed: () => 'Job marked done',
  reviewed: (e) => (e.details.note ? `Reviewed: ${String(e.details.note)}` : 'Reviewed'),
  closed: (e) => (e.details.note ? `Closed: ${String(e.details.note)}` : 'Closed'),
}

export const eventLabel = (e: EventLike) => (LABEL[e.action] ?? (() => e.action))(e)
