import clsx from 'clsx'
import {
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  House,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import type { Role } from '../lib/domain.ts'
import { useSession } from '../lib/session.tsx'
import { LogoMark } from './ui.tsx'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  roles: Role[]
  /** Custom "active" rule; defaults to NavLink's prefix match. */
  isActive?: (path: string) => boolean
}

/** One desktop app for admin and manager; each role sees only its own items. */
const NAV: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: House, roles: ['admin', 'manager'] },
  {
    to: '/orders',
    label: 'Job orders',
    icon: ClipboardList,
    roles: ['admin', 'manager'],
    // The list and each order's page, but not "New order", which has its own item.
    isActive: (path) => path.startsWith('/orders') && !path.startsWith('/orders/new'),
  },
  { to: '/orders/new', label: 'New order', icon: FilePlus2, roles: ['admin'] },
  { to: '/review', label: 'Review queue', icon: ClipboardCheck, roles: ['manager'] },
  { to: '/assistant', label: 'AI assistant', icon: Sparkles, roles: ['admin', 'manager'] },
]

const STORAGE_KEY = 'sejuk-ops:sidebar'

/** Expanded (icons + labels) or collapsed (72px icon rail); remembered per browser. Expanded by default. */
function useSidebarExpanded() {
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'collapsed'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, expanded ? 'expanded' : 'collapsed')
    } catch {
      // Storage unavailable (private mode): the choice just isn't remembered.
    }
  }, [expanded])
  return [expanded, setExpanded] as const
}

/** Shared look for nav links and sidebar buttons. Below 761px the bar is horizontal and icon-only. */
const itemClass = (expanded: boolean, active = false) =>
  clsx(
    'flex size-11 shrink-0 items-center justify-center rounded-btn transition-colors',
    expanded && 'nav:w-full nav:justify-start nav:gap-3 nav:px-3',
    active ? 'bg-white text-navy-900 hover:text-navy-900' : 'bg-navy-800 text-on-navy-soft hover:text-on-navy',
  )

const labelClass = (expanded: boolean) =>
  clsx('truncate text-body-sm font-medium', expanded ? 'hidden nav:inline' : 'hidden')

/**
 * Desktop layout (DESIGN.md §4 Sidebar, §5 Layouts): navy sidebar that expands to
 * show labels or collapses to the 72px icon rail; a horizontal bar at ≤760px.
 */
export function DesktopShell() {
  const { user, signOut } = useSession()
  const { pathname } = useLocation()
  const [expanded, setExpanded] = useSidebarExpanded()
  const items = NAV.filter((item) => user && item.roles.includes(user.role))
  const toggleLabel = expanded ? 'Collapse sidebar' : 'Expand sidebar'
  const ToggleIcon = expanded ? PanelLeftClose : PanelLeftOpen

  return (
    <div className="flex min-h-screen flex-wrap content-start items-start gap-4 p-4">
      <aside
        id="sidebar"
        className={clsx(
          'flex w-full items-center gap-3 rounded-panel bg-navy-900 px-3 py-2',
          'nav:sticky nav:top-4 nav:h-[calc(100vh-32px)] nav:flex-col nav:gap-0 nav:py-5 nav:transition-[width] nav:duration-200',
          expanded ? 'nav:w-[232px] nav:items-stretch nav:px-4' : 'nav:w-[72px] nav:px-0',
        )}
      >
        {/* Logo: plain mark on the ≤760px top bar; on the vertical sidebar it toggles collapse / expand. */}
        <LogoMark className="nav:hidden" />
        <button
          type="button"
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={expanded}
          aria-controls="sidebar"
          onClick={() => setExpanded((v) => !v)}
          className={clsx(
            'hidden h-11 items-center gap-3 rounded-btn text-on-navy transition-colors hover:bg-navy-800 nav:flex',
            expanded ? 'nav:w-full nav:px-1.5' : 'nav:w-11 nav:justify-center',
          )}
        >
          <LogoMark />
          <span className={labelClass(expanded)}>Sejuk Ops</span>
        </button>

        <nav aria-label="Main" className="flex gap-2 nav:mt-[120px] nav:flex-col nav:gap-2.5">
          {items.map(({ to, label, icon: Icon, isActive }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              title={expanded ? undefined : label}
              className={(state) => itemClass(expanded, isActive ? isActive(pathname) : state.isActive)}
              aria-current={isActive ? (isActive(pathname) ? 'page' : undefined) : undefined}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span className={labelClass(expanded)}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex gap-2 nav:mt-auto nav:ml-0 nav:flex-col nav:gap-2.5">
          {/* Only the vertical sidebar collapses; the ≤760px top bar is always icon-only. */}
          <div className="hidden nav:block">
            <button
              type="button"
              aria-label={toggleLabel}
              title={expanded ? undefined : toggleLabel}
              aria-expanded={expanded}
              aria-controls="sidebar"
              onClick={() => setExpanded((v) => !v)}
              className={itemClass(expanded)}
            >
              <ToggleIcon className="size-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span className={labelClass(expanded)}>Collapse</span>
            </button>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            title={expanded ? undefined : 'Sign out'}
            onClick={signOut}
            className={itemClass(expanded)}
          >
            <LogOut className="size-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span className={labelClass(expanded)}>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-[999_1_560px]">
        <Outlet />
        <ScrollRestoration />
      </main>
    </div>
  )
}
