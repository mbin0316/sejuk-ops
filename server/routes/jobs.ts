import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
  MAX_ATTACHMENTS,
  completeJobSchema,
  finalAmount,
  rescheduleSchema,
  uploadRequestSchema,
  type MyJobs,
  type SignedUpload,
  type TechJob,
} from '../../shared/jobs.js'
import type { OrderStatus } from '../../shared/orders.js'
import { requireRole, type AuthEnv, type AuthUser } from '../auth.js'
import { check, db } from '../db.js'
import {
  JOB_FILES_BUCKET,
  LIST_COLUMNS,
  loadOrderDetail,
  orderId,
  parseOr400,
  readJson,
  recordEvent,
  str,
  toListItem,
} from './orders.js'

type Row = Record<string, unknown>

/**
 * Technician portal API. Every route is technician-only and works only on the
 * signed-in technician's own jobs: "only the assigned technician can complete the job".
 */
export const jobRoutes = new Hono<AuthEnv>()
jobRoutes.use('*', requireRole('technician'))

/** The technicians row linked to this Auth0 account (app_metadata.technician → token claim). */
async function myTechnician(user: AuthUser) {
  if (!user.technician) {
    throw new HTTPException(403, { message: "Your account isn't linked to a technician. Ask the admin to set it up." })
  }
  const row = check(
    await db().from('technicians').select('id, name, active').eq('name', user.technician).maybeSingle(),
    'load your technician profile',
  )
  if (!row) throw new HTTPException(403, { message: `No technician named ${user.technician} exists.` })
  return { id: Number(row.id), name: String(row.name) }
}

/** The order, only if it's assigned to this technician (same 404 otherwise, so other orders can't be probed). */
async function myOrder(id: string, technicianId: number) {
  const row = check(
    await db()
      .from('orders')
      .select('id, order_no, status, technician_id, quoted_price, reschedule_count')
      .eq('id', id)
      .maybeSingle(),
    'load the job',
  )
  if (!row || Number(row.technician_id) !== technicianId) throw new HTTPException(404, { message: 'Job not found' })
  return row as Row & { status: OrderStatus }
}

const JOB_COLUMNS = `${LIST_COLUMNS}, problem_description, admin_notes, reschedule_count, assigned_at, started_at`

function toTechJob(r: Row): TechJob {
  return {
    ...toListItem(r),
    problemDescription: String(r.problem_description),
    adminNotes: str(r.admin_notes),
    rescheduleCount: Number(r.reschedule_count ?? 0),
    assignedAt: str(r.assigned_at),
    startedAt: str(r.started_at),
  }
}

/** GET /api/jobs: my active jobs and what I finished in the last 7 days. */
jobRoutes.get('/', async (c) => {
  const me = await myTechnician(c.get('user'))
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const [active, done] = await Promise.all([
    db()
      .from('orders')
      .select(JOB_COLUMNS)
      .eq('technician_id', me.id)
      .in('status', ['assigned', 'in_progress'])
      .order('assigned_at', { ascending: true }),
    db()
      .from('orders')
      .select(JOB_COLUMNS)
      .eq('technician_id', me.id)
      .in('status', ['job_done', 'reviewed', 'closed'])
      .gte('completed_at', weekAgo)
      .order('completed_at', { ascending: false })
      .limit(30),
  ])
  const body: MyJobs = {
    technician: me,
    active: (check(active, 'load your jobs') ?? []).map(toTechJob),
    done: (check(done, 'load your completed jobs') ?? []).map(toTechJob),
  }
  return c.json(body)
})

/** POST /api/jobs/:id/start: Assigned → In progress. */
jobRoutes.post('/:id/start', async (c) => {
  const user = c.get('user')
  const id = orderId(c)
  const me = await myTechnician(user)
  const order = await myOrder(id, me.id)
  if (order.status !== 'assigned') throw new HTTPException(409, { message: 'Only an assigned job can be started.' })

  const updated = check(
    await db()
      .from('orders')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'assigned')
      .eq('technician_id', me.id)
      .select('id')
      .maybeSingle(),
    'start the job',
  )
  if (!updated) throw new HTTPException(409, { message: 'This job changed in the meantime. Refresh and try again.' })

  await recordEvent(id, user, 'technician', 'started', 'assigned', 'in_progress')
  return c.json({ order: await loadOrderDetail(id) })
})

/** POST /api/jobs/:id/reschedule: postpone the visit. Counts towards the KPI; the job goes back to Assigned. */
jobRoutes.post('/:id/reschedule', async (c) => {
  const user = c.get('user')
  const id = orderId(c)
  const input = parseOr400(rescheduleSchema, await readJson(c))
  const me = await myTechnician(user)
  const order = await myOrder(id, me.id)
  if (order.status !== 'assigned' && order.status !== 'in_progress') {
    throw new HTTPException(409, { message: 'Only a job that is not done yet can be rescheduled.' })
  }

  const updated = check(
    await db()
      .from('orders')
      .update({ status: 'assigned', started_at: null, reschedule_count: Number(order.reschedule_count ?? 0) + 1 })
      .eq('id', id)
      .eq('status', order.status)
      .eq('technician_id', me.id)
      .select('id')
      .maybeSingle(),
    'reschedule the job',
  )
  if (!updated) throw new HTTPException(409, { message: 'This job changed in the meantime. Refresh and try again.' })

  await recordEvent(id, user, 'technician', 'rescheduled', order.status, 'assigned', {
    technician: me.name,
    technicianId: me.id,
    reason: input.reason,
    ...(input.newDate ? { newDate: input.newDate } : {}),
  })
  return c.json({ order: await loadOrderDetail(id) })
})

const safeFileName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80) || 'file'

async function attachmentCount(id: string) {
  const { count, error } = await db().from('attachments').select('id', { count: 'exact', head: true }).eq('order_id', id)
  if (error) throw new HTTPException(500, { message: 'Could not count the uploaded files' })
  return count ?? 0
}

/**
 * POST /api/jobs/:id/uploads: one-time signed upload URLs into the private bucket, under the order's folder.
 * The browser sends the file bytes straight to Storage (no secrets; each URL allows one upload to one path),
 * which avoids the serverless request-size limit for photos and videos.
 */
jobRoutes.post('/:id/uploads', async (c) => {
  const id = orderId(c)
  const { files } = parseOr400(uploadRequestSchema, await readJson(c))
  const me = await myTechnician(c.get('user'))
  const order = await myOrder(id, me.id)
  if (order.status !== 'in_progress') throw new HTTPException(409, { message: 'Start the job before uploading files.' })
  if ((await attachmentCount(id)) + files.length > MAX_ATTACHMENTS) {
    throw new HTTPException(400, { message: `Up to ${MAX_ATTACHMENTS} files per job.` })
  }

  const uploads: SignedUpload[] = []
  for (const f of files) {
    const path = `${id}/${randomUUID()}-${safeFileName(f.name)}`
    const { data, error } = await db().storage.from(JOB_FILES_BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      console.error('[storage] signed upload URL failed:', error?.message)
      throw new HTTPException(500, { message: 'Could not prepare the upload' })
    }
    uploads.push({ path, signedUrl: data.signedUrl })
  }
  return c.json({ uploads })
})

/** POST /api/jobs/:id/complete: service completion report. In progress → Job done. */
jobRoutes.post('/:id/complete', async (c) => {
  const user = c.get('user')
  const id = orderId(c)
  const input = parseOr400(completeJobSchema, await readJson(c))
  const me = await myTechnician(user)
  const order = await myOrder(id, me.id)
  if (order.status !== 'in_progress') throw new HTTPException(409, { message: 'Only a job in progress can be marked done.' })

  // Every file must be in this order's folder and actually uploaded.
  const paths = input.attachments.map((a) => a.path)
  if (new Set(paths).size !== paths.length || paths.some((p) => !p.startsWith(`${id}/`) || p.slice(id.length + 1).includes('/'))) {
    throw new HTTPException(400, { message: 'Invalid file reference' })
  }
  if ((await attachmentCount(id)) + paths.length > MAX_ATTACHMENTS) {
    throw new HTTPException(400, { message: `Up to ${MAX_ATTACHMENTS} files per job.` })
  }
  if (paths.length) {
    const { data: stored, error } = await db().storage.from(JOB_FILES_BUCKET).list(id, { limit: 100 })
    if (error) throw new HTTPException(500, { message: 'Could not check the uploaded files' })
    const names = new Set((stored ?? []).map((o) => `${id}/${o.name}`))
    const missing = input.attachments.find((a) => !names.has(a.path))
    if (missing) throw new HTTPException(400, { message: `"${missing.name}" didn't finish uploading. Remove it and try again.` })
  }

  const quoted = Number(order.quoted_price)
  const final = finalAmount(quoted, input.extraCharges)
  const completedAt = new Date().toISOString()

  const report = await db().from('job_reports').insert({
    order_id: id,
    technician_id: me.id,
    technician_name: me.name,
    work_done: input.workDone,
    extra_charges: input.extraCharges,
    final_amount: final,
    remarks: input.remarks || null,
    payment_method: input.paymentMethod,
    payment_amount: input.paymentMethod ? input.paymentAmount : null,
    completed_at: completedAt,
  })
  if (report.error) {
    if (report.error.code === '23505') throw new HTTPException(409, { message: 'This job already has a service report.' })
    check(report, 'save the service report')
  }

  if (input.attachments.length) {
    const files = await db()
      .from('attachments')
      .insert(
        input.attachments.map((a) => ({
          order_id: id,
          kind: 'job',
          storage_path: a.path,
          file_name: a.name,
          mime_type: a.type,
          size_bytes: a.size,
          uploaded_by: me.name,
        })),
      )
    if (files.error) {
      await db().from('job_reports').delete().eq('order_id', id)
      check(files, 'save the uploaded files')
    }
  }

  // Guarded on status, so a job rescheduled a moment ago isn't marked done.
  const updated = check(
    await db()
      .from('orders')
      .update({ status: 'job_done', completed_at: completedAt })
      .eq('id', id)
      .eq('status', 'in_progress')
      .eq('technician_id', me.id)
      .select('id')
      .maybeSingle(),
    'mark the job done',
  )
  if (!updated) {
    await db().from('attachments').delete().in('storage_path', paths)
    await db().from('job_reports').delete().eq('order_id', id)
    throw new HTTPException(409, { message: 'This job changed in the meantime. Refresh and try again.' })
  }

  await recordEvent(id, user, 'technician', 'completed', 'in_progress', 'job_done', {
    finalAmount: final,
    extraCharges: input.extraCharges,
    files: paths.length,
  })
  return c.json({ order: await loadOrderDetail(id) })
})
