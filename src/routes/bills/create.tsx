import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { createBill } from '@/lib/server/bills'
import { fetchUserInfoByEmail } from '@/lib/server/users'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/bills/create')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async ({ context }) => {
    if (!context.auth.user?.email) {
      throw redirect({ to: '/login' })
    }

    const userData = await fetchUserInfoByEmail({
      data: { email: context.auth.user.email },
    })
    const user = Array.isArray(userData) ? userData[0] : userData

    if (!user) {
      throw redirect({ to: '/login' })
    }

    return { user }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { user } = Route.useLoaderData()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      title: '',
      content: '',
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true)
      setSubmitError(null)

      try {
        // Create the bill
        await createBill({
          data: {
            title: value.title,
            content: value.content,
            creatorId: user.id,
          },
        })

        // Navigate to bills list on success
        navigate({ to: '/bills' })
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : 'Failed to create bill',
        )
        setIsSubmitting(false)
      }
    },
  })

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Create New Bill</h1>
          <p className="text-muted-foreground">
            Draft a new bill for legislative consideration
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-6"
        >
          {submitError && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {submitError}
            </div>
          )}

          <form.Field
            name="title"
            validators={{
              onChange: ({ value }) =>
                !value || value.trim().length === 0
                  ? 'Title is required'
                  : value.length > 255
                    ? 'Title must be 255 characters or less'
                    : undefined,
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Bill Title</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="text"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g., Healthcare Reform Act of 2026"
                  required
                />
                {field.state.meta.errors && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors.join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="content"
            validators={{
              onChange: ({ value }) =>
                !value || value.trim().length === 0
                  ? 'Content is required'
                  : value.length < 8
                    ? 'Content must be at least 8 characters long'
                    : undefined,
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Bill Content</Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter the full text of the bill..."
                  className="min-h-64"
                  required
                />
                {field.state.meta.errors && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors.join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.isSubmitting, state.canSubmit]}
          >
            {([formIsSubmitting, canSubmit]) => (
              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={formIsSubmitting || !canSubmit || isSubmitting}
                >
                  {isSubmitting ? 'Creating Bill...' : 'Create Bill'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate({ to: '/bills' })}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </Card>
    </div>
  )
}
