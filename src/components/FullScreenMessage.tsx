import type { ReactNode } from 'react'

/** Centered status message for loading / redirect states. */
export function FullScreenMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span aria-hidden="true" className="size-8 animate-spin rounded-full border-[3px] border-accent-tint border-t-accent" />
        <p className="text-body text-ink-muted">{title}</p>
        {children}
      </div>
    </div>
  )
}
