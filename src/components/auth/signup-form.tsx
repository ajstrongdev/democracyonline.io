import { useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { signUp } from "@/lib/auth-utils";
import { createUser, validateAccessToken } from "@/lib/server/users";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { leanings } from "@/lib/constants";

export function SignupForm() {
  const navigate = useNavigate();
  const [leaningValue, setLeaningValue] = useState([3]);

  const form = useForm({
    defaultValues: {
      accessToken: "",
      email: "",
      password: "",
      confirmPassword: "",
      username: "",
      bio: "",
      politicalLeaning: "Center",
    },
    onSubmit: async ({ value }) => {
      // Validate access token first
      try {
        await validateAccessToken({ data: { token: value.accessToken } });
      } catch (tokenError: any) {
        form.setErrorMap({
          onSubmit: tokenError.message || "Invalid access token",
        });
        return;
      }

      // Only create Firebase user after token validation
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
              accessToken: value.accessToken,
              email: value.email,
              username: value.username,
              bio: value.bio || undefined,
              politicalLeaning: leanings[leaningValue[0]],
            },
          });
          navigate({ to: "/" });
        } catch (dbError: any) {
          form.setErrorMap({
            onSubmit: dbError.message || "Failed to create user profile",
          });
        }
      }
    },
  });

  return (
    <Card className="w-full max-w-md p-6 space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Create Account</h1>
        <p className="text-muted-foreground">
          Enter your information to create an account
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
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {form.state.errorMap.onSubmit}
          </div>
        )}

        <form.Field
          name="accessToken"
          validators={{
            onChange: ({ value }) => {
              if (value.length < 1) {
                return "Access token is required";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="text-sm font-medium">
                Access Token
              </label>
              <input
                id={field.name}
                name={field.name}
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter your access token"
              />
              <p className="text-xs text-muted-foreground">
                To get an access token, please join our{" "}
                <a
                  href="https://discord.gg/m7gDfgJund"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Discord
                </a>
              </p>
              {field.state.meta.errors && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors.join(", ")}
                </p>
              )}
            </div>
          )}
        </form.Field>

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
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
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
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring min-h-20"
                placeholder="Tell us about yourself..."
              />
            </div>
          )}
        </form.Field>

        <div className="space-y-2">
          <label className="text-sm font-medium">Political Leaning</label>
          <div className="space-y-3 p-4 bg-muted/50 rounded-md">
            <Slider
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
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
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
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
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
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
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
              className="w-full"
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
