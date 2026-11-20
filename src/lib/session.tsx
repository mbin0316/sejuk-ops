/* eslint-disable react/only-export-components */
// Current user + role, derived from the Auth0 ID token's custom claims.
// The API never trusts this: it re-checks roles on the verified access token.
import { useAuth0 } from '@auth0/auth0-react'
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { setTokenGetter } from './api.ts'
import { CLAIM_NS } from './auth-config.ts'
import { ROLES, type Role } from './domain.ts'

export type SessionUser = {
  sub: string
  /** Display name: the technician's name for technicians, otherwise the Auth0 profile name. */
  name: string
  email: string | null
  /** Primary role used for routing. */
  role: Role
  roles: Role[]
  technician: string | null
}

type Session = {
  isLoading: boolean
  isAuthenticated: boolean
  /** Signed in, but the account has no Sejuk Ops role assigned in Auth0. */
  hasNoRole: boolean
  user: SessionUser | null
  error: Error | undefined
  signIn: (returnTo?: string) => void
  signOut: () => void
}

const SessionContext = createContext<Session | null>(null)

// If an account somehow has several roles, route by this priority.
const ROLE_PRIORITY: Role[] = ['admin', 'manager', 'technician']

export function SessionProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user: idUser, error, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0()

  useEffect(() => {
    setTokenGetter(
      isAuthenticated
        ? async () => {
            const token = await getAccessTokenSilently()
            if (!token) throw new Error('No access token available')
            return token
          }
        : null,
    )
    return () => setTokenGetter(null)
  }, [isAuthenticated, getAccessTokenSilently])

  const value = useMemo<Session>(() => {
    let user: SessionUser | null = null
    if (isAuthenticated && idUser?.sub) {
      const raw = idUser[`${CLAIM_NS}/roles`]
      const roles = (Array.isArray(raw) ? raw : [])
        .map((r) => String(r).toLowerCase())
        .filter((r): r is Role => (ROLES as readonly string[]).includes(r))
      const role = ROLE_PRIORITY.find((r) => roles.includes(r))
      const technician = (idUser[`${CLAIM_NS}/technician`] as string | undefined) || null
      if (role) {
        user = {
          sub: idUser.sub,
          name: (role === 'technician' && technician) || idUser.name || idUser.email || 'User',
          email: idUser.email ?? null,
          role,
          roles,
          technician,
        }
      }
    }

    return {
      isLoading,
      isAuthenticated,
      hasNoRole: isAuthenticated && !user,
      user,
      error,
      signIn: (returnTo?: string) => loginWithRedirect({ appState: { returnTo } }),
      signOut: () => logout({ logoutParams: { returnTo: window.location.origin } }),
    }
  }, [isLoading, isAuthenticated, idUser, error, loginWithRedirect, logout])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
