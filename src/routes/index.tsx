import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-2xl space-y-6">
        <h2 className="text-3xl font-bold">Welcome!</h2>
        <p className="text-lg text-muted-foreground">
          This is your home page with Firebase authentication integrated.
        </p>

        <div className="flex gap-4">
          <Link to="/profile" className="text-primary hover:underline">
            View Profile
          </Link>
          <Link to="/parties" className="text-primary hover:underline">
            View Parties
          </Link>
        </div>
      </div>
    </main>
  )
}
