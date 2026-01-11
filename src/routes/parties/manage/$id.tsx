import { useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  notFound,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  getPartyById,
  getPartyStances,
  getPoliticalStances,
  updateParty,
} from "@/lib/server/party";
import { fetchUserInfoByEmail } from "@/lib/server/users";
import { icons } from "@/lib/utils/logo-helper";

export const POLITICAL_LEANINGS = [
  "Far Left",
  "Left",
  "Center Left",
  "Center",
  "Center Right",
  "Right",
  "Far Right",
] as const;

export const Route = createFileRoute("/parties/manage/$id")({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async ({ context, params }) => {
    if (!context.auth.user?.email) {
      throw redirect({ to: "/login" });
    }

    const [userResult, partyResult, stancesResult, partyStancesResult] =
      await Promise.allSettled([
        fetchUserInfoByEmail({ data: { email: context.auth.user.email } }),
        getPartyById({ data: { partyId: Number(params.id) } }),
        getPoliticalStances(),
        getPartyStances({ data: { partyId: Number(params.id) } }),
      ]);

    if (userResult.status === "rejected") {
      throw new Error(`Failed to fetch user information: ${userResult.reason}`);
    }
    if (partyResult.status === "rejected") {
      throw new Error(
        `Failed to fetch party information: ${partyResult.reason}`,
      );
    }
    if (stancesResult.status === "rejected") {
      throw new Error(
        `Failed to fetch political stances: ${stancesResult.reason}`,
      );
    }
    if (partyStancesResult.status === "rejected") {
      throw new Error(
        `Failed to fetch party stances: ${partyStancesResult.reason}`,
      );
    }

    const user = userResult.value;
    const party = partyResult.value;
    const stances = stancesResult.value;
    const partyStances = partyStancesResult.value;

    if (!party) {
      throw notFound();
    }

    return {
      user: user[0],
      party: party,
      stances: stances,
      partyStances: partyStances,
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { party, stances, partyStances } = Route.useLoaderData();
  const navigate = useNavigate();

  // Create a map of existing party stances
  const existingStances = partyStances.reduce(
    (acc, stance) => {
      if (stance.stanceId !== null) {
        acc[stance.stanceId] = stance.value;
      }
      return acc;
    },
    {} as Record<number, string>,
  );

  const form = useForm({
    defaultValues: {
      name: party.name,
      color: party.color,
      bio: party.bio ?? "",
      discord_link: party.discord ?? "",
      leaning: party.leaning
        ? POLITICAL_LEANINGS.indexOf(
            party.leaning as (typeof POLITICAL_LEANINGS)[number],
          )
        : 3,
      logo: party.logo ?? null,
      stances: stances.reduce(
        (acc, stance) => {
          acc[stance.id] = existingStances[stance.id] || "";
          return acc;
        },
        {} as Record<number, string>,
      ),
    },
    onSubmit: async ({ value }) => {
      try {
        await updateParty({
          data: {
            party: {
              id: party.id,
              name: value.name,
              leader_id: party.leaderId!,
              bio: value.bio,
              color: value.color,
              logo: value.logo,
              discord: value.discord_link || null,
              leaning: POLITICAL_LEANINGS[value.leaning],
            },
            stances: Object.entries(value.stances)
              .filter(([_, stanceValue]) => stanceValue.trim() !== "")
              .map(([stanceId, stanceValue]) => ({
                stanceId: Number(stanceId),
                value: stanceValue,
              })),
          },
        });
        navigate({ to: "/parties/$id", params: { id: String(party.id) } });
      } catch (error) {
        console.error("Failed to update party:", error);
      }
    },
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Manage Party
        </h1>
        <p className="text-muted-foreground">
          Edit your party's information here.
        </p>
      </div>
      <div className="mx-auto bg-card p-8 rounded-lg shadow space-y-8">
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          {/* Party Name */}
          <form.Field name="name">
            {(field) => (
              <div className="grid grid-cols-1 gap-2">
                <Label
                  htmlFor={field.name}
                  className="text-lg font-medium text-foreground"
                >
                  Party Name
                  <span className="text-red-500" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only">required</span>
                </Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter party name"
                  required
                />
              </div>
            )}
          </form.Field>

          {/* Party Color */}
          <form.Field name="color">
            {(field) => (
              <div className="grid grid-cols-1 gap-2">
                <Label
                  htmlFor={field.name}
                  className="text-lg font-medium text-foreground"
                >
                  Party Color
                  <span className="text-red-500" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only">required</span>
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
                    pattern="^#([A-Fa-f0-9]{6})$"
                    className="w-full"
                    required
                  />
                  <Input
                    type="color"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-10 p-0 border-0"
                  />
                </div>
              </div>
            )}
          </form.Field>

          {/* Party Bio */}
          <form.Field name="bio">
            {(field) => (
              <div className="grid grid-cols-1 gap-2">
                <Label
                  htmlFor={field.name}
                  className="text-lg font-medium text-foreground"
                >
                  Party Bio
                  <span className="text-red-500" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only">required</span>
                </Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Brief description of your party"
                  className="min-h-20"
                  required
                />
              </div>
            )}
          </form.Field>

          {/* Discord Link */}
          <form.Field name="discord_link">
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
              </div>
            )}
          </form.Field>

          {/* Party Logo */}
          <form.Field name="logo">
            {(field) => (
              <div className="space-y-6">
                <Label className="text-lg font-medium text-foreground">
                  Party Logo
                </Label>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => field.handleChange(null)}
                    className={`flex items-center justify-center w-14 h-14 rounded-md border p-2 text-sm hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      field.state.value === null
                        ? "ring-2 ring-offset-2 ring-primary"
                        : ""
                    }`}
                    aria-pressed={field.state.value === null}
                    title="None"
                  >
                    None
                  </button>

                  {icons.map((ic) => {
                    const IconComp = ic.Icon;
                    return (
                      <button
                        key={ic.name}
                        type="button"
                        onClick={() => field.handleChange(ic.name)}
                        className={`flex items-center justify-center w-14 h-14 rounded-md border p-2 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                          field.state.value === ic.name
                            ? "ring-2 ring-offset-2 ring-primary"
                            : ""
                        }`}
                        aria-pressed={field.state.value === ic.name}
                        title={ic.name}
                      >
                        <IconComp className="w-6 h-6" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </form.Field>

          {/* Political Leaning */}
          <form.Field name="leaning">
            {(field) => (
              <div>
                <Label className="block text-center mb-8">
                  <span className="text-lg font-medium">
                    Political Leaning:{" "}
                  </span>
                  <span className="font-sm">
                    {POLITICAL_LEANINGS[field.state.value]}
                  </span>
                </Label>

                <div className="relative px-2">
                  <Slider
                    value={[field.state.value]}
                    onValueChange={(value) => field.handleChange(value[0])}
                    max={6}
                    step={1}
                    className="cursor-pointer"
                  />

                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    {POLITICAL_LEANINGS.map((_, i) => (
                      <span key={i} className="text-center w-12">
                        {i === 0
                          ? "Far Left"
                          : i === 6
                            ? "Far Right"
                            : i - 3 === 0
                              ? "Center"
                              : ""}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </form.Field>

          {/* Party Stances */}
          {stances &&
            stances.length > 0 &&
            stances.map((stance) => (
              <form.Field key={stance.id} name={`stances.${stance.id}`}>
                {(field) => (
                  <div className="grid grid-cols-1 gap-2">
                    <Label
                      htmlFor={`stance-${stance.id}`}
                      className="text-lg font-medium text-foreground"
                    >
                      {stance.issue}
                    </Label>
                    <Textarea
                      id={`stance-${stance.id}`}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={stance.description}
                      className="min-h-20"
                    />
                  </div>
                )}
              </form.Field>
            ))}

          {/* Submit Button */}
          <form.Subscribe selector={(state) => [state.isSubmitting]}>
            {([isSubmitting]) => (
              <Button
                type="submit"
                className="w-full py-3"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Updating Party..." : "Update Party"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  );
}
