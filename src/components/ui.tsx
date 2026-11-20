// Base components from DESIGN.md §4. Keep every visual decision here so pages stay consistent.
import clsx from 'clsx'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { STATUS_LABEL, STATUS_TONE, TONE_BADGE, TONE_MARK, type OrderStatus, type Tone } from '../lib/domain.ts'
import { initials } from '../lib/format.ts'
import { buttonClass, type ButtonSize, type ButtonVariant } from './styles.ts'

/* ---------- Logo: two rounded squares, offset diagonally ---------- */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={clsx('relative block size-8 shrink-0', className)} aria-hidden="true">
      <span className="absolute top-0 left-0 size-5 rounded-[7px] bg-white" />
      <span className="absolute right-0 bottom-0 size-[18px] rounded-[7px] bg-accent" />
    </span>
  )
}

/* ---------- Buttons (classes in styles.ts) ---------- */
export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: LinkProps & { variant?: ButtonVariant; size?: ButtonSize }) {
  // Utility colours beat the base-layer `a` colours, so buttons keep their own text colour.
  return <Link className={buttonClass(variant, size, className)} {...props} />
}

/** 44×44 outline icon button. `label` is required for screen readers. */
export function IconButton({
  label,
  children,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        'relative inline-flex size-11 shrink-0 items-center justify-center rounded-btn border border-line bg-surface text-ink hover:bg-page',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/* ---------- Surfaces ---------- */
/** White card on the page: radius 16, no border. Padding 20 mobile / 24 desktop. */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={clsx('rounded-card bg-surface p-5 md:p-6', className)} {...props} />
}

/** The one navy panel per screen. */
export function NavyPanel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={clsx('rounded-panel bg-navy-900 p-5 text-on-navy md:p-6', className)} {...props} />
}

/** The one highlight card per screen (accent-strong fill). */
export function HighlightCard({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={clsx('rounded-panel bg-accent-strong p-6 text-white', className)} {...props} />
}

/* ---------- Status ---------- */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-caption font-medium', TONE_BADGE[tone])}>
      {children}
    </span>
  )
}

/** Status badge: colour from STATUS_TONE, always paired with its text label. */
export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}

export function StatusDot({ status, className }: { status: OrderStatus; className?: string }) {
  return <span aria-hidden="true" className={clsx('inline-block size-2.5 rounded-full', TONE_MARK[STATUS_TONE[status]], className)} />
}

/* ---------- People ---------- */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={name}
      className={clsx(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-tint text-label font-medium text-accent-text',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
