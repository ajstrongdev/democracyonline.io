import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import PartyLogo from '@/components/party-logo'

interface UserResult {
  id: number
  username: string
  bio: string | null
  politicalLeaning: string | null
  role: string | null
  partyId: number | null
  createdAt: Date | null
  lastActivity: number | null
}

interface PartyInfo {
  id: number
  name: string
  color: string | null
  logo: string | null
}

interface SearchResultsProps {
  users: UserResult[]
  partyData: Record<number, PartyInfo>
  searchQuery: string
}

export function SearchResults({
  users,
  partyData,
  searchQuery,
}: SearchResultsProps) {
  if (users.length === 0 && searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <User className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">
          No users found for &quot;{searchQuery}&quot;
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {users.length} {users.length === 1 ? 'result' : 'results'}
      </h2>
      <div className="space-y-3">
        {users.map((user) => {
          const party = user.partyId ? partyData[user.partyId] : null

          // Determine if user is active (within last 7 days)
          const isActive = user.lastActivity
            ? Date.now() / 1000 - user.lastActivity < 7 * 24 * 60 * 60
            : false

          return (
            <Card
              key={user.id}
              className="transition-all hover:shadow-md border-l-4"
              style={{ borderLeftColor: party?.color || '#6b7280' }}
            >
              <CardContent className="flex items-start gap-4">
                {party ? (
                  <PartyLogo party_id={party.id} size={48} />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold shrink-0">
                    {user.username[0].toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        to="/profile/$id"
                        params={{ id: user.id.toString() }}
                      >
                        <h3 className="text-lg font-semibold hover:underline cursor-pointer truncate">
                          {user.username}
                        </h3>
                      </Link>
                      {user.role && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                            {user.role}
                          </span>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium">
                              Active
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <Link to="/profile/$id" params={{ id: user.id.toString() }}>
                      <Button variant="outline" size="sm">
                        View Profile
                      </Button>
                    </Link>
                  </div>

                  {user.politicalLeaning && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {user.politicalLeaning}
                    </p>
                  )}

                  {party && (
                    <Link
                      to="/parties/$id"
                      params={{ id: party.id.toString() }}
                    >
                      <p
                        className="text-sm font-medium hover:underline cursor-pointer mt-1"
                        style={{ color: party.color || undefined }}
                      >
                        {party.name}
                      </p>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
