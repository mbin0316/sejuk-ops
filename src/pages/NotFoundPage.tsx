import { ButtonLink, Card } from '../components/ui.tsx'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] items-center px-4">
      <Card className="flex w-full flex-col items-start gap-4">
        <div>
          <p className="text-metric font-medium text-ink">404</p>
          <p className="text-body text-ink-muted">This page doesn't exist.</p>
        </div>
        <ButtonLink to="/" variant="dark">
          Back to start
        </ButtonLink>
      </Card>
    </div>
  )
}
