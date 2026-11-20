import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { FilterSelect } from '../../components/form.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Avatar, Button, ButtonLink, Card, StatusBadge } from '../../components/ui.tsx'
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from '../../lib/domain.ts'
import { formatDateTime, formatMoney } from '../../lib/format.ts'
import { useOrders, useTechnicians, type OrderFilters } from '../../lib/orders.ts'
import { useSession } from '../../lib/session.tsx'

/** Job order list (admin + manager). Filters live in the URL so Back returns to the same view. */
export function OrdersPage() {
  const { user } = useSession()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const status = (ORDER_STATUSES as readonly string[]).includes(params.get('status') ?? '')
    ? (params.get('status') as OrderStatus)
    : undefined
  const technicianId = Number(params.get('technician')) || undefined
  const q = params.get('q') ?? ''
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)

  // The search box writes to the URL 300ms after typing stops.
  const [search, setSearch] = useState(q)
  useEffect(() => {
    const value = search.trim()
    if (value === q) return
    const t = setTimeout(() => setParam('q', value), 300)
    return () => clearTimeout(t)
  })

  function setParam(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        // A new filter or search starts again at page 1.
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  const filters: OrderFilters = { status, technicianId, q: q || undefined, page }
  const orders = useOrders(filters)
  const rows = orders.data?.orders
  const total = orders.data?.total ?? 0
  const pageSize = orders.data?.pageSize ?? 25
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  // If orders were removed or filters narrowed, don't strand the user past the last page.
  useEffect(() => {
    if (orders.data && !orders.isPlaceholderData && page > pages) setParam('page', pages > 1 ? String(pages) : '')
  })
  const technicians = useTechnicians()
  const hasFilters = Boolean(status || technicianId || q)

  return (
    <>
      <PageHeader
        title="Job orders"
        actions={
          user?.role === 'admin' && (
            <ButtonLink to="/orders/new">
              <Plus className="size-5" strokeWidth={1.8} aria-hidden="true" />
              New order
            </ButtonLink>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-[1_1_280px] sm:max-w-[340px]">
          <span className="sr-only">Search orders</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-ink-muted"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order no., customer or phone"
            className="h-11 w-full rounded-input border border-line bg-surface pr-3 pl-10 text-body-sm text-ink placeholder:text-ink-muted focus:border-accent-strong focus:outline-none"
          />
        </label>
        <FilterSelect label="Status" value={status ?? ''} onChange={(v) => setParam('status', v)}>
          <option value="">All</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Technician"
          value={technicianId ? String(technicianId) : ''}
          onChange={(v) => setParam('technician', v)}
        >
          <option value="">All</option>
          {technicians.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </FilterSelect>
        {hasFilters && (
          <Button variant="outline" className="h-11" onClick={() => {
              setSearch('')
              setParams({}, { replace: true })
            }}>
            <X className="size-4" strokeWidth={1.8} aria-hidden="true" />
            Clear
          </Button>
        )}
        {orders.data && (
          <p className="ml-auto text-body-sm text-ink-muted" aria-live="polite">
            {total > pageSize
              ? `${first === last ? first : `${first}–${last}`} of ${total} orders`
              : `${total} ${total === 1 ? 'order' : 'orders'}`}
          </p>
        )}
      </div>

      <Card className="overflow-hidden p-0 md:p-0">
        {orders.isError ? (
          <div className="flex flex-col items-start gap-3 p-6">
            <p className="text-body-sm text-danger-text">Couldn't load orders: {orders.error.message}</p>
            <Button variant="outline" onClick={() => orders.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="text-caption text-ink-muted">
                  <th scope="col" className="h-11 px-5 font-normal">Order no.</th>
                  <th scope="col" className="px-3 font-normal">Customer</th>
                  <th scope="col" className="px-3 font-normal">Service</th>
                  <th scope="col" className="px-3 font-normal">Technician</th>
                  <th scope="col" className="px-3 font-normal">Status</th>
                  <th scope="col" className="px-3 text-right font-normal">Quoted</th>
                  <th scope="col" className="px-5 font-normal">Created</th>
                </tr>
              </thead>
              <tbody className={orders.isPlaceholderData ? 'opacity-60' : undefined}>
                {orders.isPending &&
                  Array.from({ length: 6 }, (_, i) => (
                    <tr key={i} className="h-[52px] border-t border-line">
                      <td colSpan={7} className="px-5">
                        <div className="h-3 w-full max-w-[640px] animate-pulse rounded-full bg-page" />
                      </td>
                    </tr>
                  ))}
                {rows?.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/orders/${o.id}`)}
                    className="h-[52px] cursor-pointer border-t border-line text-body-sm hover:bg-page"
                  >
                    <td className="px-5 whitespace-nowrap">
                      <Link
                        to={`/orders/${o.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-accent-text hover:text-navy-900"
                      >
                        {o.orderNo}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-ink">{o.customerName}</p>
                      <p className="text-caption text-ink-muted">{o.customerPhone}</p>
                    </td>
                    <td className="px-3 whitespace-nowrap text-ink">{o.serviceType}</td>
                    <td className="px-3 whitespace-nowrap">
                      {o.technician ? (
                        <span className="flex items-center gap-2 text-ink">
                          <Avatar name={o.technician.name} className="size-7 text-caption" />
                          {o.technician.name}
                        </span>
                      ) : (
                        <span className="text-ink-muted">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-3 text-right whitespace-nowrap text-ink tabular-nums">{formatMoney(o.quotedPrice)}</td>
                    <td className="px-5 whitespace-nowrap text-caption text-ink-muted">{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
                {rows?.length === 0 && (
                  <tr className="border-t border-line">
                    <td colSpan={7} className="px-5 py-10 text-center text-body-sm text-ink-muted">
                      {hasFilters ? 'No orders match these filters.' : 'No orders yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!orders.isError && pages > 1 && (
          <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
            <p className="text-body-sm text-ink-muted">
              Page {Math.min(page, pages)} of {pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || orders.isPlaceholderData}
                onClick={() => setParam('page', page - 1 > 1 ? String(page - 1) : '')}
              >
                <ChevronLeft className="size-5" strokeWidth={1.8} aria-hidden="true" />
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page >= pages || orders.isPlaceholderData}
                onClick={() => setParam('page', String(page + 1))}
              >
                Next
                <ChevronRight className="size-5" strokeWidth={1.8} aria-hidden="true" />
              </Button>
            </div>
          </nav>
        )}
      </Card>
    </>
  )
}
