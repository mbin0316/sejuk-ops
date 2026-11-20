// Class-name helpers shared by components and pages (kept out of .tsx files so Fast Refresh works).
import clsx from 'clsx'

/* ---------- Buttons (DESIGN.md §4) ---------- */
export type ButtonVariant = 'primary' | 'dark' | 'on-accent' | 'outline'
export type ButtonSize = 'md' | 'lg' | 'icon' | 'icon-lg'

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent-strong text-white hover:bg-accent-text',
  dark: 'bg-navy-900 text-white hover:bg-navy-800',
  'on-accent': 'bg-white text-navy-900 hover:bg-page',
  outline: 'border border-line bg-surface text-ink hover:bg-page',
}

const BUTTON_SIZE: Record<ButtonSize, string> = {
  md: 'h-12 px-5 text-body-sm', // desktop CTA, 48px
  lg: 'h-[52px] px-5 text-body', // technician action, 52px
  icon: 'size-12 shrink-0 text-body-sm', // square icon-only button, 48px
  'icon-lg': 'size-[52px] shrink-0 text-body', // square icon-only technician action, 52px
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return clsx(
    'inline-flex items-center justify-center gap-2 rounded-btn font-medium whitespace-nowrap transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    BUTTON_VARIANT[variant],
    BUTTON_SIZE[size],
    className,
  )
}

/* ---------- Form controls: 44px, radius 10, 1px border, white ---------- */
export const CONTROL_CLASS = clsx(
  'w-full rounded-input border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-muted',
  'focus:border-accent-strong focus:outline-2 focus:outline-offset-0 focus:outline-accent-tint',
  'disabled:bg-page disabled:text-ink-muted aria-invalid:border-danger',
)

export const INPUT_CLASS = clsx(CONTROL_CLASS, 'h-11')
export const SELECT_CLASS = clsx(CONTROL_CLASS, 'h-11 pr-9')
export const TEXTAREA_CLASS = clsx(CONTROL_CLASS, 'min-h-28 py-2.5 leading-[22px]')

/** aria props tying a control to its Field's hint or error text. */
export function describedBy(id: string, error?: string, hint?: string) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const
}

