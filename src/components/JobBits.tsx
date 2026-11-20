// Pieces shared by the technician job list and job page (DESIGN.md §4 Technician: next job card).
import { MapPin, MessageSquareText, Navigation, Phone, StickyNote, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatMoney } from '../lib/format.ts'
import { buttonClass } from './styles.ts'

type JobLike = {
  customerAddress: string
  serviceType: string
  quotedPrice: number
  problemDescription: string
  adminNotes: string | null
}

function Row({ icon: Icon, children }: { icon: typeof MapPin; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-ink-muted" strokeWidth={1.8} aria-hidden="true" />
      <div className="min-w-0 text-body text-ink">{children}</div>
    </li>
  )
}

/** Address, service and price, the customer's problem and the admin's notes. */
export function JobFacts({ job }: { job: JobLike }) {
  return (
    <ul className="flex flex-col gap-3">
      <Row icon={MapPin}>
        <span className="sr-only">Address: </span>
        {job.customerAddress}
      </Row>
      <Row icon={Wrench}>
        {job.serviceType} · quoted {formatMoney(job.quotedPrice)}
      </Row>
      <Row icon={MessageSquareText}>
        <span className="sr-only">Problem: </span>
        <span className="text-body-sm whitespace-pre-line text-ink-muted">“{job.problemDescription}”</span>
      </Row>
      {job.adminNotes && (
        <Row icon={StickyNote}>
          <span className="text-body-sm whitespace-pre-line text-ink-muted">
            <span className="font-medium text-ink">Admin note: </span>
            {job.adminNotes}
          </span>
        </Row>
      )}
    </ul>
  )
}

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
const mapsHref = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

/** 52px square Call button. */
export function CallButton({ phone, name }: { phone: string; name: string }) {
  return (
    <a href={telHref(phone)} aria-label={`Call ${name}`} title={`Call ${name}`} className={buttonClass('outline', 'icon-lg')}>
      <Phone className="size-5" strokeWidth={1.8} aria-hidden="true" />
    </a>
  )
}

export function NavigateButton({ address, className }: { address: string; className?: string }) {
  return (
    <a href={mapsHref(address)} target="_blank" rel="noreferrer" className={buttonClass('outline', 'lg', className)}>
      <Navigation className="size-5" strokeWidth={1.8} aria-hidden="true" />
      Navigate
    </a>
  )
}
