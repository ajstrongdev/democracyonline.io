import { Link, createFileRoute, useNavigate  } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { signIn } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      const { user, error } = await signIn(value);

      if (error) {
        form.setErrorMap({
          onSubmit: error,
        });
      } else if (user) {
        navigate({ to: "/profile" });
      }
    },
  });

  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="w-full p-6 space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">Sign In</h1>
            <p className="text-muted-foreground">
              Enter your email and password to sign in.
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

            <form.Field name="password">
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
                </div>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => [state.isSubmitting]}>
              {([isSubmitting]) => (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
