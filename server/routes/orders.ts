import { Hono, type Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import {
  ASSIGNABLE_STATUSES,
  ORDER_STATUSES,
  assignSchema,
  createOrderSchema,
  reviewNoteSchema,
  type Attachment,
  type JobReport,
  type OrderDetail,
  type OrderEvent,
  type OrderListItem,
  type OrderStatus,
  type ReviewItem,
  type ReviewQueue,
  type Technician,
} from '../../shared/orders.js'
import { requireRole, type AuthEnv, type AuthUser, type Role } from '../auth.js'
import { check, db } from '../db.js'

// ---------------------------------------------------------------------------
// Row mapping (snake_case DB → camelCase API)
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>

export const LIST_COLUMNS =
  'id, order_no, customer_name, customer_phone, customer_address, service_type, quoted_price, status, created_at, completed_at, technician:technicians(id, name)'
const DETAIL_COLUMNS = '*, technician:technicians(id, name, phone, active), report:job_reports(*)'

/** PostgREST returns an embedded to-one relation as an object (or occasionally a 1-item array). */
export const one = (v: unknown): Row | null => (Array.isArray(v) ? (v[0] ?? null) : ((v as Row | null) ?? null))
export const str = (v: unknown) => (v == null ? null : String(v))
const num = (v: unknown) => (v == null ? null : Number(v))

export function toListItem(r: Row): OrderListItem {
  const t = one(r.technician)
  return {
    id: String(r.id),
    orderNo: String(r.order_no),
    customerName: String(r.customer_name),
    customerPhone: String(r.customer_phone),
    customerAddress: String(r.customer_address),
    serviceType: r.service_type as OrderListItem['serviceType'],
    quotedPrice: Number(r.quoted_price),
    status: r.status as OrderStatus,
    technician: t ? { id: Number(t.id), name: String(t.name) } : null,
    createdAt: String(r.created_at),
    completedAt: str(r.completed_at),
  }
}

function toTechnician(t: Row): Technician {
  return { id: Number(t.id), name: String(t.name), phone: String(t.phone), active: Boolean(t.active) }
}

function toReport(r: Row | null): JobReport | null {
  if (!r) return null
  return {
    technicianName: String(r.technician_name),
    workDone: String(r.work_done),
    extraCharges: Number(r.extra_charges),
    finalAmount: Number(r.final_amount),
    remarks: str(r.remarks),
    paymentAmount: num(r.payment_amount),
    paymentMethod: str(r.payment_method),
    completedAt: String(r.completed_at),
  }
}

function toEvent(e: Row): OrderEvent {
  return {
    id: Number(e.id),
    action: String(e.action),
    fromStatus: str(e.from_status) as OrderStatus | null,
    toStatus: str(e.to_status) as OrderStatus | null,
    actorName: String(e.actor_name),
    actorRole: String(e.actor_role),
    details: (e.details as Record<string, unknown>) ?? {},
    createdAt: String(e.created_at),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function orderId(c: Context<AuthEnv>) {
  const id = c.req.param('id') ?? ''
  if (!UUID_RE.test(id)) throw new HTTPException(404, { message: 'Order not found' })
  return id
}

export async function readJson(c: Context<AuthEnv>) {
  try {
    return await c.req.json()
  } catch {
    throw new HTTPException(400, { message: 'Request body must be JSON' })
  }
}

/** 400 with the first validation message, plus every message keyed by field for the form. */
export function parseOr400<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const fields: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_'
    fields[key] ??= issue.message
  }
  throw new HTTPException(400, {
    message: result.error.issues[0]?.message ?? 'Invalid request',
    res: Response.json({ error: result.error.issues[0]?.message ?? 'Invalid request', fields }, { status: 400 }),
  })
}

/** Who did it, for the audit trail. */
function actor(user: AuthUser, role: Role) {
  return {
    actor_sub: user.sub,
    actor_name: (role === 'technician' && user.technician) || user.name || user.email || 'Unknown user',
    actor_role: role,
  }
}

export async function recordEvent(
  order: string,
  user: AuthUser,
  role: Role,
  action: string,
  fromStatus: OrderStatus | null,
  toStatus: OrderStatus | null,
  details: Record<string, unknown> = {},
) {
  const { error } = await db()
    .from('order_events')
    .insert({ order_id: order, action, from_status: fromStatus, to_status: toStatus, details, ...actor(user, role) })
  // The action itself already succeeded; don't fail the request, but make the gap visible in logs.
  if (error) console.error(`[audit] failed to record ${action} for ${order}:`, error.message)
}

async function activeTechnician(id: number) {
  const row = check(
    await db().from('technicians').select('id, name, phone, active').eq('id', id).maybeSingle(),
    'load the technician',
  )
  if (!row || !row.active) throw new HTTPException(400, { message: 'Choose an active technician' })
  return toTechnician(row)
}

export const JOB_FILES_BUCKET = 'job-files'

/** Attachment rows with 1-hour signed download links (the bucket is private). */
async function withDownloadUrls(rows: Row[]): Promise<Attachment[]> {
  if (rows.length === 0) return []
  const { data, error } = await db()
    .storage.from(JOB_FILES_BUCKET)
    .createSignedUrls(rows.map((r) => String(r.storage_path)), 3600)
  if (error) console.error('[storage] could not sign download URLs:', error.message)
  const urlByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.file_name),
    type: String(r.mime_type),
    size: Number(r.size_bytes),
    url: urlByPath.get(String(r.storage_path)) ?? null,
    uploadedBy: String(r.uploaded_by),
    createdAt: String(r.created_at),
  }))
}

/** Full order with technician, completion report, files and audit trail, or null. */
export async function loadOrderDetail(id: string): Promise<OrderDetail | null> {
  const row = check(await db().from('orders').select(DETAIL_COLUMNS).eq('id', id).maybeSingle(), 'load the order')
  if (!row) return null
  const [eventsRes, filesRes] = await Promise.all([
    db().from('order_events').select('*').eq('order_id', id).order('created_at').order('id'),
    db().from('attachments').select('*').eq('order_id', id).order('created_at'),
  ])
  const events = check(eventsRes, 'load the order history')
  const attachments = await withDownloadUrls(check(filesRes, 'load the attachments') ?? [])
  const t = one(row.technician)
  return {
    ...toListItem(row),
    problemDescription: String(row.problem_description),
    adminNotes: str(row.admin_notes),
    createdBy: String(row.created_by),
    rescheduleCount: Number(row.reschedule_count ?? 0),
    assignedAt: str(row.assigned_at),
    startedAt: str(row.started_at),
    reviewedAt: str(row.reviewed_at),
    reviewedBy: str(row.reviewed_by),
    closedAt: str(row.closed_at),
    technician: t ? toTechnician(t) : null,
    report: toReport(one(row.report)),
    attachments,
    events: (events ?? []).map(toEvent),
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
export const technicianRoutes = new Hono<AuthEnv>()

/** GET /api/technicians — for the assignment dropdown and filters. */
technicianRoutes.get('/', requireRole('admin', 'manager'), async (c) => {
  const rows = check(await db().from('technicians').select('id, name, phone, active').order('name'), 'load technicians')
  return c.json({ technicians: (rows ?? []).map(toTechnician) })
})

export const orderRoutes = new Hono<AuthEnv>()

const listQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  technicianId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(60).optional(),
})

/** GET /api/orders?status=&technicianId=&q= — newest first. */
orderRoutes.get('/', requireRole('admin', 'manager'), async (c) => {
  const { status, technicianId, q } = parseOr400(listQuery, c.req.query())

  let query = db().from('orders').select(LIST_COLUMNS).order('created_at', { ascending: false }).limit(300)
  if (status) query = query.eq('status', status)
  if (technicianId) query = query.eq('technician_id', technicianId)
  if (q) {
    // Only letters, digits and spaces reach the PostgREST filter string.
    const text = q.replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim()
    const digits = q.replace(/\D/g, '')
    const filters = text ? [`order_no.ilike.*${text}*`, `customer_name.ilike.*${text}*`] : []
    if (digits.length >= 3) filters.push(`customer_phone_digits.like.*${digits}*`)
    if (filters.length === 0) return c.json({ orders: [] })
    query = query.or(filters.join(','))
  }

  const rows = check(await query, 'load orders')
  return c.json({ orders: (rows ?? []).map(toListItem) })
})

/** POST /api/orders — admin creates an order, optionally assigning a technician straight away. */
orderRoutes.post('/', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const input = parseOr400(createOrderSchema, await readJson(c))
  const technician = input.technicianId ? await activeTechnician(input.technicianId) : null
  const now = new Date().toISOString()

  const created = check(
    await db()
      .from('orders')
      .insert({
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        customer_address: input.customerAddress,
        problem_description: input.problemDescription,
        service_type: input.serviceType,
        quoted_price: input.quotedPrice,
        admin_notes: input.adminNotes || null,
        technician_id: technician?.id ?? null,
        status: technician ? 'assigned' : 'new',
        assigned_at: technician ? now : null,
        created_by: actor(user, 'admin').actor_name,
      })
      .select('id, order_no')
      .single(),
    'create the order',
  )
  if (!created) throw new HTTPException(500, { message: 'Could not create the order' })

  await recordEvent(created.id, user, 'admin', 'created', null, 'new', { orderNo: created.order_no })
  if (technician) {
    await recordEvent(created.id, user, 'admin', 'assigned', 'new', 'assigned', { technician: technician.name })
  }

  return c.json({ order: await loadOrderDetail(created.id) }, 201)
})

/** GET /api/orders/:id — admin and manager see any order; a technician only their own. */
orderRoutes.get('/:id', requireRole('admin', 'manager', 'technician'), async (c) => {
  const user = c.get('user')
  const order = await loadOrderDetail(orderId(c))
  const isOffice = user.roles.includes('admin') || user.roles.includes('manager')
  // Same 404 for "doesn't exist" and "not yours", so technicians can't probe other orders.
  if (!order || (!isOffice && (!user.technician || order.technician?.name !== user.technician))) {
    throw new HTTPException(404, { message: 'Order not found' })
  }
  return c.json({ order })
})

/** POST /api/orders/:id/assign — only the admin assigns, and only before work starts. */
orderRoutes.post('/:id/assign', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = orderId(c)
  const { technicianId } = parseOr400(assignSchema, await readJson(c))
  const technician = await activeTechnician(technicianId)

  const current = check(
    await db().from('orders').select('status, technician:technicians(id, name)').eq('id', id).maybeSingle(),
    'load the order',
  )
  if (!current) throw new HTTPException(404, { message: 'Order not found' })
  const status = current.status as OrderStatus
  const previous = one(current.technician)
  if (!ASSIGNABLE_STATUSES.includes(status)) {
    throw new HTTPException(409, { message: 'The technician can only be changed before the job starts.' })
  }
  if (previous && Number(previous.id) === technician.id) {
    return c.json({ order: await loadOrderDetail(id) })
  }

  // Guard on status again in the UPDATE, so a job that started a moment ago isn't reassigned.
  const updated = check(
    await db()
      .from('orders')
      .update({ technician_id: technician.id, status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('id', id)
      .in('status', ASSIGNABLE_STATUSES)
      .select('id')
      .maybeSingle(),
    'assign the technician',
  )
  if (!updated) throw new HTTPException(409, { message: 'The job has just started, so the technician can no longer be changed.' })

  await recordEvent(id, user, 'admin', previous ? 'reassigned' : 'assigned', status, 'assigned', {
    technician: technician.name,
    ...(previous ? { previousTechnician: String(previous.name) } : {}),
  })

  return c.json({ order: await loadOrderDetail(id) })
})

// ---------------------------------------------------------------------------
// Manager review (Module: Manager / Accounts Review)
// ---------------------------------------------------------------------------

/** Move an order one step (job_done → reviewed, reviewed → closed), guarded on the current status. */
async function advance(
  c: Context<AuthEnv>,
  from: OrderStatus,
  to: OrderStatus,
  action: string,
  fields: Record<string, unknown>,
  wrongStatus: string,
) {
  const user = c.get('user')
  const id = orderId(c)
  const { note } = parseOr400(reviewNoteSchema, await readJson(c))
  const current = check(await db().from('orders').select('status').eq('id', id).maybeSingle(), 'load the order')
  if (!current) throw new HTTPException(404, { message: 'Order not found' })
  if (current.status !== from) throw new HTTPException(409, { message: wrongStatus })

  const updated = check(
    await db().from('orders').update(fields).eq('id', id).eq('status', from).select('id').maybeSingle(),
    `mark the order ${to}`,
  )
  if (!updated) throw new HTTPException(409, { message: 'This order changed in the meantime. Refresh and try again.' })

  await recordEvent(id, user, 'manager', action, from, to, note ? { note } : {})
  return c.json({ order: await loadOrderDetail(id) })
}

/** POST /api/orders/:id/review: the manager checks the service report. Job done → Reviewed. */
orderRoutes.post('/:id/review', requireRole('manager'), (c) =>
  advance(
    c,
    'job_done',
    'reviewed',
    'reviewed',
    { status: 'reviewed', reviewed_at: new Date().toISOString(), reviewed_by: actor(c.get('user'), 'manager').actor_name },
    'Only a job marked done can be reviewed.',
  ),
)

/** POST /api/orders/:id/close: after review (payment and paperwork checked). Reviewed → Closed. */
orderRoutes.post('/:id/close', requireRole('manager'), (c) =>
  advance(c, 'reviewed', 'closed', 'closed', { status: 'closed', closed_at: new Date().toISOString() }, 'Only a reviewed job can be closed.'),
)

const REVIEW_COLUMNS = `${LIST_COLUMNS}, reschedule_count, reviewed_at, reviewed_by, report:job_reports(*), files:attachments(count)`

function toReviewItem(r: Row): ReviewItem {
  const files = one(r.files)
  return {
    ...toListItem(r),
    rescheduleCount: Number(r.reschedule_count ?? 0),
    reviewedAt: str(r.reviewed_at),
    reviewedBy: str(r.reviewed_by),
    report: toReport(one(r.report)),
    attachmentCount: Number(files?.count ?? 0),
  }
}

export const reviewRoutes = new Hono<AuthEnv>()

/** GET /api/review: jobs waiting for review and reviewed jobs waiting to be closed. */
reviewRoutes.get('/', requireRole('manager'), async (c) => {
  const [waiting, toClose] = await Promise.all([
    db().from('orders').select(REVIEW_COLUMNS).eq('status', 'job_done').order('completed_at', { ascending: true }).limit(200),
    db().from('orders').select(REVIEW_COLUMNS).eq('status', 'reviewed').order('reviewed_at', { ascending: true }).limit(200),
  ])
  const body: ReviewQueue = {
    waiting: (check(waiting, 'load the review queue') ?? []).map(toReviewItem),
    toClose: (check(toClose, 'load reviewed jobs') ?? []).map(toReviewItem),
  }
  return c.json(body)
})
