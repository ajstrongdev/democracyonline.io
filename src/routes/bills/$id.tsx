import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/bills/$id')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async ({ params }) => {
    // TODO: Implement bill detail fetching
    return { billId: params.id }
  },
  component: BillDetailPage,
})

function BillDetailPage() {
  const { billId } = Route.useLoaderData()

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">Bill #{billId}</h1>
      <p className="text-muted-foreground">
        Bill detail view - implementation pending
      </p>
    </div>
  )
}
