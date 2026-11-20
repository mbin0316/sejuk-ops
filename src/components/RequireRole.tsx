import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { ROLE_HOME, type Role } from '../lib/domain.ts'
import { useSession } from '../lib/session.tsx'
import { FullScreenMessage } from './FullScreenMessage.tsx'

/**
 * Route guard. Signed out → Auth0 login, then back to this page.
 * Signed in without a role → start page (shows "no access").
 * Wrong role → that role's home.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { isLoading, isAuthenticated, user, signIn } = useSession()
  const location = useLocation()
  const returnTo = location.pathname + location.search

  useEffect(() => {
    if (!isLoading && !isAuthenticated) signIn(returnTo)
  }, [isLoading, isAuthenticated, signIn, returnTo])

  if (isLoading || !isAuthenticated) return <FullScreenMessage title="Signing you in…" />
  if (!user) return <Navigate to="/" replace />
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />
  return children
}
