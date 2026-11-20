import { Card, LogoMark, NavyPanel } from '../components/ui.tsx'

/** Shown when the VITE_AUTH0_* env vars are missing, instead of a broken sign-in. */
export function AuthSetupNotice() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center gap-4 px-4 py-10">
      <NavyPanel className="flex flex-col gap-4">
        <LogoMark />
        <h1 className="text-title font-medium">Sejuk Sejuk Ops</h1>
      </NavyPanel>
      <Card className="flex flex-col gap-2">
        <h2 className="text-heading font-medium">Sign-in isn't configured</h2>
        <p className="text-body-sm text-ink-muted">
          Set <code className="font-mono text-label">VITE_AUTH0_DOMAIN</code>,{' '}
          <code className="font-mono text-label">VITE_AUTH0_CLIENT_ID</code> and{' '}
          <code className="font-mono text-label">VITE_AUTH0_AUDIENCE</code> in{' '}
          <code className="font-mono text-label">.env.local</code>, then restart the dev server. See{' '}
          <code className="font-mono text-label">docs/auth0-setup.md</code>.
        </p>
      </Card>
    </div>
  )
}
