import type { ReactNode } from 'react'
import { Card } from './ui.tsx'

/** Temporary card body used until each module is built. */
export function Placeholder({ phase, children }: { phase: string; children?: ReactNode }) {
  return (
    <Card>
      <p className="text-body-sm text-ink-muted">Coming in {phase}.</p>
      {children}
    </Card>
  )
}
