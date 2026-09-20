import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { Handshake } from "lucide-react";
import { getCurrentUserInfo } from "@/lib/server/users";
import { createCoalition } from "@/lib/server/coalitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { icons } from "@/lib/utils/logo-helper";
import ProtectedRoute from "@/components/auth/protected-route";
import { useUserData } from "@/lib/hooks/use-user-data";
import { WikiHeader } from "@/components/wiki/wiki-header";
import {
  WikiEmpty,
  WikiPage,
  WikiSection,
} from "@/components/wiki/wiki-layout";

export const Route = createFileRoute("/dashboard/parties/coalitions/create")({
  loader: async () => {
    const userData = await getCurrentUserInfo();
    return { userData };
  },
  component: CreateCoalitionPage,
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
          to: "/dashboard/parties/coalitions/$id",
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
        <WikiPage>
          <WikiHeader
            eyebrow="Political coalitions"
            title="Create a coalition"
            description="Form an alliance of political parties around a shared identity and purpose."
          />
          <WikiEmpty>You must be in a party to create a coalition.</WikiEmpty>
        </WikiPage>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <WikiPage width="article">
        <WikiHeader
          eyebrow="Political coalitions"
          title="Create a coalition"
          description="Form a new coalition. Your party will be recorded as its founding member."
        />
        <WikiSection
          title="Coalition charter"
          description="Set the public identity shown in the coalition archive."
          icon={Handshake}
        >
          <form
            className="mx-auto max-w-3xl space-y-7"
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
                    className="font-medium text-foreground"
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
                    className="font-medium text-foreground"
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
                    className="font-medium text-foreground"
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
              <Label className="font-medium text-foreground">
                Coalition Logo
              </Label>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedLogo(null)}
                  className={`flex h-14 w-14 items-center justify-center rounded-sm border p-2 text-sm hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary ${
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
                      className={`flex h-14 w-14 items-center justify-center rounded-sm border p-2 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary ${
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
              <div className="border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{submitError}</p>
              </div>
            )}

            {/* Submit Button */}
            <form.Subscribe
              selector={(state) => [state.isSubmitting, state.canSubmit]}
            >
              {([isSubmitting, canSubmit]) => (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || !canSubmit}
                >
                  {isSubmitting ? "Creating coalition..." : "Create coalition"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </WikiSection>
      </WikiPage>
    </ProtectedRoute>
  );
}
