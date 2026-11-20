import clsx from 'clsx'
import { ArrowLeft, CircleCheck, Lock, MessageCircle, Phone } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ASSIGNABLE_STATUSES, whatsAppLink, type OrderDetail, type OrderEvent } from '../../../shared/orders.ts'
import { FullScreenMessage } from '../../components/FullScreenMessage.tsx'
import { AttachmentGrid } from '../../components/AttachmentGrid.tsx'
import { Fact, OrderFacts } from '../../components/OrderFacts.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { buttonClass, SELECT_CLASS, TEXTAREA_CLASS } from '../../components/styles.ts'
import { Avatar, Button, ButtonLink, Card, HighlightCard, NavyPanel, StatusBadge, StatusDot } from '../../components/ui.tsx'
import { ORDER_STATUSES, STATUS_LABEL } from '../../lib/domain.ts'
import { eventLabel } from '../../lib/events.ts'
import { formatDateTime, formatMoney } from '../../lib/format.ts'
import { technicianJobMessage, useAssignTechnician, useOrder, useTechnicians } from '../../lib/orders.ts'
import { useReviewStep } from '../../lib/review.ts'
import { useSession } from '../../lib/session.tsx'

/** Order detail: progress, customer and job, service report, technician assignment and audit trail. */
export function OrderDetailPage() {
  const { id = '' } = useParams()
  const order = useOrder(id)

  if (order.isPending) return <FullScreenMessage title="Loading order…" />
  if (order.isError) {
    return (
      <>
        <PageHeader title="Order" />
        <Card className="flex flex-col items-start gap-3">
          <p className="text-body-sm text-danger-text">{order.error.message}</p>
          <ButtonLink to="/orders" variant="outline">
            Back to job orders
          </ButtonLink>
        </Card>
      </>
    )
  }

  const o = order.data
  return (
    <>
      <PageHeader
        title={o.orderNo}
        subtitle={`Created ${formatDateTime(o.createdAt)} by ${o.createdBy}`}
        actions={
          <ButtonLink to="/orders" variant="outline">
            <ArrowLeft className="size-5" strokeWidth={1.8} aria-hidden="true" />
            Job orders
          </ButtonLink>
        }
      />

      <div className="grid items-start gap-4 dash:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Progress order={o} />
          <Card>
            <h2 className="mb-5 text-heading font-medium text-ink">Customer and job</h2>
            <OrderFacts order={o} />
          </Card>
          <ServiceReport order={o} />
          {/* Single column: the review step sits right under the report it's about. */}
          <div className="empty:hidden dash:hidden">
            <ReviewActions order={o} />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="hidden dash:block dash:empty:hidden">
            <ReviewActions order={o} />
          </div>
          <Assignment order={o} />
          <Timeline events={o.events} />
        </div>
      </div>
    </>
  )
}

/** Navy panel: where the order sits in the six-step workflow. */
function Progress({ order }: { order: OrderDetail }) {
  const current = ORDER_STATUSES.indexOf(order.status)
  return (
    <NavyPanel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-label text-on-navy-muted">Status</p>
          <p className="mt-1 text-title font-medium">{STATUS_LABEL[order.status]}</p>
        </div>
        <p className="text-body-sm text-on-navy-soft">
          Step {current + 1} of {ORDER_STATUSES.length}
        </p>
      </div>
      <ol className="mt-5 grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6" aria-label="Workflow progress">
        {ORDER_STATUSES.map((s, i) => (
          <li key={s} className="flex flex-col gap-2" aria-current={i === current ? 'step' : undefined}>
            <span
              className={clsx('h-2.5 rounded-full', i < current ? 'bg-success' : i === current ? 'bg-accent' : 'bg-navy-800')}
              aria-hidden="true"
            />
            <span className={clsx('text-caption', i <= current ? 'text-on-navy' : 'text-on-navy-muted')}>
              {STATUS_LABEL[s]}
              <span className="sr-only">{i < current ? ' (done)' : i === current ? ' (current)' : ''}</span>
            </span>
          </li>
        ))}
      </ol>
    </NavyPanel>
  )
}

function ServiceReport({ order }: { order: OrderDetail }) {
  const r = order.report
  return (
    <Card>
      <h2 className="mb-5 text-heading font-medium text-ink">Service report</h2>
      {!r ? (
        <p className="text-body-sm text-ink-muted">
          {order.status === 'in_progress'
            ? 'The technician is working on this job. Their report appears here when they mark it done.'
            : 'Appears here when the technician marks the job done.'}
        </p>
      ) : (
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Fact label="Work done" wide>
            <span className="whitespace-pre-line">{r.workDone}</span>
          </Fact>
          <Fact label="Quoted price">{formatMoney(order.quotedPrice)}</Fact>
          <Fact label="Extra charges">{formatMoney(r.extraCharges)}</Fact>
          <Fact label="Final amount">
            <span className="font-medium">{formatMoney(r.finalAmount)}</span>
          </Fact>
          <Fact label="Payment collected">
            {r.paymentAmount != null
              ? `${formatMoney(r.paymentAmount)}${r.paymentMethod ? ` · ${PAYMENT_LABEL[r.paymentMethod] ?? r.paymentMethod}` : ''}`
              : 'Not recorded'}
          </Fact>
          <Fact label="Technician">{r.technicianName}</Fact>
          <Fact label="Completed">{formatDateTime(r.completedAt)}</Fact>
          {r.remarks && (
            <Fact label="Remarks" wide>
              <span className="whitespace-pre-line">{r.remarks}</span>
            </Fact>
          )}
          {order.attachments.length > 0 && (
            <Fact label={`Files (${order.attachments.length})`} wide>
              <div className="mt-1.5 max-w-md">
                <AttachmentGrid files={order.attachments} />
              </div>
            </Fact>
          )}
        </dl>
      )}
    </Card>
  )
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  ewallet: 'E-wallet',
}

/** Manager / accounts step: review a done job, then close it (manager only). Others see who reviewed it. */
function ReviewActions({ order }: { order: OrderDetail }) {
  const { user } = useSession()
  const step = order.status === 'job_done' ? 'review' : order.status === 'reviewed' ? 'close' : null
  const action = useReviewStep(order.id, step ?? 'review')
  const [note, setNote] = useState('')
  const isManager = user?.role === 'manager'

  if (step && isManager) {
    return (
      <HighlightCard>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            action.mutate({ note: note.trim() || undefined }, { onSuccess: () => setNote('') })
          }}
        >
          <div>
            <h2 className="text-heading font-medium">{step === 'review' ? 'Review this job' : 'Close this order'}</h2>
            <p className="mt-1 text-body-sm text-white/90">
              {step === 'review'
                ? 'Check the work done, charges and photos, then mark it reviewed.'
                : 'Confirm payment and paperwork are in order, then close it.'}
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium">
              Note <span className="font-normal text-white/80">(optional, saved in history)</span>
            </span>
            <textarea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={clsx(TEXTAREA_CLASS, 'min-h-0')}
            />
          </label>
          {action.isError && (
            <p role="alert" className="rounded-input bg-white px-3 py-2 text-caption text-danger-text">
              {action.error.message}
            </p>
          )}
          <Button type="submit" variant="on-accent" className="w-full" disabled={action.isPending}>
            {step === 'review' ? (
              <CircleCheck className="size-5" strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Lock className="size-5" strokeWidth={1.8} aria-hidden="true" />
            )}
            {action.isPending ? 'Saving…' : step === 'review' ? 'Mark reviewed' : 'Close order'}
          </Button>
        </form>
      </HighlightCard>
    )
  }

  if (!order.reviewedAt) return null
  return (
    <Card className="flex flex-col gap-1">
      <h2 className="text-heading font-medium text-ink">Review</h2>
      <p className="text-body-sm text-ink">
        Reviewed by {order.reviewedBy ?? 'manager'} · {formatDateTime(order.reviewedAt)}
      </p>
      {order.closedAt && <p className="text-body-sm text-ink">Closed · {formatDateTime(order.closedAt)}</p>}
    </Card>
  )
}

/** Current technician, contact links and (admin, before work starts) assign / reassign. */
function Assignment({ order }: { order: OrderDetail }) {
  const { user } = useSession()
  const technicians = useTechnicians()
  const assign = useAssignTechnician(order.id)
  const [choice, setChoice] = useState('')
  const tech = order.technician
  const canAssign = user?.role === 'admin' && ASSIGNABLE_STATUSES.includes(order.status)
  const options = technicians.data?.filter((t) => t.active && t.id !== tech?.id) ?? []

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-heading font-medium text-ink">Technician</h2>
      {tech ? (
        <div className="flex items-center gap-3">
          <Avatar name={tech.name} />
          <div className="min-w-0">
            <p className="text-body text-ink">{tech.name}</p>
            <p className="text-caption text-ink-muted">
              {order.assignedAt ? `Assigned ${formatDateTime(order.assignedAt)}` : 'Assigned'}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-body-sm text-ink-muted">No technician assigned yet.</p>
      )}

      {tech && (
        <div className="flex gap-2">
          <a
            href={whatsAppLink(tech.phone, technicianJobMessage(order))}
            target="_blank"
            rel="noreferrer"
            className={buttonClass('outline', 'md', 'flex-1')}
          >
            <MessageCircle className="size-5" strokeWidth={1.8} aria-hidden="true" />
            WhatsApp job details
          </a>
          <a
            href={`tel:+${tech.phone}`}
            aria-label={`Call ${tech.name}`}
            title={`Call ${tech.name}`}
            className={buttonClass('outline', 'icon')}
          >
            <Phone className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </a>
        </div>
      )}

      {canAssign ? (
        <form
          className="flex flex-col gap-3 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (choice) assign.mutate(Number(choice), { onSuccess: () => setChoice('') })
          }}
        >
          <label htmlFor="assign-technician" className="text-label font-medium text-ink">
            {tech ? 'Reassign to' : 'Assign to'}
          </label>
          <select
            id="assign-technician"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Choose a technician</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {assign.isError && (
            <p role="alert" className="text-caption text-danger-text">
              {assign.error.message}
            </p>
          )}
          <Button type="submit" variant="dark" disabled={!choice || assign.isPending}>
            {assign.isPending ? 'Saving…' : tech ? 'Reassign technician' : 'Assign technician'}
          </Button>
        </form>
      ) : (
        user?.role === 'admin' &&
        !ASSIGNABLE_STATUSES.includes(order.status) && (
          <p className="border-t border-line pt-4 text-caption text-ink-muted">
            The technician can't be changed once the job has started.
          </p>
        )
      )}
    </Card>
  )
}

/** Audit trail: who did what, when (assessment: key actions must be traceable). */
function Timeline({ events }: { events: OrderEvent[] }) {
  return (
    <Card>
      <h2 className="mb-4 text-heading font-medium text-ink">History</h2>
      {events.length === 0 ? (
        <p className="text-body-sm text-ink-muted">No activity recorded.</p>
      ) : (
        <ol className="flex flex-col">
          {events.map((e, i) => (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
              {i < events.length - 1 && (
                <span className="absolute top-4 bottom-0 left-[4px] w-px bg-line" aria-hidden="true" />
              )}
              {e.toStatus ? (
                <StatusDot status={e.toStatus} className="relative mt-1.5 shrink-0" />
              ) : (
                <span className="relative mt-1.5 size-2.5 shrink-0 rounded-full bg-line" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-body-sm text-ink">{eventLabel(e)}</p>
                <p className="text-caption text-ink-muted">
                  {e.actorName} · {formatDateTime(e.createdAt)}
                </p>
                {e.toStatus && e.toStatus !== e.fromStatus && (
                  <div className="mt-1.5">
                    <StatusBadge status={e.toStatus} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
