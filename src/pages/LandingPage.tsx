import { LogIn, LogOut } from 'lucide-react'
import { Navigate } from 'react-router'
import { FullScreenMessage } from '../components/FullScreenMessage.tsx'
import { ReviewerNotice } from '../components/ReviewerNotice.tsx'
import { Button, Card, LogoMark, NavyPanel } from '../components/ui.tsx'
import { ROLE_HOME } from '../lib/domain.ts'
import { useSession } from '../lib/session.tsx'

/** Start page: Auth0 sign-in, then redirect to the user's role home. */
export function LandingPage() {
  const { isLoading, user, hasNoRole, error, signIn, signOut } = useSession()

  if (isLoading) return <FullScreenMessage title="Loading…" />
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />

  return (
    // Decorative background photo (public/sign-in-bg.webp); the cards stay on solid surfaces for contrast.
    <div className="min-h-screen bg-page bg-cover bg-center bg-fixed" style={{ backgroundImage: 'url(/sign-in-bg.webp)' }}>
    <div className="mx-auto flex min-h-screen max-w-[520px] flex-col justify-center gap-4 px-4 py-10">
      <NavyPanel className="flex flex-col gap-4">
        <LogoMark />
        <div>
          <h1 className="text-title font-medium">Sejuk Sejuk Ops</h1>
          <p className="mt-1 text-body-sm text-on-navy-muted">Order → assignment → service completion → review</p>
        </div>
      </NavyPanel>

      {hasNoRole ? (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-heading font-medium">No access yet</h2>
            <p className="text-body-sm text-ink-muted">
              You're signed in, but your account has no Sejuk Ops role. Ask an administrator to assign Admin, Manager or
              Technician in Auth0, then sign in again.
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="size-5" strokeWidth={1.8} aria-hidden="true" />
            Sign out
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-heading font-medium">Sign in</h2>
            <p className="text-body-sm text-ink-muted">
              Admins, managers and technicians use the same sign-in. You'll go straight to your own portal.
            </p>
          </div>
          {error && (
            <p role="alert" className="rounded-input bg-danger-tint px-3 py-2 text-body-sm text-danger-text">
              Sign-in failed: {error.message}
            </p>
          )}
          <Button onClick={() => signIn()}>
            <LogIn className="size-5" strokeWidth={1.8} aria-hidden="true" />
            Sign in
          </Button>
        </Card>
      )}

      {!hasNoRole && <ReviewerNotice />}
    </div>
    </div>
  )
}
