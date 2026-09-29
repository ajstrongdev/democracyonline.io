import { useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { deleteUser } from "firebase/auth";
import { signUp } from "@/lib/auth-utils";
import { createUser } from "@/lib/server/users/users";
import { validateInvitation } from "@/lib/server/users/invitations";
import { createSessionCookie } from "@/lib/server/auth/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { leanings } from "@/lib/constants";

export function SignupForm({ inviteToken }: { inviteToken: string }) {
  const navigate = useNavigate();
  const [leaningValue, setLeaningValue] = useState([3]);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      username: "",
      bio: "",
      pronouns: "",
      politicalLeaning: "Center",
    },
    onSubmit: async ({ value }) => {
      // Validate the invitation before creating the Firebase account.
      try {
        await validateInvitation({ data: { token: inviteToken } });
      } catch (tokenError: any) {
        form.setErrorMap({
          onSubmit: tokenError.message || "Invalid invite link",
        });
        return;
      }

      // Only create the Firebase user after invitation validation.
      const { user, error } = await signUp({
        email: value.email,
        password: value.password,
      });

      if (error) {
        form.setErrorMap({
          onSubmit: error,
        });
        return;
      }

      if (user) {
        try {
          await createUser({
            data: {
              inviteToken,
              email: value.email,
              username: value.username,
              bio: value.bio || undefined,
              pronouns: value.pronouns || undefined,
              politicalLeaning: leanings[leaningValue[0]],
            },
          });
        } catch (dbError: any) {
          // A link may be redeemed between validation and profile creation.
          // Don't leave behind an account that cannot sign up again.
          try {
            await deleteUser(user);
          } catch {
            // Preserve the signup error if Firebase cleanup also fails.
          }
          form.setErrorMap({
            onSubmit: dbError.message || "Failed to create user profile",
          });
          return;
        }

        // Establish the SSR session before navigating to the dashboard.
        const idToken = await user.getIdToken(true);
        await createSessionCookie({ data: { idToken } });
        await navigate({ to: "/dashboard" });
      }
    },
  });

  return (
    <Card className="w-full max-w-md space-y-6 rounded-sm p-5 shadow-sm sm:p-7">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Create Account</h1>
        <p className="text-muted-foreground">
          Set up your player profile and sign-in details.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        {form.state.errorMap.onSubmit && (
          <div role="alert" className="rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {form.state.errorMap.onSubmit}
          </div>
        )}

        <form.Field
          name="username"
          validators={{
            onChange: ({ value }) =>
              value.length < 1 ? "Username is required" : undefined,
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="text-sm font-medium">
                Username
              </label>
              <input
                id={field.name}
                name={field.name}
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
                autoComplete="username"
                className="h-11 w-full rounded-md border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
                placeholder=""
              />
              {field.state.meta.errors && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors.join(", ")}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="bio">
          {(field) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="text-sm font-medium">
                Bio (optional)
              </label>
              <textarea
                id={field.name}
                name={field.name}
                value={field.state.value}
                maxLength={1000}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-ring"
                placeholder="Tell us about yourself..."
              />
            </div>
          )}
        </form.Field>

        <form.Field name="pronouns">
          {(field) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="text-sm font-medium">
                Pronouns (optional)
              </label>
              <input
                id={field.name}
                name={field.name}
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                maxLength={80}
                className="h-11 w-full rounded-md border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
                placeholder="they/she"
              />
              <p className="text-xs text-muted-foreground">Enter pronouns in your preferred order, for example they/she.</p>
            </div>
          )}
        </form.Field>

        <div className="space-y-2">
          <p id="political-leaning-label" className="text-sm font-medium">Political leaning</p>
          <div className="space-y-3 p-4 bg-muted/50 rounded-md">
            <Slider
              aria-label="Political leaning"
              min={0}
              max={6}
              step={1}
              value={leaningValue}
              onValueChange={setLeaningValue}
            />
            <p className="text-center font-medium text-sm">
              {leanings[leaningValue[0]]}
            </p>
          </div>
        </div>

        <form.Field name="email">
          {(field) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="text-sm font-medium">
                Email
              </label>
              <input
                id={field.name}
                name={field.name}
                type="email"
                autoComplete="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
                className="h-11 w-full rounded-md border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
                placeholder="you@example.com"
              />
            </div>
          )}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onChange: ({ value }) =>
              value.length < 6
                ? "Password must be at least 6 characters"
                : undefined,
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="text-sm font-medium">
                Password
              </label>
              <input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete="new-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
                className="h-11 w-full rounded-md border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
                placeholder="••••••••"
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
          name="confirmPassword"
          validators={{
            onChangeListenTo: ["password"],
            onChange: ({ value, fieldApi }) => {
              const password = fieldApi.form.getFieldValue("password");
              return value !== password ? "Passwords do not match" : undefined;
            },
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="text-sm font-medium">
                Confirm Password
              </label>
              <input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete="new-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
                className="h-11 w-full rounded-md border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
                placeholder="••••••••"
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
          {([isSubmitting, canSubmit]) => (
            <Button
              type="submit"
              className="h-11 w-full"
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </Card>
  );
}
