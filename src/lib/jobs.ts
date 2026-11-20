// Technician portal data: my jobs, start / reschedule / complete, and file uploads.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ATTACHMENT_TYPES,
  MAX_FILE_BYTES,
  type AttachmentType,
  type CompleteJobInput,
  type MyJobs,
  type RescheduleInput,
  type SignedUpload,
} from '../../shared/jobs.ts'
import type { OrderDetail } from '../../shared/orders.ts'
import { apiFetch } from './api.ts'
import { formatMoney } from './format.ts'
import { orderKeys } from './orders.ts'

export function useMyJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: () => apiFetch<MyJobs>('/jobs'),
    refetchInterval: 60_000,
  })
}

/** After any job action: refresh the job, my list, and the office views. */
function useJobMutation<T>(orderId: string, run: (input: T) => Promise<OrderDetail>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (order) => {
      qc.setQueryData(orderKeys.detail(orderId), order)
      void qc.invalidateQueries({ queryKey: ['jobs'] })
      void qc.invalidateQueries({ queryKey: ['orders', 'list'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

const post = (path: string, body?: unknown) =>
  apiFetch<{ order: OrderDetail }>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.order)

export const useStartJob = (orderId: string) => useJobMutation<void>(orderId, () => post(`/jobs/${orderId}/start`))

export const useRescheduleJob = (orderId: string) =>
  useJobMutation<RescheduleInput>(orderId, (input) => post(`/jobs/${orderId}/reschedule`, input))

export const useCompleteJob = (orderId: string) =>
  useJobMutation<CompleteJobInput>(orderId, (input) => post(`/jobs/${orderId}/complete`, input))

/* ---------- Uploads ---------- */

const EXT_TYPE: Record<string, AttachmentType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
}

/** The file's MIME type if allowed (some phones leave `type` empty for HEIC), else null. */
export function attachmentType(file: File): AttachmentType | null {
  if ((ATTACHMENT_TYPES as readonly string[]).includes(file.type)) return file.type as AttachmentType
  return EXT_TYPE[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? null
}

/** A reason this file can't be uploaded, or null if it's fine. */
export function fileProblem(file: File): string | null {
  if (!attachmentType(file)) return 'Only photos, videos (MP4, MOV) or PDF'
  if (file.size > MAX_FILE_BYTES) return 'Larger than 20 MB'
  if (file.size === 0) return 'The file is empty'
  return null
}

/** Ask the API for one-time signed URLs, then send each file straight to private Storage. */
export async function uploadJobFiles(orderId: string, files: File[]): Promise<{ path: string; error: string | null }[]> {
  const { uploads } = await apiFetch<{ uploads: SignedUpload[] }>(`/jobs/${orderId}/uploads`, {
    method: 'POST',
    body: JSON.stringify({ files: files.map((f) => ({ name: f.name, type: attachmentType(f), size: f.size })) }),
  })
  return Promise.all(
    uploads.map(async ({ path, signedUrl }, i) => {
      try {
        const res = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'content-type': attachmentType(files[i])!, 'x-upsert': 'false' },
          body: files[i],
        })
        return { path, error: res.ok ? null : `Upload failed (${res.status})` }
      } catch {
        return { path, error: 'Upload failed. Check your connection.' }
      }
    }),
  )
}

export const formatBytes = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`

/** WhatsApp message to the customer when the job is done (assessment: WhatsApp trigger on Job Done). */
export function customerDoneMessage(order: OrderDetail) {
  const r = order.report
  return [
    `Hi ${order.customerName}, your aircon service is complete.`,
    `Order: ${order.orderNo} (${order.serviceType})`,
    r && `Work done: ${r.workDone}`,
    r && `Total: ${formatMoney(r.finalAmount)}`,
    r?.technicianName && `Technician: ${r.technicianName}`,
    'Thank you for choosing Sejuk Sejuk Service.',
  ]
    .filter(Boolean)
    .join('\n')
}
