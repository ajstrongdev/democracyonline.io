import { createFileRoute, redirect } from '@tanstack/react-router'
import { billPageData } from '@/lib/server/bills'

export const Route = createFileRoute('/bills/$id')({
  beforeLoad: ({ context }) => {
    if (context.auth.loading) {
      return
    }
    if (!context.auth.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async ({ params }) => {
    const billId: number = Number(params.id)
    if (isNaN(billId)) {
      throw redirect({ to: '/bills' })
    }
      const billData = await billPageData({ data: { id: billId } })
      if (billData === null) {
        throw redirect({ to: '/bills' })
      } 
      return billData;
  },
  component: RouteComponent,
})

function RouteComponent() {
  const data = Route.useLoaderData()
  const { bill, votes } = data;
  return <div>Hello "/bills/$id"!</div>
}
