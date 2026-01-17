import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchUserInfoByEmail } from "@/lib/server/users";
import GenericSkeleton from "@/components/generic-skeleton";

export const Route = createFileRoute("/profile/")({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async ({ context }) => {
    if (!context.auth.user?.email) {
      throw redirect({ to: "/login" });
    }

    const userData = await fetchUserInfoByEmail({
      data: { email: context.auth.user.email },
    });
    const user = Array.isArray(userData) ? userData[0] : userData;

    if (!user) {
      throw redirect({ to: "/" });
    }

    throw redirect({ to: "/profile/$id", params: { id: String(user.id) } });
  },
  component: () => {
    return <GenericSkeleton />;
  },
});
