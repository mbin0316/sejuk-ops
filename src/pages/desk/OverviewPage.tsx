import clsx from 'clsx'
import { CalendarClock, CircleCheck, ClipboardList, Plus, Wallet, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  DASHBOARD_RANGES,
  type DashboardData,
  type DashboardPoint,
  type DashboardRange,
} from '../../../shared/dashboard.ts'
import type { OrderStatus } from '../../../shared/orders.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Badge, ButtonLink, Card, HighlightCard, NavyPanel, StatusBadge } from '../../components/ui.tsx'
import { useDashboard } from '../../lib/dashboard.ts'
import { TONE_MARK, type Tone } from '../../lib/domain.ts'
import { eventLabel } from '../../lib/events.ts'
import { formatDateTime, formatDayKey, formatLongDate, formatMoney, formatMoneyCompact, formatTime, initials } from '../../lib/format.ts'
import { useSession } from '../../lib/session.tsx'

const RANGE_LABEL: Record<DashboardRange, string> = { '1w': '1W', '1m': '1M', '3m': '3M' }
const RANGE_TEXT: Record<DashboardRange, string> = { '1w': 'last 7 days', '1m': 'last 30 days', '3m': 'last 3 months' }
const RANGE_NAME: Record<DashboardRange, string> = { '1w': '1 week', '1m': '1 month', '3m': '3 months' }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** KPI dashboard: the home page for admin and manager. */
export function OverviewPage() {
  const { user } = useSession()
  const [params, setParams] = useSearchParams()
  const rangeParam = params.get('range') as DashboardRange | null
  const range: DashboardRange = rangeParam && DASHBOARD_RANGES.includes(rangeParam) ? rangeParam : '1w'
  const dash = useDashboard(range)
  const isAdmin = user?.role === 'admin'

  const setRange = (r: DashboardRange) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (r === '1w') next.delete('range')
        else next.set('range', r)
        return next
      },
      { replace: true },
    )

  const header = (
    <PageHeader
      title="Operations overview"
      subtitle={dash.data ? `${formatLongDate()} · Updated ${formatTime(new Date(dash.data.generatedAt))}` : undefined}
      actions={
        isAdmin && (
          <ButtonLink to="/orders/new">
            <Plus className="size-5" strokeWidth={1.8} aria-hidden="true" />
            New order
          </ButtonLink>
        )
      }
    />
  )

  if (dash.isPending) {
    return (
      <>
        {header}
        <div className="grid gap-4 dash:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]" aria-busy="true">
          <div className="h-[380px] animate-pulse rounded-panel bg-navy-900" />
          <div className="h-[380px] animate-pulse rounded-panel bg-surface" />
        </div>
        <p className="sr-only" role="status">
          Loading dashboard…
        </p>
      </>
    )
  }

  if (dash.isError) {
    return (
      <>
        {header}
        <Card>
          <p role="alert" className="text-body-sm text-danger-text">
            Couldn't load the dashboard: {dash.error.message}
          </p>
        </Card>
      </>
    )
  }

  const d = dash.data
  const s = d.statusCounts
  const openOrders = s.new + s.assigned + s.in_progress
  const todayDiff = d.completedToday - d.completedYesterday
  const revenueChange = d.revenuePrev > 0 ? Math.round(((d.revenue - d.revenuePrev) / d.revenuePrev) * 100) : null

  return (
    <>
      {header}
      <div className="grid items-start gap-4 dash:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <PerformancePanel data={d} onRange={setRange} loading={dash.isPlaceholderData} />

          <div className="grid gap-4 nav:grid-cols-3">
            <StatusBreakdown counts={s} className="nav:row-span-2" />
            <KpiTile icon={ClipboardList} label="Open orders" value={String(openOrders)}>
              <Qualifier>{s.new} not yet assigned</Qualifier>
            </KpiTile>
            <KpiTile icon={CircleCheck} label="Completed today" value={String(d.completedToday)}>
              <Badge tone={todayDiff > 0 ? 'success' : 'neutral'}>
                {todayDiff > 0 ? '+' : ''}
                {todayDiff} vs yesterday
              </Badge>
            </KpiTile>
            <KpiTile icon={Wallet} label={`Total amount, ${RANGE_TEXT[d.range]}`} value={formatMoneyCompact(d.revenue)}>
              {revenueChange != null ? (
                <Badge tone={revenueChange >= 0 ? 'success' : 'neutral'}>
                  {revenueChange >= 0 ? '+' : ''}
                  {revenueChange}% vs previous
                </Badge>
              ) : (
                <Qualifier>completed jobs</Qualifier>
              )}
            </KpiTile>
            <KpiTile icon={CalendarClock} label={`Reschedules, ${RANGE_TEXT[d.range]}`} value={String(d.rescheduled)}>
              <Qualifier>visits postponed</Qualifier>
            </KpiTile>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Leaderboard data={d} isAdmin={isAdmin} />
          <RecentActivity data={d} />
          <ReviewHighlight data={d} isAdmin={isAdmin} />
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Hero chart panel                                                          */
/* ------------------------------------------------------------------------ */

function PerformancePanel({
  data,
  onRange,
  loading,
}: {
  data: DashboardData
  onRange: (r: DashboardRange) => void
  loading: boolean
}) {
  const per = data.bucket === 'week' ? 'week' : 'day'
  return (
    <NavyPanel className={clsx('flex flex-col gap-5 transition-opacity', loading && 'opacity-70')} aria-busy={loading}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-heading font-medium">Service performance</h2>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
            <span className="text-hero font-medium tabular-nums">{data.completed}</span>
            <span className="text-body-sm text-on-navy-soft">jobs completed · {RANGE_TEXT[data.range]}</span>
          </p>
        </div>
        <div role="group" aria-label="Period" className="flex rounded-full bg-navy-800 p-1">
          {DASHBOARD_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === data.range}
              aria-label={RANGE_NAME[r]}
              onClick={() => onRange(r)}
              className={clsx(
                'h-9 min-w-12 rounded-full px-4 text-body-sm transition-colors',
                r === data.range ? 'bg-white font-medium text-navy-900' : 'text-white hover:bg-navy-900/40',
              )}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-body-sm text-on-navy-soft">
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-success" aria-hidden="true" />
          Completed per {per}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-danger" aria-hidden="true" />
          Rescheduled per {per} ({data.rescheduled} total)
        </li>
      </ul>

      <DivergingBars data={data} />
    </NavyPanel>
  )
}

const UP_H = 168
const DOWN_H = 48

/** Completed bars up, rescheduled bars down, over one baseline (DESIGN.md §4 Hero chart panel). */
function DivergingBars({ data }: { data: DashboardData }) {
  const [hover, setHover] = useState<number | null>(null)
  const { series, bucket } = data
  const maxUp = Math.max(...series.map((p) => p.completed), 0)
  const top = Math.max(4, Math.ceil(maxUp / 2) * 2) // even, so the midline label is a whole number
  const px = UP_H / top
  const labelEvery = bucket === 'week' ? 2 : series.length > 7 ? 5 : 1
  const last = series.length - 1

  const title = (p: DashboardPoint) =>
    bucket === 'week' ? `Week of ${formatDayKey(p.date)}` : formatDayKey(p.date, { weekday: 'short', day: 'numeric', month: 'short' })
  const xLabel = (p: DashboardPoint) =>
    bucket === 'day' && series.length <= 7 ? formatDayKey(p.date, { weekday: 'short', day: 'numeric' }) : formatDayKey(p.date)

  const busiest = series.reduce((a, b) => (b.completed > a.completed ? b : a), series[0])
  const summary =
    `Bar chart of jobs completed (up) and visits rescheduled (down) per ${bucket}, ` +
    `${formatDayKey(data.from)} to ${formatDayKey(data.to)}. ` +
    (busiest && busiest.completed > 0 ? `Busiest: ${title(busiest)} with ${plural(busiest.completed, 'job')}.` : 'No jobs completed yet.')

  return (
    <div className="flex gap-3">
      {/* Y axis */}
      <div className="relative w-6 shrink-0 text-right text-caption text-on-navy-muted tabular-nums" aria-hidden="true" style={{ height: UP_H + DOWN_H + 32 }}>
        <span className="absolute right-0 -translate-y-1/2" style={{ top: 0 }}>{top}</span>
        <span className="absolute right-0 -translate-y-1/2" style={{ top: UP_H / 2 }}>{top / 2}</span>
        <span className="absolute right-0 -translate-y-1/2" style={{ top: UP_H }}>0</span>
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto">
        <div role="img" aria-label={summary} className="relative" style={{ minWidth: series.length * 16 }}>
          {/* Grid: top, mid (recessive) and the baseline */}
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-navy-800" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-navy-800" style={{ top: UP_H / 2 }} aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 h-px bg-navy-800" style={{ top: UP_H }} aria-hidden="true" />

          <div className="relative flex" onMouseLeave={() => setHover(null)}>
            {series.map((p, i) => (
              <div
                key={p.date}
                className="relative flex min-w-4 flex-1 flex-col items-center"
                onMouseEnter={() => setHover(i)}
                aria-hidden="true"
              >
                {/* Hover band, bigger than the mark */}
                <div
                  className={clsx('absolute inset-x-0.5 top-0 rounded-input transition-colors', hover === i && 'bg-navy-800/50')}
                  style={{ height: UP_H + DOWN_H }}
                />
                <div className="relative flex w-full items-end justify-center" style={{ height: UP_H }}>
                  {p.completed > 0 && (
                    <div className="w-[calc(100%-6px)] max-w-3 rounded-t-[4px] bg-success" style={{ height: p.completed * px }} />
                  )}
                </div>
                <div className="relative flex w-full items-start justify-center pt-1" style={{ height: DOWN_H }}>
                  {p.rescheduled > 0 && (
                    <div
                      className="w-[calc(100%-6px)] max-w-3 rounded-b-[4px] bg-danger"
                      style={{ height: Math.min(DOWN_H - 4, p.rescheduled * px) }}
                    />
                  )}
                </div>
                {/* Labels centred under their bar; the first and last anchor inside so nothing overflows. */}
                <div className="relative h-8 w-full">
                  {(last - i) % labelEvery === 0 && (
                    <span
                      className={clsx(
                        'absolute top-2 text-caption whitespace-nowrap text-on-navy-muted',
                        series.length > 7 && i === last ? 'right-0' : series.length > 7 && i === 0 ? 'left-0' : 'left-1/2 -translate-x-1/2',
                      )}
                    >
                      {xLabel(p)}
                    </span>
                  )}
                </div>

                {hover === i && (
                  <div
                    className={clsx(
                      'absolute z-10 rounded-input bg-white px-3 py-2 text-caption whitespace-nowrap text-ink shadow-card',
                      i < series.length / 2 ? 'left-1/2' : 'right-1/2',
                    )}
                    style={{ top: Math.max(0, UP_H - p.completed * px - 64) }}
                  >
                    <p className="font-medium">{title(p)}</p>
                    <p className="mt-0.5 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-success" />
                      {plural(p.completed, 'job')} completed
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-danger" />
                      {plural(p.rescheduled, 'visit')} rescheduled
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Table view of the same numbers for screen readers */}
        <table className="sr-only">
          <caption>Jobs completed and rescheduled per {bucket}</caption>
          <thead>
            <tr>
              <th scope="col">{bucket === 'week' ? 'Week of' : 'Day'}</th>
              <th scope="col">Completed</th>
              <th scope="col">Rescheduled</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.date}>
                <th scope="row">{title(p)}</th>
                <td>{p.completed}</td>
                <td>{p.rescheduled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Status breakdown and KPI tiles                                            */
/* ------------------------------------------------------------------------ */

const STATUS_GROUPS: { label: string; statuses: OrderStatus[]; tone: Tone }[] = [
  { label: 'New order', statuses: ['new'], tone: 'neutral' },
  { label: 'Assigned / in progress', statuses: ['assigned', 'in_progress'], tone: 'accent' },
  { label: 'Job done, awaiting review', statuses: ['job_done'], tone: 'warning' },
  { label: 'Reviewed / closed', statuses: ['reviewed', 'closed'], tone: 'success' },
]

function StatusBreakdown({ counts, className }: { counts: Record<OrderStatus, number>; className?: string }) {
  const groups = STATUS_GROUPS.map((g) => ({ ...g, count: g.statuses.reduce((n, s) => n + counts[s], 0) }))
  const total = groups.reduce((n, g) => n + g.count, 0)
  const shown = groups.filter((g) => g.count > 0)
  return (
    <Card className={clsx('flex flex-col', className)}>
      <h2 className="text-heading font-medium text-ink">Jobs by status</h2>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-metric font-medium text-ink tabular-nums">{total}</span>
        <span className="text-body-sm text-ink-muted">all orders</span>
      </p>
      <div className="mt-4 flex h-7 gap-[3px]" aria-hidden="true">
        {shown.map((g, i) => (
          <div
            key={g.label}
            className={clsx(
              'min-w-1.5 rounded-[4px]',
              TONE_MARK[g.tone],
              i === 0 && 'rounded-l-[10px]',
              i === shown.length - 1 && 'rounded-r-[10px]',
            )}
            style={{ flexGrow: g.count }}
          />
        ))}
      </div>
      <ul className="mt-5 flex flex-col gap-3">
        {groups.map((g) => (
          <li key={g.label} className="flex items-center gap-3">
            <span className={clsx('size-3.5 shrink-0 rounded-[4px]', TONE_MARK[g.tone])} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-body-sm text-ink">{g.label}</p>
              <p className="text-caption text-ink-muted">{total ? Math.round((g.count / total) * 100) : 0}%</p>
            </div>
            <span className="text-body-sm text-ink tabular-nums">{g.count}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function KpiTile({ icon: Icon, label, value, children }: { icon: LucideIcon; label: string; value: string; children?: ReactNode }) {
  return (
    <Card className="flex min-h-[150px] flex-col justify-between gap-4 md:p-5">
      <p className="flex items-center gap-2 text-body-sm text-ink">
        <Icon className="size-[18px] shrink-0 text-ink-muted" strokeWidth={1.8} aria-hidden="true" />
        {label}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-metric font-medium text-ink tabular-nums">{value}</span>
        {children}
      </p>
    </Card>
  )
}

const Qualifier = ({ children }: { children: ReactNode }) => <span className="text-caption text-ink-muted">{children}</span>

/* ------------------------------------------------------------------------ */
/* Right column                                                              */
/* ------------------------------------------------------------------------ */

/** Per-technician KPIs: jobs completed, total amount and reschedules (assessment KPI dashboard). */
function Leaderboard({ data, isAdmin }: { data: DashboardData; isAdmin: boolean }) {
  const max = Math.max(1, ...data.leaderboard.map((r) => r.completed))
  return (
    <section className="rounded-panel bg-surface p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-heading font-medium text-ink">Technician leaderboard</h2>
        <span className="text-caption text-ink-muted">{RANGE_TEXT[data.range]}</span>
      </div>

      {data.leaderboard.length === 0 ? (
        <p className="mt-4 text-body-sm text-ink-muted">No technicians yet.</p>
      ) : (
        <ol className="mt-5 flex flex-col gap-5">
          {data.leaderboard.map((r, i) => (
            <li key={r.technicianId} className="flex items-center gap-3">
              <span className="w-3 shrink-0 text-caption text-ink-muted tabular-nums">{i + 1}</span>
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-btn bg-accent-tint text-label font-medium text-accent-text"
                aria-hidden="true"
              >
                {initials(r.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <Link to={`/orders?technician=${r.technicianId}`} className="truncate text-body-sm text-ink hover:text-accent-text">
                    {r.name}
                  </Link>
                  <span className="text-body-sm text-ink tabular-nums">{formatMoney(r.revenue)}</span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-accent-tint"
                  role="meter"
                  aria-label={`${r.name}: jobs completed`}
                  aria-valuemin={0}
                  aria-valuemax={max}
                  aria-valuenow={r.completed}
                >
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(r.completed / max) * 100}%` }} />
                </div>
                <div className="mt-1 flex justify-between gap-2 text-caption text-ink-muted">
                  <span>{plural(r.completed, 'job')} done</span>
                  <span>
                    {r.rescheduled} rescheduled · {r.openJobs} open
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <ButtonLink to={isAdmin ? '/orders/new' : '/orders'} variant="dark" className="mt-6 w-full">
        {isAdmin && <Plus className="size-5" strokeWidth={1.8} aria-hidden="true" />}
        {isAdmin ? 'Create and assign a job' : 'View job orders'}
      </ButtonLink>
    </section>
  )
}

function RecentActivity({ data }: { data: DashboardData }) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-heading font-medium text-ink">Recent activity</h2>
        <Link to="/orders" className="text-body-sm">
          View all
        </Link>
      </div>
      {data.recent.length === 0 ? (
        <p className="mt-4 text-body-sm text-ink-muted">No activity yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {data.recent.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/orders/${e.orderId}`} className="block truncate text-body-sm text-ink hover:text-accent-text">
                  {e.orderNo} · {eventLabel(e)}
                </Link>
                <p className="truncate text-caption text-ink-muted">
                  {e.actorName} · {formatDateTime(e.createdAt)}
                </p>
              </div>
              {e.toStatus && e.toStatus !== e.fromStatus && <StatusBadge status={e.toStatus} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ReviewHighlight({ data, isAdmin }: { data: DashboardData; isAdmin: boolean }) {
  const n = data.waitingReview
  return (
    <HighlightCard className="flex flex-col gap-4">
      <div>
        <h2 className="text-heading font-medium">Waiting for review</h2>
        <p className="mt-2 text-body-sm text-white/90">
          {n === 0
            ? 'No completed jobs are waiting for manager review.'
            : `${plural(n, 'completed job')} ${n === 1 ? 'needs' : 'need'} manager review.`}
          {data.waitingReviewOver48h > 0 &&
            ` ${data.waitingReviewOver48h} ${data.waitingReviewOver48h === 1 ? 'has' : 'have'} waited more than 48 hours.`}
        </p>
      </div>
      <ButtonLink to={isAdmin ? '/orders?status=job_done' : '/review'} variant="on-accent" className="w-full">
        {isAdmin ? 'View completed jobs' : 'Review jobs'}
      </ButtonLink>
    </HighlightCard>
  )
}
