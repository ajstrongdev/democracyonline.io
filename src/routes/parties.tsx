import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/db'
import { eq, sql, getTableColumns } from 'drizzle-orm'
import { parties, users } from '@/db/schema'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { getPartyInfo } from '@/lib/server/party'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useQuery } from '@tanstack/react-query'
import { fetchUserInfoByEmail } from '@/lib/server/users'
import { useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/parties')({
  beforeLoad: ({ context }) => {
    if (context.auth.loading) {
      return
    }
    if (!context.auth.user) {
      const navigate = useNavigate()
      navigate({ to: '/' })
    }
  },
  loader: async () => {
    return getPartyInfo()
  },
  component: RouteComponent,
})

function RouteComponent() {
  const [user] = useAuthState(auth)
  const data = Route.useLoaderData()
  const totalMembers = data.reduce((sum, stats) => sum + stats.memberCount, 0)

  const { data: thisUser } = useQuery({
    queryKey: ['user', user?.email],
    queryFn: async () => {
      if (user && user.email) {
        const userDetails = await fetchUserInfoByEmail({
          data: { email: user.email },
        })
        return userDetails || null
      }
      return null
    },
    enabled: !!user?.email,
  })

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
            <div className="text-2xl font-bold">{data.length}</div>
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
              {data[0]?.name || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {data[0]?.memberCount || 0} members
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
