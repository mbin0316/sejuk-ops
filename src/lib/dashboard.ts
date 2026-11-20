import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DashboardData, DashboardRange } from '../../shared/dashboard.ts'
import { apiFetch } from './api.ts'

/** KPI dashboard data. Refreshes every minute while the page is open. */
export function useDashboard(range: DashboardRange) {
  return useQuery({
    queryKey: ['dashboard', range],
    queryFn: () => apiFetch<DashboardData>(`/dashboard?range=${range}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })
}
