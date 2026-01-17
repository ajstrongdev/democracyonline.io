import { createFileRoute } from "@tanstack/react-router";
import { getCurrentUserInfo, getUserStats } from "@/lib/server/users";
import { UserStatsDisplay } from "@/components/search/UserStatsDisplay";
import { SearchForm } from "@/components/search/SearchForm";
import { useUserData } from "@/lib/hooks/use-user-data";
import ProtectedRoute from "@/components/auth/protected-route";

export const Route = createFileRoute("/search")({
  loader: async () => {
    const stats = await getUserStats();

    const currentUserData = await getCurrentUserInfo();

    const currentUser = Array.isArray(currentUserData)
      ? currentUserData[0]
      : currentUserData;

    return { stats, currentUser };
  },
  component: SearchPage,
});

function SearchPage() {
  const { stats, currentUser: currentUserLoaderData } = Route.useLoaderData();
  // Hack: load userData client side as server loader returns null on direct nav.
  const currentUser = useUserData(currentUserLoaderData);
  const currentUserId = currentUser ? currentUser.id : null;

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3">Find Users</h1>
          <p className="text-muted-foreground text-lg">
            Search for users by their username.
          </p>
        </div>

        <UserStatsDisplay stats={stats} />

        <SearchForm currentUserId={currentUserId || 0} />
      </div>
    </ProtectedRoute>
  );
}
