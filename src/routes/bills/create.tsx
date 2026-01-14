import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { createBill } from "@/lib/server/bills";
import { getCurrentUserInfo } from "@/lib/server/users";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ProtectedRoute from "@/components/auth/protected-route";

export const Route = createFileRoute("/bills/create")({
  loader: async () => {
    const userInfo = await getCurrentUserInfo();
    return userInfo;
  },
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const user = Route.useLoaderData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      title: "",
      content: "",
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);
      setSubmitError(null);

      if (!user) {
        setSubmitError("You must be logged in to create a bill");
        setIsSubmitting(false);
        return;
      }

      try {
        // Create the bill
        await createBill({
          data: {
            title: value.title,
            content: value.content,
            creatorId: user.id,
          },
        });

        navigate({ to: "/bills" });
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : "Failed to create bill",
        );
        setIsSubmitting(false);
      }
    },
  });

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Draft a new bill
          </h1>
          <p className="text-muted-foreground">
            Create a new bill to be voted upon by the House, Senate, and
            President.
          </p>
        </div>
        <div className="space-y-4">
          <Card className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
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
                      ? "Title is required"
                      : value.length > 255
                        ? "Title must be 255 characters or less"
                        : undefined,
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Title</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="text"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Enter bill title"
                      disabled={isSubmitting}
                      required
                    />
                    {field.state.meta.errors && (
                      <p className="text-sm text-destructive">
                        {field.state.meta.errors.join(", ")}
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
                      ? "Content is required"
                      : value.length < 8
                        ? "Content must be at least 8 characters long"
                        : undefined,
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Content</Label>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Describe the bill in detail"
                      rows={8}
                      disabled={isSubmitting}
                      required
                    />
                    {field.state.meta.errors && (
                      <p className="text-sm text-destructive">
                        {field.state.meta.errors.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Subscribe
                selector={(state) => [state.isSubmitting, state.canSubmit]}
              >
                {([formIsSubmitting, canSubmit]) => (
                  <div className="flex gap-4 items-center">
                    <Button
                      type="submit"
                      disabled={formIsSubmitting || !canSubmit || isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Create Bill"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/bills" })}
                      className="text-sm underline text-muted-foreground"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </form.Subscribe>
            </form>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
