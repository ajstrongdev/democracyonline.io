import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchUserInfoByEmail, getUserStats } from "@/lib/server/users";
import { UserStatsDisplay } from "@/components/search/UserStatsDisplay";
import { SearchForm } from "@/components/search/SearchForm";

export const Route = createFileRoute("/search")({
  component: SearchPage,
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async ({ context }) => {
    if (!context.auth.user?.email) {
      throw redirect({ to: "/login" });
    }

    const stats = await getUserStats();

    const currentUserData = await fetchUserInfoByEmail({
      data: { email: context.auth.user.email },
    });
    const currentUser = Array.isArray(currentUserData)
      ? currentUserData[0]
      : currentUserData;

    return { stats, currentUserId: currentUser?.id };
  },
  pendingComponent: () => (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 bg-gray-200 dark:bg-gray-700 rounded"
            ></div>
          ))}
        </div>
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  ),
});

function SearchPage() {
  const { stats, currentUserId } = Route.useLoaderData();

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-3">Find Users</h1>
        <p className="text-muted-foreground text-lg">
          Search for users by their username.
        </p>
      </div>

      <UserStatsDisplay stats={stats} />

      <SearchForm currentUserId={currentUserId} />
    </div>
  );
}
