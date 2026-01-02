import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { fetchUserInfoByEmail } from '@/lib/server/users'
import { getPoliticalStances, createParty } from '@/lib/server/party'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { useState } from 'react'
import { icons } from '@/lib/utils/logo-helper'

export const Route = createFileRoute('/parties/create')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async ({ context }) => {
    if (!context.auth.user?.email) {
      throw redirect({ to: '/login' })
    }
    const [userData, stances] = await Promise.all([
      fetchUserInfoByEmail({
        data: { email: context.auth.user.email },
      }),
      getPoliticalStances(),
    ])
    return {
      userData: Array.isArray(userData) ? userData[0] : userData,
      stances,
    }
  },
  component: PartyCreatePage,
})

export const leanings = [
  'Far Left',
  'Left',
  'Center Left',
  'Center',
  'Center Right',
  'Right',
  'Far Right',
]

function PartyCreatePage() {
  const user = Route.useLoaderData().userData
  const navigate = useNavigate()
  const { stances } = Route.useLoaderData()
  const [leaning, setLeaning] = useState([3])
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null)
  const [stanceValues, setStanceValues] = useState<Record<number, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: '',
      color: '#ff0000',
      bio: '',
      discord_link: '',
      stanceValues: {},
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      const stanceEntries = Object.entries(stanceValues).filter(
        ([_, val]) => val.trim() !== '',
      )

      try {
        const newParty = await createParty({
          data: {
            party: {
              name: value.name,
              leader_id: user.id,
              bio: value.bio,
              color: value.color,
              logo: selectedLogo,
              discord: value.discord_link || null,
              leaning: leanings[leaning[0]],
            },
            stances: stanceEntries.map(([id, val]) => ({
              stanceId: Number(id),
              value: val,
            })),
          },
        })
        navigate({
          to: '/parties/$id',
          params: { id: String(newParty.id) },
        })
      } catch (error) {
        console.error('Error creating party:', error)
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to create party. Please try again.'
        setSubmitError(errorMessage)
      }
    },
  })

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Create a Political Party
        </h1>
        <p className="text-muted-foreground">
          Create your own political party and start gathering supporters!
        </p>
      </div>
      <div className="mx-auto bg-card p-8 rounded-lg shadow space-y-8">
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          {/* Party Name */}
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.trim().length === 0) {
                  return 'Party name is required'
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="grid grid-cols-1 gap-2">
                <Label
                  htmlFor={field.name}
                  className="text-lg font-medium text-foreground"
                >
                  Party Name<span className="text-red-500">*</span>
                </Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter party name"
                />
                {field.state.meta.errors.length > 0 && (
                  <span className="text-sm text-red-500">
                    {field.state.meta.errors.join(', ')}
                  </span>
                )}
              </div>
            )}
          </form.Field>

          {/* Party Color */}
          <form.Field
            name="color"
            validators={{
              onChange: ({ value }) => {
                const colorRegex = /^#[0-9A-Fa-f]{6}$/
                if (!colorRegex.test(value)) {
                  return 'Invalid color format (e.g., #ff0000)'
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="grid grid-cols-1 gap-2">
                <Label
                  htmlFor={field.name}
                  className="text-lg font-medium text-foreground"
                >
                  Party Color<span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="text"
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="#ff0000"
                    maxLength={7}
                    className="w-full"
                  />
                  <Input
                    type="color"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-10 p-0 border-0"
                  />
                </div>
                {field.state.meta.errors.length > 0 && (
                  <span className="text-sm text-red-500">
                    {field.state.meta.errors.join(', ')}
                  </span>
                )}
              </div>
            )}
          </form.Field>

          {/* Party Bio */}
          <form.Field
            name="bio"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.trim().length === 0) {
                  return 'Party bio is required'
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="grid grid-cols-1 gap-2">
                <Label
                  htmlFor={field.name}
                  className="text-lg font-medium text-foreground"
                >
                  Party Bio<span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Brief description of your party"
                  className="min-h-20"
                />
                {field.state.meta.errors.length > 0 && (
                  <span className="text-sm text-red-500">
                    {field.state.meta.errors.join(', ')}
                  </span>
                )}
              </div>
            )}
          </form.Field>

          {/* Discord Link */}
          <form.Field
            name="discord_link"
            validators={{
              onChange: ({ value }) => {
                if (value && value.trim().length > 0) {
                  try {
                    new URL(value)
                  } catch {
                    return 'Invalid URL format'
                  }
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="grid grid-cols-1 gap-2">
                <Label
                  htmlFor={field.name}
                  className="text-lg font-medium text-foreground"
                >
                  Discord Invite Link
                </Label>
                <Input
                  type="url"
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="https://discord.gg/..."
                />
                {field.state.meta.errors.length > 0 && (
                  <span className="text-sm text-red-500">
                    {field.state.meta.errors.join(', ')}
                  </span>
                )}
              </div>
            )}
          </form.Field>

          {/* Party Logo */}
          <div className="space-y-6">
            <Label className="text-lg font-medium text-foreground">
              Party Logo
            </Label>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedLogo(null)}
                className={`flex items-center justify-center w-14 h-14 rounded-md border p-2 text-sm hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  selectedLogo === null
                    ? 'ring-2 ring-offset-2 ring-primary'
                    : ''
                }`}
                aria-pressed={selectedLogo === null}
                title="None"
              >
                None
              </button>

              {icons.map((ic) => {
                const IconComp = ic.Icon
                return (
                  <button
                    key={ic.name}
                    type="button"
                    onClick={() => setSelectedLogo(ic.name)}
                    className={`flex items-center justify-center w-14 h-14 rounded-md border p-2 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      selectedLogo === ic.name
                        ? 'ring-2 ring-offset-2 ring-primary'
                        : ''
                    }`}
                    aria-pressed={selectedLogo === ic.name}
                    title={ic.name}
                  >
                    <IconComp className="w-6 h-6" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Political Leaning */}
          <div>
            <Label className="block text-center mb-8">
              <span className="text-lg font-medium">Political Leaning: </span>
              <span className="font-sm">{leanings[leaning[0]]}</span>
            </Label>

            <div className="relative px-2">
              <Slider
                value={leaning}
                onValueChange={setLeaning}
                max={6}
                step={1}
                className="cursor-pointer"
              />

              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                {leanings.map((_, i) => (
                  <span key={i} className="text-center w-12">
                    {i === 0
                      ? 'Far Left'
                      : i === 6
                        ? 'Far Right'
                        : i - 3 === 0
                          ? 'Center'
                          : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Party Stances */}
          {stances &&
            stances.length > 0 &&
            stances.map((stance) => (
              <div className="grid grid-cols-1 gap-2" key={stance.id}>
                <Label
                  htmlFor={`stance-${stance.id}`}
                  className="text-lg font-medium text-foreground"
                >
                  {stance.issue}
                </Label>
                <Textarea
                  id={`stance-${stance.id}`}
                  value={stanceValues[stance.id] || ''}
                  onChange={(e) =>
                    setStanceValues((prev) => ({
                      ...prev,
                      [stance.id]: e.target.value,
                    }))
                  }
                  placeholder={stance.description}
                  className="min-h-20"
                />
              </div>
            ))}

          {/* Submit Error */}
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          {/* Submit Button */}
          <form.Subscribe
            selector={(state) => [state.isSubmitting, state.canSubmit]}
          >
            {([isSubmitting, canSubmit]) => (
              <Button
                type="submit"
                className="w-full py-3"
                disabled={isSubmitting || !canSubmit}
              >
                {isSubmitting ? 'Creating Party...' : 'Create Party'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  )
}
