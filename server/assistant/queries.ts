// The controlled queries behind the AI operations window. Each is a fixed, parameterised read:
// the AI picks one and its parameters; it never writes SQL or touches the database itself.
import { HTTPException } from 'hono/http-exception'
import type { Cell, FlagIssue, Interpretation, Period, QueryName, QueryResult, RankingMetric } from '../../shared/assistant.js'
import type { OrderStatus } from '../../shared/orders.js'
import { check, db } from '../db.js'
import { resolvePeriod, type Range } from './period.js'

type Row = Record<string, unknown>
type Tech = { id: number; name: string; active: boolean }

const DONE: OrderStatus[] = ['job_done', 'reviewed', 'closed']
const OPEN: OrderStatus[] = ['new', 'assigned', 'in_progress']
const MAX_ROWS = 50

const one = (v: unknown): Row | null => (Array.isArray(v) ? ((v[0] as Row) ?? null) : ((v as Row | null) ?? null))
const money = (n: number) => Math.round(n * 100) / 100

async function technicians(): Promise<Tech[]> {
  const rows = check(await db().from('technicians').select('id, name, active').order('name'), 'load technicians') ?? []
  return rows.map((t) => ({ id: Number(t.id), name: String(t.name), active: Boolean(t.active) }))
}

/** Match a technician name loosely ("ali", "Technician Ali") against the real list. */
function findTech(list: Tech[], name: string | null): Tech | null {
  if (!name) return null
  const n = name.trim().toLowerCase().replace(/^(technician|tech)\s+/, '')
  return list.find((t) => t.name.toLowerCase() === n) ?? list.find((t) => n.includes(t.name.toLowerCase())) ?? null
}

/** "order 26", "ORDER26", "#0026" → "ORDER0026" */
export function normaliseOrderNo(raw: string | null): string | null {
  const digits = raw?.match(/(\d{1,8})/)?.[1]
  return digits ? `ORDER${digits.padStart(4, '0')}` : null
}

function result(
  query: QueryName,
  params: Record<string, string | null>,
  title: string,
  range: Range | null,
  facts: Record<string, Cell>,
  columns: QueryResult['columns'],
  rows: Record<string, Cell>[],
): QueryResult {
  return {
    query,
    params,
    title,
    periodLabel: range?.label ?? null,
    facts,
    columns,
    rows: rows.slice(0, MAX_ROWS),
    truncated: rows.length > MAX_ROWS,
  }
}

/* ---------- 1. completed_jobs ---------- */
async function completedJobs(tech: Tech | null, range: Range): Promise<QueryResult> {
  let q = db()
    .from('orders')
    .select('order_no, customer_name, service_type, status, completed_at, technician:technicians(name), report:job_reports(final_amount)')
    .in('status', DONE)
    .gte('completed_at', range.fromIso)
    .lt('completed_at', range.toIsoExclusive)
    .order('completed_at')
  if (tech) q = q.eq('technician_id', tech.id)
  const rows = (check(await q, 'load completed jobs') ?? []).map((r) => ({
    orderNo: String(r.order_no),
    customer: String(r.customer_name),
    service: String(r.service_type),
    technician: (one(r.technician)?.name as string) ?? null,
    completedAt: String(r.completed_at),
    finalAmount: Number(one(r.report)?.final_amount ?? 0),
    status: String(r.status),
  }))
  return result(
    'completed_jobs',
    { technician: tech?.name ?? null, period: range.period },
    `Jobs completed${tech ? ` by ${tech.name}` : ''}, ${range.label}`,
    range,
    { jobsCompleted: rows.length, totalAmount: money(rows.reduce((s, r) => s + r.finalAmount, 0)) },
    [
      { key: 'orderNo', label: 'Order', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'service', label: 'Service', type: 'text' },
      ...(tech ? [] : [{ key: 'technician', label: 'Technician', type: 'text' as const }]),
      { key: 'completedAt', label: 'Done', type: 'datetime' },
      { key: 'finalAmount', label: 'Final', type: 'money' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    rows,
  )
}

/* ---------- per-technician numbers for a period (ranking, revenue) ---------- */
async function perTechnician(range: Range, techs: Tech[]) {
  const [reports, events] = await Promise.all([
    db()
      .from('job_reports')
      .select('technician_id, final_amount, extra_charges, payment_amount, payment_method')
      .gte('completed_at', range.fromIso)
      .lt('completed_at', range.toIsoExclusive),
    db()
      .from('order_events')
      .select('details, order:orders(technician_id)')
      .eq('action', 'rescheduled')
      .gte('created_at', range.fromIso)
      .lt('created_at', range.toIsoExclusive),
  ])
  const stats = new Map(
    techs.map((t) => [t.id, { technician: t.name, active: t.active, completed: 0, revenue: 0, extra: 0, collected: 0, notCollected: 0, reschedules: 0 }]),
  )
  for (const r of check(reports, 'load completed jobs') ?? []) {
    const s = stats.get(Number(r.technician_id))
    if (!s) continue
    s.completed++
    s.revenue += Number(r.final_amount)
    s.extra += Number(r.extra_charges)
    if (r.payment_method) s.collected += Number(r.payment_amount ?? 0)
    else s.notCollected++
  }
  for (const e of check(events, 'load reschedules') ?? []) {
    const d = (e.details ?? {}) as Row
    const s = stats.get(Number(d.technicianId ?? one(e.order)?.technician_id))
    if (s) s.reschedules++
  }
  return [...stats.values()]
    .filter((s) => s.active || s.completed || s.reschedules)
    .map((s) => ({ ...s, revenue: money(s.revenue), extra: money(s.extra), collected: money(s.collected) }))
}

/* ---------- 2. technician_ranking ---------- */
async function technicianRanking(metric: RankingMetric, range: Range, techs: Tech[]): Promise<QueryResult> {
  const key = metric === 'completed' ? 'completed' : metric === 'revenue' ? 'revenue' : 'reschedules'
  const stats = (await perTechnician(range, techs)).sort(
    (a, b) => b[key] - a[key] || b.completed - a.completed || a.technician.localeCompare(b.technician),
  )
  const top = stats[0]
  const leaders = top && top[key] > 0 ? stats.filter((s) => s[key] === top[key]).map((s) => s.technician) : []
  const what = metric === 'completed' ? 'jobs completed' : metric === 'revenue' ? 'total amount' : 'reschedules'
  return result(
    'technician_ranking',
    { metric, period: range.period },
    `Technicians by ${what}, ${range.label}`,
    range,
    { leaders: leaders.join(', ') || null, leaderValue: top ? top[key] : null, metric },
    [
      { key: 'rank', label: '#', type: 'number' },
      { key: 'technician', label: 'Technician', type: 'text' },
      { key: 'completed', label: 'Jobs done', type: 'number' },
      { key: 'revenue', label: 'Total amount', type: 'money' },
      { key: 'reschedules', label: 'Reschedules', type: 'number' },
    ],
    stats.map((s, i) => ({ rank: i + 1, technician: s.technician, completed: s.completed, revenue: s.revenue, reschedules: s.reschedules })),
  )
}

/* ---------- 3. open_jobs ---------- */
const STATUS_TITLE: Record<OrderStatus, string> = {
  new: 'Orders not assigned yet',
  assigned: 'Jobs assigned, not started',
  in_progress: 'Jobs in progress',
  job_done: 'Jobs waiting for review',
  reviewed: 'Reviewed jobs ready to close',
  closed: 'Closed jobs',
}

async function openJobs(tech: Tech | null, status: OrderStatus | null): Promise<QueryResult> {
  let q = db()
    .from('orders')
    .select('order_no, customer_name, service_type, status, created_at, assigned_at, completed_at, technician:technicians(name)')
    .in('status', status ? [status] : OPEN)
    .order('created_at')
    .limit(MAX_ROWS + 1)
  if (tech) q = q.eq('technician_id', tech.id)
  const rows = (check(await q, 'load jobs') ?? []).map((r) => ({
    orderNo: String(r.order_no),
    customer: String(r.customer_name),
    service: String(r.service_type),
    technician: (one(r.technician)?.name as string) ?? 'Unassigned',
    status: String(r.status),
    since: String(r.completed_at ?? r.assigned_at ?? r.created_at),
  }))
  const byStatus: Record<string, number> = {}
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
  return result(
    'open_jobs',
    { technician: tech?.name ?? null, status },
    `${status ? STATUS_TITLE[status] : 'Jobs not finished yet'}${tech ? ` for ${tech.name}` : ''}`,
    null,
    { count: rows.length, ...byStatus },
    [
      { key: 'orderNo', label: 'Order', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'service', label: 'Service', type: 'text' },
      ...(tech ? [] : [{ key: 'technician', label: 'Technician', type: 'text' as const }]),
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'since', label: 'Since', type: 'datetime' },
    ],
    rows,
  )
}

/* ---------- 4. technician_workload ---------- */
async function technicianWorkload(techs: Tech[]): Promise<QueryResult> {
  const rows = check(await db().from('orders').select('status, technician_id').in('status', OPEN), 'load open jobs') ?? []
  const load = new Map(techs.filter((t) => t.active).map((t) => [t.id, { technician: t.name, assigned: 0, inProgress: 0, open: 0 }]))
  let unassigned = 0
  for (const r of rows) {
    if (r.technician_id == null) {
      unassigned++
      continue
    }
    const l = load.get(Number(r.technician_id))
    if (!l) continue
    if (r.status === 'in_progress') l.inProgress++
    else l.assigned++
    l.open++
  }
  const list = [...load.values()].sort((a, b) => b.open - a.open || a.technician.localeCompare(b.technician))
  const avg = list.length ? list.reduce((s, l) => s + l.open, 0) / list.length : 0
  // Overloaded: at least 3 open jobs and at least twice the team average.
  const overloaded = list.filter((l) => l.open >= 3 && l.open >= 2 * avg)
  return result(
    'technician_workload',
    {},
    'Open jobs per technician right now',
    null,
    {
      overloaded: overloaded.map((l) => l.technician).join(', ') || null,
      averageOpenJobs: Math.round(avg * 10) / 10,
      unassignedOrders: unassigned,
    },
    [
      { key: 'technician', label: 'Technician', type: 'text' },
      { key: 'assigned', label: 'Assigned', type: 'number' },
      { key: 'inProgress', label: 'In progress', type: 'number' },
      { key: 'open', label: 'Open total', type: 'number' },
      { key: 'flag', label: '', type: 'text' },
    ],
    list.map((l) => ({ ...l, flag: overloaded.includes(l) ? 'Overloaded' : null })),
  )
}

/* ---------- 5. reschedules ---------- */
async function reschedules(tech: Tech | null, range: Range): Promise<QueryResult> {
  const events =
    check(
      await db()
        .from('order_events')
        .select('created_at, actor_name, details, order:orders(order_no, customer_name, technician_id)')
        .eq('action', 'rescheduled')
        .gte('created_at', range.fromIso)
        .lt('created_at', range.toIsoExclusive)
        .order('created_at'),
      'load reschedules',
    ) ?? []
  const rows = events
    .map((e) => {
      const d = (e.details ?? {}) as Row
      const o = one(e.order)
      return {
        techId: Number(d.technicianId ?? o?.technician_id),
        orderNo: String(o?.order_no ?? ''),
        customer: String(o?.customer_name ?? ''),
        technician: String(d.technician ?? e.actor_name),
        reason: d.reason ? String(d.reason) : null,
        newDate: d.newDate ? String(d.newDate) : null,
        at: String(e.created_at),
      }
    })
    .filter((r) => !tech || r.techId === tech.id)
    .map(({ techId: _techId, ...r }) => r)
  const byTech: Record<string, number> = {}
  for (const r of rows) byTech[r.technician] = (byTech[r.technician] ?? 0) + 1
  return result(
    'reschedules',
    { technician: tech?.name ?? null, period: range.period },
    `Rescheduled visits${tech ? ` by ${tech.name}` : ''}, ${range.label}`,
    range,
    { count: rows.length, ...Object.fromEntries(Object.entries(byTech).map(([k, v]) => [`by ${k}`, v])) },
    [
      { key: 'orderNo', label: 'Order', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      ...(tech ? [] : [{ key: 'technician', label: 'Technician', type: 'text' as const }]),
      { key: 'reason', label: 'Reason', type: 'text' },
      { key: 'newDate', label: 'New date', type: 'text' },
      { key: 'at', label: 'When', type: 'datetime' },
    ],
    rows,
  )
}

/* ---------- 6. revenue_summary ---------- */
async function revenueSummary(tech: Tech | null, range: Range, techs: Tech[]): Promise<QueryResult> {
  const stats = (await perTechnician(range, techs)).filter((s) => !tech || s.technician === tech.name)
  const sum = (k: 'completed' | 'revenue' | 'extra' | 'collected' | 'notCollected') => stats.reduce((s, r) => s + r[k], 0)
  return result(
    'revenue_summary',
    { technician: tech?.name ?? null, period: range.period },
    `Total amount${tech ? ` for ${tech.name}` : ''}, ${range.label}`,
    range,
    {
      jobsCompleted: sum('completed'),
      totalFinalAmount: money(sum('revenue')),
      totalExtraCharges: money(sum('extra')),
      paymentCollected: money(sum('collected')),
      jobsNotYetPaid: sum('notCollected'),
    },
    [
      { key: 'technician', label: 'Technician', type: 'text' },
      { key: 'completed', label: 'Jobs done', type: 'number' },
      { key: 'revenue', label: 'Final amount', type: 'money' },
      { key: 'extra', label: 'Extra charges', type: 'money' },
      { key: 'collected', label: 'Collected', type: 'money' },
    ],
    stats.sort((a, b) => b.revenue - a.revenue).map(({ technician, completed, revenue, extra, collected }) => ({ technician, completed, revenue, extra, collected })),
  )
}

/* ---------- 7. order_lookup ---------- */
async function orderLookup(orderNo: string | null): Promise<QueryResult> {
  const no = normaliseOrderNo(orderNo)
  if (!no) throw new HTTPException(400, { message: 'Say which order, e.g. ORDER0026.' })
  const r = check(
    await db()
      .from('orders')
      .select('id, order_no, customer_name, service_type, status, quoted_price, created_at, completed_at, reschedule_count, technician:technicians(name), report:job_reports(final_amount, payment_method, payment_amount)')
      .eq('order_no', no)
      .maybeSingle(),
    'look up the order',
  )
  const rep = r ? one(r.report) : null
  const last = r
    ? one(check(await db().from('order_events').select('action, actor_name, created_at').eq('order_id', r.id).order('created_at', { ascending: false }).limit(1), 'load the order history'))
    : null
  const row = r
    ? {
        orderNo: String(r.order_no),
        customer: String(r.customer_name),
        service: String(r.service_type),
        technician: (one(r.technician)?.name as string) ?? 'Unassigned',
        status: String(r.status),
        quoted: Number(r.quoted_price),
        finalAmount: rep ? Number(rep.final_amount) : null,
        payment: rep?.payment_method ? `${String(rep.payment_method)} RM ${Number(rep.payment_amount).toFixed(2)}` : rep ? 'not collected' : null,
        reschedules: Number(r.reschedule_count ?? 0),
        lastAction: last ? `${String(last.action)} by ${String(last.actor_name)}` : null,
        lastActionAt: last ? String(last.created_at) : null,
      }
    : null
  return result(
    'order_lookup',
    { orderNo: no },
    `Order ${no}`,
    null,
    { found: row ? 'yes' : 'no' },
    [
      { key: 'orderNo', label: 'Order', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'service', label: 'Service', type: 'text' },
      { key: 'technician', label: 'Technician', type: 'text' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'quoted', label: 'Quoted', type: 'money' },
      { key: 'finalAmount', label: 'Final', type: 'money' },
      { key: 'payment', label: 'Payment', type: 'text' },
      { key: 'lastAction', label: 'Last action', type: 'text' },
      { key: 'lastActionAt', label: 'At', type: 'datetime' },
    ],
    row ? [row] : [],
  )
}

/* ---------- 8. flagged_jobs ---------- */
const ISSUE_TITLE: Record<FlagIssue, string> = {
  final_over_quote: 'with a final amount much higher than quoted',
  no_photos: 'without photos',
  payment_not_collected: 'with payment not collected',
}

async function flaggedJobs(range: Range, issue: FlagIssue | null): Promise<QueryResult> {
  const rows =
    check(
      await db()
        .from('orders')
        .select('order_no, customer_name, quoted_price, completed_at, technician:technicians(name), report:job_reports(final_amount, extra_charges, payment_method), files:attachments(count)')
        .in('status', DONE)
        .gte('completed_at', range.fromIso)
        .lt('completed_at', range.toIsoExclusive)
        .order('completed_at'),
      'load completed jobs',
    ) ?? []
  const flagged = rows.flatMap((r) => {
    const rep = one(r.report)
    const quoted = Number(r.quoted_price)
    const final = Number(rep?.final_amount ?? 0)
    const reasons: string[] = []
    // "Much higher": final at least 1.5× the quote and RM 100 or more above it.
    if ((!issue || issue === 'final_over_quote') && rep && final >= quoted * 1.5 && final - quoted >= 100)
      reasons.push(`final RM ${final.toFixed(2)} vs quoted RM ${quoted.toFixed(2)}`)
    if ((!issue || issue === 'no_photos') && Number(one(r.files)?.count ?? 0) === 0) reasons.push('no photos')
    if ((!issue || issue === 'payment_not_collected') && rep && !rep.payment_method) reasons.push('payment not collected')
    return reasons.length
      ? [{ orderNo: String(r.order_no), customer: String(r.customer_name), technician: (one(r.technician)?.name as string) ?? null, completedAt: String(r.completed_at), issues: reasons.join('; ') }]
      : []
  })
  const count = (s: string) => flagged.filter((f) => f.issues.includes(s)).length
  return result(
    'flagged_jobs',
    { period: range.period, issue },
    `Completed jobs ${issue ? ISSUE_TITLE[issue] : 'needing attention'}, ${range.label}`,
    range,
    { flaggedJobs: flagged.length, finalMuchHigherThanQuote: count('vs quoted'), noPhotos: count('no photos'), paymentNotCollected: count('payment not collected') },
    [
      { key: 'orderNo', label: 'Order', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'technician', label: 'Technician', type: 'text' },
      { key: 'completedAt', label: 'Done', type: 'datetime' },
      { key: 'issues', label: 'Why', type: 'text' },
    ],
    flagged,
  )
}

/** Default period per query when the question doesn't say. */
const DEFAULT_PERIOD: Partial<Record<QueryName, Period>> = {
  completed_jobs: 'this_week',
  technician_ranking: 'this_week',
  reschedules: 'last_30_days',
  revenue_summary: 'this_month',
  flagged_jobs: 'last_30_days',
}

/** Run the chosen controlled query with validated parameters. */
export async function runQuery(i: Interpretation & { query: QueryName }): Promise<QueryResult> {
  const techs = await technicians()
  const tech = findTech(techs, i.technician)
  if (i.technician && !tech) {
    throw new HTTPException(400, { message: `There's no technician called ${i.technician}. Technicians: ${techs.map((t) => t.name).join(', ')}.` })
  }
  const range = resolvePeriod(i.period ?? DEFAULT_PERIOD[i.query] ?? 'this_week')
  switch (i.query) {
    case 'completed_jobs':
      return completedJobs(tech, range)
    case 'technician_ranking':
      return technicianRanking(i.metric ?? 'completed', range, techs)
    case 'open_jobs':
      return openJobs(tech, i.status)
    case 'technician_workload':
      return technicianWorkload(techs)
    case 'reschedules':
      return reschedules(tech, range)
    case 'revenue_summary':
      return revenueSummary(tech, range, techs)
    case 'order_lookup':
      return orderLookup(i.orderNo)
    case 'flagged_jobs':
      return flaggedJobs(range, i.issue)
  }
}

export async function technicianNames() {
  return (await technicians()).map((t) => t.name)
}
