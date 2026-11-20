// Form controls (DESIGN.md: inputs 44px, radius 10, 1px border, white). Labels are always visible.
import clsx from 'clsx'
import type { ReactNode } from 'react'

/** Label + control + hint/error. `id` must match the control's id. */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-danger-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Compact select with an inline visible label, for filter bars (DESIGN.md §4 Top bar). */
export function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-input border border-line bg-surface pl-3 focus-within:border-accent-strong">
      <span className="text-label text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 rounded-input bg-transparent pr-2 text-body-sm text-ink focus:outline-none"
      >
        {children}
      </select>
    </label>
  )
}
