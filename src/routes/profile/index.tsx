import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUserInfo } from "@/lib/server/users";
import GenericSkeleton from "@/components/generic-skeleton";

export const Route = createFileRoute("/profile/")({
  loader: async () => {
    const user = await getCurrentUserInfo();

    if (!user) {
      throw redirect({ to: "/" });
    }

    throw redirect({ to: "/dashboard" });
  },
  component: () => {
    return <GenericSkeleton />;
  },
});
