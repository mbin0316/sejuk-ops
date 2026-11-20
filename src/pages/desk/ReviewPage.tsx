import clsx from 'clsx'
import { CircleCheck, Lock, Paperclip } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { PAYMENT_LABEL, type PaymentMethod } from '../../../shared/jobs.ts'
import type { ReviewItem } from '../../../shared/orders.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Avatar, Badge, Button, ButtonLink, Card } from '../../components/ui.tsx'
import { formatDateTime, formatMoney } from '../../lib/format.ts'
import { reviewFlags, useReviewQueue, useReviewStep } from '../../lib/review.ts'

type Tab = 'review' | 'close'

/** Manager / accounts review: approve completed jobs, then close them. */
export function ReviewPage() {
  const queue = useReviewQueue()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'close' ? 'close' : 'review'
  const items = tab === 'review' ? queue.data?.waiting : queue.data?.toClose

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'review', label: 'Waiting for review', count: queue.data?.waiting.length },
    { id: 'close', label: 'Ready to close', count: queue.data?.toClose.length },
  ]

  return (
    <>
      <PageHeader title="Review queue" />

      <div role="tablist" aria-label="Queue" className="mb-4 flex w-fit gap-1 rounded-full border border-line bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'review' ? {} : { tab: t.id }, { replace: true })}
            className={clsx(
              'flex h-10 items-center gap-2 rounded-full px-4 text-body-sm transition-colors',
              tab === t.id ? 'bg-navy-900 font-medium text-white' : 'text-ink hover:bg-page',
            )}
          >
            {t.label}
            {t.count != null && (
              <span
                className={clsx(
                  'min-w-6 rounded-full px-1.5 text-caption tabular-nums',
                  tab === t.id ? 'bg-navy-800 text-white' : 'bg-line text-ink-muted',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {queue.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[180px] animate-pulse rounded-card bg-surface" />
            ))}
          </div>
        ) : queue.isError ? (
          <Card>
            <p role="alert" className="text-body-sm text-danger-text">
              Couldn't load the queue: {queue.error.message}
            </p>
          </Card>
        ) : items && items.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <QueueCard item={item} />
              </li>
            ))}
          </ul>
        ) : (
          <Card className="flex flex-col items-start gap-1">
            <h2 className="text-heading-sm font-medium text-ink">
              {tab === 'review' ? 'Nothing to review' : 'Nothing to close'}
            </h2>
            <p className="text-body-sm text-ink-muted">
              {tab === 'review'
                ? 'Jobs appear here when a technician marks them done.'
                : 'Reviewed jobs appear here until you close them.'}
            </p>
          </Card>
        )}
      </div>
    </>
  )
}

function QueueCard({ item }: { item: ReviewItem }) {
  const step = item.status === 'job_done' ? 'review' : 'close'
  const action = useReviewStep(item.id, step)
  const r = item.report
  const flags = reviewFlags(item)

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-sm text-ink-muted">
            <Link to={`/orders/${item.id}`} className="font-medium">
              {item.orderNo}
            </Link>{' '}
            · {item.serviceType}
          </p>
          <h2 className="mt-0.5 text-heading font-medium text-ink">{item.customerName}</h2>
        </div>
        {item.technician && (
          <div className="flex items-center gap-2.5">
            <Avatar name={item.technician.name} className="size-9 text-caption" />
            <div>
              <p className="text-body-sm text-ink">{item.technician.name}</p>
              <p className="text-caption text-ink-muted">
                {step === 'review'
                  ? `Done ${item.completedAt ? formatDateTime(item.completedAt) : ''}`
                  : `Reviewed ${item.reviewedAt ? formatDateTime(item.reviewedAt) : ''}${item.reviewedBy ? ` by ${item.reviewedBy}` : ''}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {r && (
        <>
          <p className="line-clamp-2 text-body-sm text-ink">{r.workDone}</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-input bg-page px-4 py-3 sm:grid-cols-4">
            <Money label="Quoted" value={formatMoney(item.quotedPrice)} />
            <Money label="Extra charges" value={formatMoney(r.extraCharges)} />
            <Money label="Final amount" value={formatMoney(r.finalAmount)} strong />
            <Money
              label="Collected"
              value={
                r.paymentMethod && r.paymentAmount != null
                  ? `${formatMoney(r.paymentAmount)} · ${PAYMENT_LABEL[r.paymentMethod as PaymentMethod] ?? r.paymentMethod}`
                  : 'Not collected'
              }
            />
          </dl>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-2" aria-label="Things to check">
          {item.attachmentCount > 0 && (
            <li className="flex items-center gap-1 text-caption text-ink-muted">
              <Paperclip className="size-4" strokeWidth={1.8} aria-hidden="true" />
              {item.attachmentCount} {item.attachmentCount === 1 ? 'file' : 'files'}
            </li>
          )}
          {flags.map((f) => (
            <li key={f.label}>
              <Badge tone={f.tone}>{f.label}</Badge>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <ButtonLink to={`/orders/${item.id}`} variant="outline">
            Open order
          </ButtonLink>
          <Button variant={step === 'review' ? 'primary' : 'dark'} disabled={action.isPending} onClick={() => action.mutate({})}>
            {step === 'review' ? (
              <CircleCheck className="size-5" strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Lock className="size-5" strokeWidth={1.8} aria-hidden="true" />
            )}
            {action.isPending ? 'Saving…' : step === 'review' ? 'Mark reviewed' : 'Close order'}
          </Button>
        </div>
      </div>
      {action.isError && (
        <p role="alert" className="text-caption text-danger-text">
          {action.error.message}
        </p>
      )}
    </Card>
  )
}

function Money({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className={clsx('text-body-sm text-ink tabular-nums', strong && 'font-medium')}>{value}</dd>
    </div>
  )
}
