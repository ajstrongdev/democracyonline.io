import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { getCurrentUserInfo } from "@/lib/server/users";
import { createCoalition } from "@/lib/server/coalitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { icons } from "@/lib/utils/logo-helper";
import ProtectedRoute from "@/components/auth/protected-route";
import { useUserData } from "@/lib/hooks/use-user-data";
import GenericSkeleton from "@/components/generic-skeleton";

export const Route = createFileRoute("/parties/coalitions/create")({
  loader: async () => {
    const userData = await getCurrentUserInfo();
    return { userData };
  },
  component: CreateCoalitionPage,
  pendingComponent: () => <GenericSkeleton />,
});

function CreateCoalitionPage() {
  const { userData: loaderUserData } = Route.useLoaderData();
  const userData = useUserData(loaderUserData);
  const navigate = useNavigate();

  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: "",
      color: "#3b82f6",
      bio: "",
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        const coalition = await createCoalition({
          data: {
            name: value.name.trim(),
            color: value.color,
            bio: value.bio.trim() || undefined,
            logo: selectedLogo,
          },
        });
        navigate({
          to: "/parties/coalitions/$id",
          params: { id: coalition.id.toString() },
        });
      } catch (error) {
        console.error("Error creating coalition:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to create coalition. Please try again.";
        setSubmitError(errorMessage);
      }
    },
  });

  if (!userData?.partyId) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto py-8 px-4 text-center">
          <p className="text-muted-foreground text-lg">
            You must be in a party to create a coalition.
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Create a Coalition
          </h1>
          <p className="text-muted-foreground">
            Form a new coalition. Your party will be the founding member.
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
            {/* Coalition Name */}
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.trim().length === 0) {
                    return "Coalition name is required";
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="grid grid-cols-1 gap-2">
                  <Label
                    htmlFor={field.name}
                    className="text-lg font-medium text-foreground"
                  >
                    Coalition Name<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter coalition name"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <span className="text-sm text-red-500">
                      {field.state.meta.errors.join(", ")}
                    </span>
                  )}
                </div>
              )}
            </form.Field>

            {/* Coalition Color */}
            <form.Field
              name="color"
              validators={{
                onChange: ({ value }) => {
                  const colorRegex = /^#[0-9A-Fa-f]{6}$/;
                  if (!colorRegex.test(value)) {
                    return "Invalid color format (e.g., #3b82f6)";
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="grid grid-cols-1 gap-2">
                  <Label
                    htmlFor={field.name}
                    className="text-lg font-medium text-foreground"
                  >
                    Coalition Color<span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="text"
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="#3b82f6"
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
                      {field.state.meta.errors.join(", ")}
                    </span>
                  )}
                </div>
              )}
            </form.Field>

            {/* Coalition Bio */}
            <form.Field
              name="bio"
              validators={{
                onChange: ({ value }) => {
                  if (value && value.length > 1000) {
                    return "Description must be 1000 characters or fewer";
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="grid grid-cols-1 gap-2">
                  <Label
                    htmlFor={field.name}
                    className="text-lg font-medium text-foreground"
                  >
                    Description
                  </Label>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Describe the coalition's goals and values"
                    className="min-h-20"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <span className="text-sm text-red-500">
                      {field.state.meta.errors.join(", ")}
                    </span>
                  )}
                </div>
              )}
            </form.Field>

            {/* Coalition Logo */}
            <div className="space-y-6">
              <Label className="text-lg font-medium text-foreground">
                Coalition Logo
              </Label>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedLogo(null)}
                  className={`flex items-center justify-center w-14 h-14 rounded-md border p-2 text-sm hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    selectedLogo === null
                      ? "ring-2 ring-offset-2 ring-primary"
                      : ""
                  }`}
                  aria-pressed={selectedLogo === null}
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
                      onClick={() => setSelectedLogo(ic.name)}
                      className={`flex items-center justify-center w-14 h-14 rounded-md border p-2 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                        selectedLogo === ic.name
                          ? "ring-2 ring-offset-2 ring-primary"
                          : ""
                      }`}
                      aria-pressed={selectedLogo === ic.name}
                      title={ic.name}
                    >
                      <IconComp className="w-6 h-6" />
                    </button>
                  );
                })}
              </div>
            </div>

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
                  {isSubmitting ? "Creating Coalition..." : "Create Coalition"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
