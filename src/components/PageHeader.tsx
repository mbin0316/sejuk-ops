import type { ReactNode } from 'react'
import { ROLE_LABEL } from '../lib/domain.ts'
import { formatLongDate } from '../lib/format.ts'
import { useSession } from '../lib/session.tsx'
import { Avatar } from './ui.tsx'

/**
 * Desktop top bar (DESIGN.md §4 Top bar): title + muted subtitle on the left,
 * page controls and the user's avatar on the right. Wraps on small screens.
 */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const { user } = useSession()
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-title font-medium text-ink">{title}</h1>
        <p className="text-body-sm text-ink-muted">{subtitle ?? formatLongDate()}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {actions}
        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-body-sm text-ink">{user.name}</p>
              <p className="text-caption text-ink-muted">{ROLE_LABEL[user.role]}</p>
            </div>
            <Avatar name={user.name} />
          </div>
        )}
      </div>
    </header>
  )
}
