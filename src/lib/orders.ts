// React Query hooks for orders and technicians. All data comes from /api.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateOrderInput, OrderDetail, OrderListItem, OrderStatus, Technician } from '../../shared/orders.ts'
import { apiFetch } from './api.ts'
import { formatMoney } from './format.ts'

export type OrderFilters = { status?: OrderStatus; technicianId?: number; q?: string }

export const orderKeys = {
  all: ['orders'] as const,
  list: (f: OrderFilters) => ['orders', 'list', f] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
}

export function useTechnicians() {
  return useQuery({
    queryKey: ['technicians'],
    queryFn: () => apiFetch<{ technicians: Technician[] }>('/technicians').then((r) => r.technicians),
    staleTime: 5 * 60_000,
  })
}

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.technicianId) params.set('technicianId', String(filters.technicianId))
      if (filters.q) params.set('q', filters.q)
      const qs = params.toString()
      return apiFetch<{ orders: OrderListItem[] }>(`/orders${qs ? `?${qs}` : ''}`).then((r) => r.orders)
    },
    placeholderData: keepPreviousData,
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => apiFetch<{ order: OrderDetail }>(`/orders/${id}`).then((r) => r.order),
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderInput) =>
      apiFetch<{ order: OrderDetail }>('/orders', { method: 'POST', body: JSON.stringify(input) }).then((r) => r.order),
    onSuccess: (order) => {
      qc.setQueryData(orderKeys.detail(order.id), order)
      void qc.invalidateQueries({ queryKey: ['orders', 'list'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useAssignTechnician(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (technicianId: number) =>
      apiFetch<{ order: OrderDetail }>(`/orders/${orderId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ technicianId }),
      }).then((r) => r.order),
    onSuccess: (order) => {
      qc.setQueryData(orderKeys.detail(order.id), order)
      void qc.invalidateQueries({ queryKey: ['orders', 'list'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** WhatsApp message sent from the admin to the assigned technician (assessment bonus). */
export function technicianJobMessage(order: OrderDetail) {
  return [
    `Hi ${order.technician?.name ?? 'there'}, new job ${order.orderNo} has been assigned to you.`,
    `Service: ${order.serviceType}`,
    `Customer: ${order.customerName} (${order.customerPhone})`,
    `Address: ${order.customerAddress}`,
    `Problem: ${order.problemDescription}`,
    `Quoted price: ${formatMoney(order.quotedPrice)}`,
    order.adminNotes ? `Notes: ${order.adminNotes}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}
