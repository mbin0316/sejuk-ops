import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { ROLE_LABEL, type Role } from '../lib/domain.ts'

/** Demo accounts for assessment reviewers. The shared password comes from VITE_DEMO_PASSWORD (not committed). */
const ACCOUNTS: { email: string; role: Role; who: string; tryThis: string }[] = [
  { email: 'admin@sejuk-ops.com', role: 'admin', who: 'Admin', tryThis: 'Create an order, assign a technician, WhatsApp the job' },
  { email: 'manager@sejuk-ops.com', role: 'manager', who: 'Manager', tryThis: 'Dashboard, review and close jobs, AI assistant' },
  { email: 'ali@sejuk-ops.com', role: 'technician', who: 'Ali', tryThis: 'Phone view: start, reschedule, complete with photos' },
  { email: 'john@sejuk-ops.com', role: 'technician', who: 'John', tryThis: 'Technician portal' },
  { email: 'bala@sejuk-ops.com', role: 'technician', who: 'Bala', tryThis: 'Technician portal (the busiest technician)' },
  { email: 'yusoff@sejuk-ops.com', role: 'technician', who: 'Yusoff', tryThis: 'Technician portal' },
]

const PASSWORD = (import.meta.env.VITE_DEMO_PASSWORD as string | undefined)?.trim() || null

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? 'Copied' : `Copy ${label}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      className="flex size-11 shrink-0 items-center justify-center rounded-btn text-ink-muted hover:bg-page hover:text-ink"
    >
      {copied ? (
        <Check className="size-4 text-success-text" strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Copy className="size-4" strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  )
}

export function ReviewerNotice() {
  return (
    <section aria-labelledby="reviewer-heading" className="rounded-card border border-accent-strong/30 bg-accent-tint p-5">
      <h2 id="reviewer-heading" className="text-heading-sm font-medium text-ink">
        For reviewers: demo accounts
      </h2>
      <p className="mt-1 text-body-sm text-ink-muted">
        Click <span className="font-medium text-ink">Sign in</span>, then use any account below. Each role opens its own
        portal. The data is demo data and can be reset.
      </p>

      {PASSWORD && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-input bg-surface py-1 pr-1 pl-3">
          <p className="min-w-0 text-body-sm text-ink">
            <span className="text-ink-muted">Password for all accounts: </span>
            <span className="font-mono font-medium break-all">{PASSWORD}</span>
          </p>
          <CopyButton value={PASSWORD} label="password" />
        </div>
      )}

      <ul className="mt-3 flex flex-col divide-y divide-line rounded-input bg-surface">
        {ACCOUNTS.map((a) => (
          <li key={a.email} className="flex items-center gap-2 py-1.5 pr-1 pl-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-label text-ink">{a.email}</p>
              <p className="text-caption text-ink-muted">
                <span className="font-medium text-ink">{a.role === 'technician' ? `${ROLE_LABEL[a.role]} · ${a.who}` : a.who}</span>
                {' · '}
                {a.tryThis}
              </p>
            </div>
            <CopyButton value={a.email} label={`${a.who} email`} />
          </li>
        ))}
      </ul>
      {!PASSWORD && <p className="mt-3 text-caption text-ink-muted">The password is provided with the submission.</p>}
      <p className="mt-3 text-caption text-ink-muted">
        Tip: the technician portal is built for phones. On a desktop, narrow the window or use the browser's device mode.
      </p>
    </section>
  )
}
