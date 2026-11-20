import clsx from 'clsx'
import { ClipboardList, UserRound, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet, ScrollRestoration } from 'react-router'
import { greeting } from '../lib/format.ts'
import { useSession } from '../lib/session.tsx'
import { Avatar } from './ui.tsx'

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/tech/jobs', label: 'Jobs', icon: ClipboardList },
  { to: '/tech/profile', label: 'Profile', icon: UserRound },
]

/**
 * Technician app (DESIGN.md §4 Technician, §5): mobile-first at 390px,
 * greeting header and a navy bottom tab bar pinned 16px from the edges.
 */
export function TechShell() {
  const { user } = useSession()

  return (
    <div className="mx-auto flex min-h-screen max-w-[430px] flex-col gap-3.5 px-4 pt-5 pb-[100px]">
      <header className="flex items-center gap-3 pt-2">
        <Avatar name={user?.name ?? '?'} />
        <div className="min-w-0 flex-1">
          <p className="text-label font-normal text-ink-muted">{greeting()},</p>
          <h1 className="truncate text-title-sm font-medium text-ink">{user?.name}</h1>
        </div>
      </header>

      <Outlet />
      <ScrollRestoration />

      <nav
        aria-label="Technician"
        className="fixed bottom-4 left-1/2 flex w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 justify-between gap-1 rounded-panel bg-navy-900 p-2"
      >
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            className={({ isActive }) =>
              clsx(
                'flex h-[52px] items-center justify-center gap-1.5 rounded-btn text-label font-medium',
                isActive
                  ? 'flex-1 bg-white text-navy-900 hover:text-navy-900'
                  : 'w-[60px] text-on-navy-soft hover:text-on-navy',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                {isActive && <span>{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
