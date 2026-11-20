// Manager review: the queue, and the review / close steps.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OrderDetail, ReviewItem, ReviewNoteInput, ReviewQueue } from '../../shared/orders.ts'
import { apiFetch } from './api.ts'
import { orderKeys } from './orders.ts'

export function useReviewQueue() {
  return useQuery({
    queryKey: ['review'],
    queryFn: () => apiFetch<ReviewQueue>('/review'),
    refetchInterval: 60_000,
  })
}

/** `review`: Job done → Reviewed. `close`: Reviewed → Closed. */
export function useReviewStep(orderId: string, step: 'review' | 'close') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ReviewNoteInput) =>
      apiFetch<{ order: OrderDetail }>(`/orders/${orderId}/${step}`, { method: 'POST', body: JSON.stringify(input) }).then(
        (r) => r.order,
      ),
    onSuccess: (order) => {
      qc.setQueryData(orderKeys.detail(orderId), order)
      for (const key of [['review'], ['orders', 'list'], ['dashboard']]) void qc.invalidateQueries({ queryKey: key })
    },
  })
}

export type ReviewFlag = { label: string; tone: 'warning' | 'danger' | 'neutral' }

const HOUR = 3_600_000

/** Things a reviewer should look at before approving (shown as badges in the queue). */
export function reviewFlags(item: ReviewItem, now = Date.now()): ReviewFlag[] {
  const r = item.report
  const flags: ReviewFlag[] = []
  if (!r) return [{ label: 'No service report', tone: 'danger' }]
  if (r.extraCharges > item.quotedPrice) flags.push({ label: 'Extra charges over the quote', tone: 'danger' })
  if (r.paymentMethod == null) flags.push({ label: 'Payment not collected', tone: 'warning' })
  else if (r.paymentAmount != null && Math.abs(r.paymentAmount - r.finalAmount) > 0.005)
    flags.push({ label: 'Collected differs from final amount', tone: 'warning' })
  if (item.status === 'job_done' && item.completedAt && now - new Date(item.completedAt).getTime() > 48 * HOUR)
    flags.push({ label: 'Waiting over 48 hours', tone: 'warning' })
  if (item.rescheduleCount > 0)
    flags.push({ label: `Rescheduled ${item.rescheduleCount}×`, tone: 'neutral' })
  if (item.attachmentCount === 0) flags.push({ label: 'No photos', tone: 'neutral' })
  return flags
}
