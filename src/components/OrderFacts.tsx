import type { ReactNode } from 'react'
import type { OrderDetail } from '../../shared/orders.ts'
import { formatMoney } from '../lib/format.ts'

/** Two-column definition list of an order's customer and job details. */
export function OrderFacts({ order }: { order: OrderDetail }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      <Fact label="Customer">{order.customerName}</Fact>
      <Fact label="Phone">
        <a href={`tel:${order.customerPhone.replace(/[^\d+]/g, '')}`}>{order.customerPhone}</a>
      </Fact>
      <Fact label="Service address" wide>
        {order.customerAddress}
      </Fact>
      <Fact label="Service type">{order.serviceType}</Fact>
      <Fact label="Quoted price">{formatMoney(order.quotedPrice)}</Fact>
      <Fact label="Problem description" wide>
        <span className="whitespace-pre-line">{order.problemDescription}</span>
      </Fact>
      <Fact label="Admin notes" wide>
        {order.adminNotes ? (
          <span className="whitespace-pre-line">{order.adminNotes}</span>
        ) : (
          <span className="text-ink-muted">None</span>
        )}
      </Fact>
    </dl>
  )
}

export function Fact({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-body-sm text-ink">{children}</dd>
    </div>
  )
}
