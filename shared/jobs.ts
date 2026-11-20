// Technician portal (Module 2): start, reschedule and complete a job, with up to 6 uploads.
// Shared by the React app and the API so the form and the server apply the same rules.
import { z } from 'zod'
import { money, type OrderListItem } from './orders.js'

export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'ewallet'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  ewallet: 'E-wallet',
}

/** Uploads per job (assessment: up to 6) and per-file size. Types match the private "job-files" bucket. */
export const MAX_ATTACHMENTS = 6
export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
] as const
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number]

const fileName = z.string().trim().min(1).max(200)
const fileType = z.enum(ATTACHMENT_TYPES, { error: 'Only photos (JPG, PNG, WebP, HEIC), videos (MP4, MOV) or PDF' })
const fileSize = z.number().int().positive().max(MAX_FILE_BYTES, 'Each file must be 20 MB or smaller')

/** final = quoted + extra, rounded to sen. The server computes it; the form shows the same number. */
export const finalAmount = (quoted: number, extra: number) => Math.round((quoted + (extra || 0)) * 100) / 100

/** POST /api/jobs/:id/reschedule */
export const rescheduleSchema = z.object({
  reason: z.string().trim().min(1, 'Say why the visit is postponed').max(300, 'Keep the reason under 300 characters'),
  /** New visit date (YYYY-MM-DD), if agreed with the customer. */
  newDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date')
    .optional(),
})
export type RescheduleInput = z.infer<typeof rescheduleSchema>

/** POST /api/jobs/:id/uploads: ask for one-time signed upload URLs. */
export const uploadRequestSchema = z.object({
  files: z
    .array(z.object({ name: fileName, type: fileType, size: fileSize }))
    .min(1, 'Choose at least one file')
    .max(MAX_ATTACHMENTS, `Up to ${MAX_ATTACHMENTS} files`),
})
export type UploadRequest = z.infer<typeof uploadRequestSchema>
export type SignedUpload = { path: string; signedUrl: string }

/** POST /api/jobs/:id/complete: the service completion report. */
export const completeJobSchema = z
  .object({
    workDone: z.string().trim().min(1, 'Describe the work done').max(2000, 'Keep it under 2,000 characters'),
    extraCharges: money('extra charges'),
    remarks: z.string().trim().max(1000, 'Keep remarks under 1,000 characters').optional(),
    paymentMethod: z.enum(PAYMENT_METHODS, { error: 'Choose how the customer paid' }).nullable(),
    paymentAmount: money('amount collected').nullable(),
    attachments: z
      .array(z.object({ path: z.string().min(1).max(300), name: fileName, type: fileType, size: fileSize }))
      .max(MAX_ATTACHMENTS, `Up to ${MAX_ATTACHMENTS} files`),
  })
  .refine((v) => v.paymentMethod == null || v.paymentAmount != null, {
    path: ['paymentAmount'],
    message: 'Enter the amount collected',
  })
export type CompleteJobInput = z.infer<typeof completeJobSchema>

/** A job in the technician's list. */
export type TechJob = OrderListItem & {
  problemDescription: string
  adminNotes: string | null
  rescheduleCount: number
  assignedAt: string | null
  startedAt: string | null
}

export type MyJobs = {
  technician: { id: number; name: string }
  /** Assigned and in progress, oldest assignment first. */
  active: TechJob[]
  /** Marked done in the last 7 days, newest first. */
  done: TechJob[]
}
