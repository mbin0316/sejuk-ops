import { LogOut } from 'lucide-react'
import { Button, Card } from '../../components/ui.tsx'
import { ROLE_LABEL } from '../../lib/domain.ts'
import { useSession } from '../../lib/session.tsx'

export function ProfilePage() {
  const { user, signOut } = useSession()
  if (!user) return null

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-heading-sm font-medium">{user.name}</h2>
        <p className="text-body-sm text-ink-muted">
          {ROLE_LABEL[user.role]}
          {user.email && ` · ${user.email}`}
        </p>
      </div>
      <Button
        variant="outline"
        size="lg"
        onClick={signOut}
      >
        <LogOut className="size-5" strokeWidth={1.8} aria-hidden="true" />
        Sign out
      </Button>
    </Card>
  )
}
