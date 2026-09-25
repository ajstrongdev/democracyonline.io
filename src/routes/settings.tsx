import { createFileRoute, redirect } from "@tanstack/react-router";

// Older links to settings still take players into the app; settings now opens
// from the account button in the navigation bar.
export const Route = createFileRoute("/settings")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
