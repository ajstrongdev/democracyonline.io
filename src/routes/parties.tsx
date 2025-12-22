import { createFileRoute, redirect } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  Label,
} from 'recharts'
import GenericSkeleton from '@/components/generic-skeleton'
import { Suspense } from 'react'
import { Users, TrendingUp, Crown } from 'lucide-react'
import { getPartyInfo, partyPageData } from '@/lib/server/party'
import { useQuery } from '@tanstack/react-query'
import { fetchUserInfoByEmail } from '@/lib/server/users'
import ProtectedRoute from '@/components/auth/protected-route'
import { useAuth } from '@/lib/auth-context'
import { User } from 'firebase/auth'

export const Route = createFileRoute('/parties')({
  beforeLoad: ({ context }) => {
    if (context.auth.loading) {
      return
    }
    if (!context.auth.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async ({ context }) => {
    return partyPageData({
      data: { email: (context.auth.user as User).email! },
    })
  },
  component: PartyPage,
})

function PartyPage() {
  return (
    <Suspense fallback={<GenericSkeleton />}>
      <ProtectedRoute>
        <PartyContent />
      </ProtectedRoute>
    </Suspense>
  )
}

function PartyContent() {
  const data = Route.useLoaderData()
  const partyStats = data.partyInfo
  const { user } = useAuth() // Get the authenticated user
  const totalMembers = partyStats.reduce(
    (sum, stats) => sum + stats.memberCount,
    0,
  )

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Political Parties
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Discover the parties and their platforms
        </p>
      </div>
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Parties</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partyStats.length}</div>
            <p className="text-xs text-muted-foreground">
              Active political parties
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers}</div>
            <p className="text-xs text-muted-foreground">Across all parties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Largest Party</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-xl font-bold truncate">
              {partyStats[0]?.name || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {partyStats[0]?.memberCount || 0} members
            </p>
          </CardContent>
        </Card>
      </div>
      {data.isInParty && (
        <div className="p-4 border border-green-300 bg-green-50 text-green-800 rounded-md">
          You are a member of a political party.
        </div>
      )}
    </div>
  )
}
