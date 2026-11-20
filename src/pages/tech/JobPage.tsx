import clsx from 'clsx'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CalendarClock, CircleCheck, FileText, MessageCircle, Paperclip, Play, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { z } from 'zod'
import {
  MAX_ATTACHMENTS,
  PAYMENT_LABEL,
  PAYMENT_METHODS,
  finalAmount,
  type CompleteJobInput,
  type PaymentMethod,
} from '../../../shared/jobs.ts'
import { money, whatsAppLink, type OrderDetail } from '../../../shared/orders.ts'
import { AttachmentGrid } from '../../components/AttachmentGrid.tsx'
import { Field } from '../../components/form.tsx'
import { CallButton, JobFacts, NavigateButton } from '../../components/JobBits.tsx'
import { buttonClass, describedBy, INPUT_CLASS, SELECT_CLASS, TEXTAREA_CLASS } from '../../components/styles.ts'
import { Button, Card, HighlightCard, StatusBadge } from '../../components/ui.tsx'
import { ApiError } from '../../lib/api.ts'
import { formatDateTime, formatMoney, klDayKey } from '../../lib/format.ts'
import {
  attachmentType,
  customerDoneMessage,
  fileProblem,
  formatBytes,
  uploadJobFiles,
  useCompleteJob,
  useRescheduleJob,
  useStartJob,
} from '../../lib/jobs.ts'
import { useOrder } from '../../lib/orders.ts'

/** One job: details, Start, Reschedule, and the service completion form (Module 2). */
export function JobPage() {
  const { id = '' } = useParams()
  const order = useOrder(id)

  return (
    <>
      <Link to="/tech/jobs" className="flex h-11 w-fit items-center gap-2 text-body-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-5" strokeWidth={1.8} aria-hidden="true" />
        All jobs
      </Link>
      {order.isPending ? (
        <div className="h-[320px] animate-pulse rounded-card bg-surface" aria-busy="true">
          <span className="sr-only" role="status">
            Loading job…
          </span>
        </div>
      ) : order.isError ? (
        <Card>
          <p role="alert" className="text-body-sm text-danger-text">
            {order.error.message}
          </p>
        </Card>
      ) : (
        <JobBody order={order.data} />
      )}
    </>
  )
}

function JobBody({ order }: { order: OrderDetail }) {
  const [rescheduling, setRescheduling] = useState(false)
  const open = order.status === 'assigned' || order.status === 'in_progress'

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-body-sm text-ink-muted">{order.orderNo}</p>
          <StatusBadge status={order.status} />
        </div>
        <div>
          <h2 className="text-heading font-medium text-ink">{order.customerName}</h2>
          <p className="text-body-sm text-ink-muted">{order.customerPhone}</p>
        </div>
        <JobFacts job={order} />
        {order.rescheduleCount > 0 && (
          <p className="flex items-center gap-2 text-caption text-ink-muted">
            <CalendarClock className="size-4" strokeWidth={1.8} aria-hidden="true" />
            Rescheduled {order.rescheduleCount} {order.rescheduleCount === 1 ? 'time' : 'times'}
          </p>
        )}
        <div className="flex gap-2.5">
          <CallButton phone={order.customerPhone} name={order.customerName} />
          <NavigateButton address={order.customerAddress} className="flex-1" />
        </div>
      </Card>

      {order.status === 'assigned' && !rescheduling && <StartCard order={order} />}
      {order.status === 'in_progress' && !rescheduling && <CompleteForm order={order} />}
      {open &&
        (rescheduling ? (
          <RescheduleForm order={order} onClose={() => setRescheduling(false)} />
        ) : (
          <Button variant="outline" size="lg" className="w-full" onClick={() => setRescheduling(true)}>
            <RotateCcw className="size-5" strokeWidth={1.8} aria-hidden="true" />
            Reschedule visit
          </Button>
        ))}
      {!open && <DoneView order={order} />}
    </>
  )
}

function StartCard({ order }: { order: OrderDetail }) {
  const start = useStartJob(order.id)
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-body-sm text-ink-muted">Start the job when you arrive. Then you can fill in the service report.</p>
      {start.isError && (
        <p role="alert" className="text-caption text-danger-text">
          {start.error.message}
        </p>
      )}
      <Button size="lg" className="w-full" disabled={start.isPending} onClick={() => start.mutate()}>
        <Play className="size-5" strokeWidth={1.8} aria-hidden="true" />
        {start.isPending ? 'Starting…' : 'Start job'}
      </Button>
    </Card>
  )
}

/* ------------------------------------------------------------------------ */
/* Reschedule                                                               */
/* ------------------------------------------------------------------------ */

const QUICK_REASONS = ['Customer not home', 'Customer asked for another day', 'Parts needed', 'Ran out of time']

function RescheduleForm({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const reschedule = useRescheduleJob(order.id)
  const [reason, setReason] = useState('')
  const [newDate, setNewDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <Card>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!reason.trim()) return setError('Say why the visit is postponed')
          setError(null)
          reschedule.mutate({ reason: reason.trim(), newDate: newDate || undefined }, { onSuccess: onClose })
        }}
      >
        <div>
          <h2 className="text-heading-sm font-medium text-ink">Reschedule visit</h2>
          <p className="mt-1 text-body-sm text-ink-muted">
            The job goes back to Assigned and the admin sees the reason in its history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reason === r}
              onClick={() => setReason(r)}
              className={clsx(
                'min-h-11 rounded-full border px-4 text-body-sm transition-colors',
                reason === r ? 'border-accent-strong bg-accent-tint text-accent-text' : 'border-line bg-surface text-ink',
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Field id="reschedule-reason" label="Reason" error={error ?? undefined}>
          <textarea
            id="reschedule-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            {...describedBy('reschedule-reason', error ?? undefined)}
          />
        </Field>
        <Field id="reschedule-date" label="New visit date" optional>
          <input
            id="reschedule-date"
            type="date"
            min={klDayKey()}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        {reschedule.isError && (
          <p role="alert" className="text-caption text-danger-text">
            {reschedule.error.message}
          </p>
        )}
        <div className="flex gap-2.5">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="dark" size="lg" className="flex-1" disabled={reschedule.isPending}>
            {reschedule.isPending ? 'Saving…' : 'Reschedule'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

/* ------------------------------------------------------------------------ */
/* Service completion form                                                  */
/* ------------------------------------------------------------------------ */

const formSchema = z
  .object({
    workDone: z.string().trim().min(1, 'Describe the work done').max(2000, 'Keep it under 2,000 characters'),
    extraCharges: money('extra charges'),
    remarks: z.string().trim().max(1000, 'Keep remarks under 1,000 characters'),
    paymentMethod: z.union([z.enum(PAYMENT_METHODS), z.literal('')]),
    paymentAmount: z.number().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.paymentMethod) return
    const r = money('amount collected').safeParse(v.paymentAmount)
    if (!r.success) ctx.addIssue({ code: 'custom', path: ['paymentAmount'], message: r.error.issues[0].message })
  })
type FormInput = z.input<typeof formSchema>
type FormValues = z.output<typeof formSchema>

type Upload = {
  key: string
  file: File
  preview: string | null
  status: 'uploading' | 'done' | 'error'
  path?: string
  error?: string
}

function CompleteForm({ order }: { order: OrderDetail }) {
  const complete = useCompleteJob(order.id)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [pickError, setPickError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [paymentTouched, setPaymentTouched] = useState(false)
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { workDone: '', extraCharges: 0, remarks: '', paymentMethod: '', paymentAmount: undefined },
  })

  const extra = useWatch({ control, name: 'extraCharges' })
  const method = useWatch({ control, name: 'paymentMethod' })
  const extraNum = typeof extra === 'number' && Number.isFinite(extra) ? extra : 0
  const final = finalAmount(order.quotedPrice, extraNum)

  // Until the technician edits it, the amount collected follows the final amount.
  useEffect(() => {
    if (method && !paymentTouched) setValue('paymentAmount', final)
  }, [final, method, paymentTouched, setValue])

  // Free preview URLs when the form goes away.
  const uploadsRef = useRef(uploads)
  useEffect(() => {
    uploadsRef.current = uploads
  }, [uploads])
  useEffect(() => () => uploadsRef.current.forEach((u) => u.preview && URL.revokeObjectURL(u.preview)), [])

  const slotsLeft = MAX_ATTACHMENTS - order.attachments.length - uploads.length
  const uploading = uploads.some((u) => u.status === 'uploading')

  async function addFiles(list: FileList | null) {
    setPickError(null)
    const files = [...(list ?? [])]
    if (fileInput.current) fileInput.current.value = ''
    if (!files.length) return
    if (files.length > slotsLeft) {
      setPickError(`You can add ${slotsLeft} more ${slotsLeft === 1 ? 'file' : 'files'} (up to ${MAX_ATTACHMENTS} per job).`)
      return
    }
    const bad = files.map((f) => [f, fileProblem(f)] as const).find(([, p]) => p)
    if (bad) {
      setPickError(`${bad[0].name}: ${bad[1]}`)
      return
    }

    const batch: Upload[] = files.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: attachmentType(file)?.startsWith('image/') ? URL.createObjectURL(file) : null,
      status: 'uploading',
    }))
    setUploads((u) => [...u, ...batch])
    const patch = (key: string, p: Partial<Upload>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...p } : x)))
    try {
      const results = await uploadJobFiles(order.id, files)
      results.forEach((r, i) =>
        patch(batch[i].key, r.error ? { status: 'error', error: r.error } : { status: 'done', path: r.path }),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      batch.forEach((b) => patch(b.key, { status: 'error', error: message }))
    }
  }

  function removeUpload(key: string) {
    setUploads((u) => {
      const gone = u.find((x) => x.key === key)
      if (gone?.preview) URL.revokeObjectURL(gone.preview)
      return u.filter((x) => x.key !== key)
    })
  }

  const onSubmit = handleSubmit((v) => {
    const input: CompleteJobInput = {
      workDone: v.workDone,
      extraCharges: v.extraCharges,
      remarks: v.remarks || undefined,
      paymentMethod: (v.paymentMethod || null) as PaymentMethod | null,
      paymentAmount: v.paymentMethod ? (v.paymentAmount ?? null) : null,
      attachments: uploads
        .filter((u) => u.status === 'done' && u.path)
        .map((u) => ({ path: u.path!, name: u.file.name, type: attachmentType(u.file)!, size: u.file.size })),
    }
    complete.mutate(input, {
      onSuccess: () => window.scrollTo({ top: 0 }),
      onError: (err) => {
        if (err instanceof ApiError) {
          for (const [field, message] of Object.entries(err.fields)) {
            if (field in v) setError(field as keyof FormInput, { message })
          }
        }
      },
    })
  })

  const err = (k: keyof FormInput) => errors[k]?.message

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div>
          <h2 className="text-heading-sm font-medium text-ink">Service report</h2>
          <p className="mt-1 text-body-sm text-ink-muted">Fill this in when the work is finished.</p>
        </div>

        <Field id="workDone" label="Work done" error={err('workDone')}>
          <textarea
            id="workDone"
            rows={4}
            placeholder="e.g. Cleaned filters and coil, cleared drain pipe, tested cooling"
            className={TEXTAREA_CLASS}
            {...describedBy('workDone', err('workDone'))}
            {...register('workDone')}
          />
        </Field>

        <Field id="extraCharges" label="Extra charges" hint="Parts or labour on top of the quote. 0 if none." error={err('extraCharges')}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body-sm text-ink-muted">RM</span>
            <input
              id="extraCharges"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className={clsx(INPUT_CLASS, 'h-[52px] pl-11 tabular-nums')}
              {...describedBy('extraCharges', err('extraCharges'), 'hint')}
              {...register('extraCharges', { valueAsNumber: true })}
            />
          </div>
        </Field>

        <div className="rounded-input bg-page px-4 py-3" aria-live="polite">
          <div className="flex justify-between text-body-sm text-ink-muted">
            <span>Quoted price</span>
            <span className="tabular-nums">{formatMoney(order.quotedPrice)}</span>
          </div>
          <div className="flex justify-between text-body-sm text-ink-muted">
            <span>Extra charges</span>
            <span className="tabular-nums">{formatMoney(extraNum)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-body font-medium text-ink">
            <span>Final amount</span>
            <span className="tabular-nums">{formatMoney(final)}</span>
          </div>
        </div>

        <Field id="remarks" label="Remarks" optional error={err('remarks')}>
          <textarea
            id="remarks"
            rows={2}
            placeholder="Anything the office should know"
            className={TEXTAREA_CLASS}
            {...describedBy('remarks', err('remarks'))}
            {...register('remarks')}
          />
        </Field>

        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-label font-medium text-ink">Payment</legend>
          <Field id="paymentMethod" label="Method" error={err('paymentMethod')}>
            <select id="paymentMethod" className={clsx(SELECT_CLASS, 'h-[52px]')} {...register('paymentMethod')}>
              <option value="">Not collected</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="paymentAmount" label="Amount" error={err('paymentAmount')}>
            <input
              id="paymentAmount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              disabled={!method}
              placeholder={method ? '0.00' : '–'}
              className={clsx(INPUT_CLASS, 'h-[52px] tabular-nums')}
              {...describedBy('paymentAmount', err('paymentAmount'))}
              {...register('paymentAmount', {
                setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
                onChange: () => setPaymentTouched(true),
              })}
            />
          </Field>
        </fieldset>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <p className="text-label font-medium text-ink">Photos, videos or PDF</p>
            <p className="text-caption text-ink-muted">
              {order.attachments.length + uploads.length} of {MAX_ATTACHMENTS}
            </p>
          </div>
          {uploads.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {uploads.map((u) => (
                <li key={u.key} className="relative overflow-hidden rounded-input border border-line bg-page">
                  <div className="flex aspect-square items-center justify-center">
                    {u.preview ? (
                      <img src={u.preview} alt="" className={clsx('size-full object-cover', u.status === 'uploading' && 'opacity-50')} />
                    ) : (
                      <FileText className="size-8 text-ink-muted" strokeWidth={1.8} aria-hidden="true" />
                    )}
                  </div>
                  <p className="truncate px-2 pt-1 text-caption text-ink">{u.file.name}</p>
                  <p
                    className={clsx('px-2 pb-1.5 text-caption', u.status === 'error' ? 'text-danger-text' : 'text-ink-muted')}
                    role={u.status === 'error' ? 'alert' : undefined}
                  >
                    {u.status === 'uploading' ? 'Uploading…' : u.status === 'error' ? u.error : formatBytes(u.file.size)}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeUpload(u.key)}
                    aria-label={`Remove ${u.file.name}`}
                    className="absolute top-1 right-1 flex size-11 items-start justify-end p-1"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-navy-900 text-white">
                      <X className="size-4" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pickError && (
            <p role="alert" className="text-caption text-danger-text">
              {pickError}
            </p>
          )}
          <input
            ref={fileInput}
            id="job-files"
            type="file"
            multiple
            accept="image/*,video/mp4,video/quicktime,application/pdf"
            className="sr-only"
            onChange={(e) => void addFiles(e.target.files)}
            disabled={slotsLeft <= 0}
          />
          <label
            htmlFor="job-files"
            className={clsx(
              buttonClass('outline', 'lg', 'w-full cursor-pointer'),
              slotsLeft <= 0 && 'pointer-events-none opacity-50',
            )}
          >
            <Paperclip className="size-5" strokeWidth={1.8} aria-hidden="true" />
            {slotsLeft <= 0 ? 'File limit reached' : 'Add files'}
          </label>
        </div>

        {complete.isError && !(complete.error instanceof ApiError && Object.keys(complete.error.fields).length) && (
          <p role="alert" className="rounded-input bg-danger-tint px-3 py-2 text-body-sm text-danger-text">
            Couldn't save the report: {complete.error.message}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={complete.isPending || uploading}>
          <CircleCheck className="size-5" strokeWidth={1.8} aria-hidden="true" />
          {complete.isPending ? 'Saving…' : uploading ? 'Waiting for uploads…' : 'Mark job done'}
        </Button>
      </form>
    </Card>
  )
}

/* ------------------------------------------------------------------------ */
/* After completion                                                          */
/* ------------------------------------------------------------------------ */

function DoneView({ order }: { order: OrderDetail }) {
  const r = order.report
  return (
    <>
      {order.status === 'job_done' && (
        <HighlightCard className="flex flex-col gap-4" aria-live="polite">
          <div>
            <h2 className="text-heading font-medium">Job done</h2>
            <p className="mt-1 text-body-sm text-white/90">Let the customer know their service is complete.</p>
          </div>
          <a
            href={whatsAppLink(order.customerPhone, customerDoneMessage(order))}
            target="_blank"
            rel="noreferrer"
            className={buttonClass('on-accent', 'lg', 'w-full')}
          >
            <MessageCircle className="size-5" strokeWidth={1.8} aria-hidden="true" />
            WhatsApp customer
          </a>
        </HighlightCard>
      )}
      {r && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-heading-sm font-medium text-ink">Service report</h2>
          <dl className="flex flex-col gap-3 text-body-sm">
            <div>
              <dt className="text-caption text-ink-muted">Work done</dt>
              <dd className="whitespace-pre-line text-ink">{r.workDone}</dd>
            </div>
            <div className="rounded-input bg-page px-4 py-3">
              <div className="flex justify-between text-ink-muted">
                <dt>Quoted + extra</dt>
                <dd className="tabular-nums">
                  {formatMoney(order.quotedPrice)} + {formatMoney(r.extraCharges)}
                </dd>
              </div>
              <div className="mt-1 flex justify-between font-medium text-ink">
                <dt>Final amount</dt>
                <dd className="tabular-nums">{formatMoney(r.finalAmount)}</dd>
              </div>
            </div>
            <div>
              <dt className="text-caption text-ink-muted">Payment</dt>
              <dd className="text-ink">
                {r.paymentAmount != null && r.paymentMethod
                  ? `${formatMoney(r.paymentAmount)} · ${PAYMENT_LABEL[r.paymentMethod as PaymentMethod] ?? r.paymentMethod}`
                  : 'Not collected'}
              </dd>
            </div>
            {r.remarks && (
              <div>
                <dt className="text-caption text-ink-muted">Remarks</dt>
                <dd className="whitespace-pre-line text-ink">{r.remarks}</dd>
              </div>
            )}
            <div>
              <dt className="text-caption text-ink-muted">Completed</dt>
              <dd className="text-ink">{formatDateTime(r.completedAt)}</dd>
            </div>
          </dl>
          <AttachmentGrid files={order.attachments} />
        </Card>
      )}
    </>
  )
}
