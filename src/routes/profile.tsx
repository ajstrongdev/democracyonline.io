import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  )
}

function ProfileContent() {
  const { user } = useAuth()

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Profile</h1>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Email
            </label>
            <p className="text-lg">{user?.email}</p>
          </div>

          {user?.displayName && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Display Name
              </label>
              <p className="text-lg">{user.displayName}</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              User ID
            </label>
            <p className="text-sm font-mono text-muted-foreground">
              {user?.uid}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Account Created
            </label>
            <p className="text-sm">
              {user?.metadata.creationTime
                ? new Date(user.metadata.creationTime).toLocaleDateString()
                : 'Unknown'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
