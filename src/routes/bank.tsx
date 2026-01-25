import { createFileRoute, Link } from "@tanstack/react-router";
import {
  getCurrentUserInfo,
  getTopRichestUsers,
  getUserTransactionHistory,
} from "@/lib/server/users";
import { useUserData } from "@/lib/hooks/use-user-data";
import ProtectedRoute from "@/components/auth/protected-route";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Landmark, Wallet, Clock, TrendingUp, Crown } from "lucide-react";
import PartyLogo from "@/components/party-logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bank")({
  loader: async () => {
    const userData = await getCurrentUserInfo();
    const richestUsers = await getTopRichestUsers();

    let transactions: Array<{
      id: number;
      description: string | null;
      createdAt: Date | null;
    }> = [];
    if (
      userData &&
      typeof userData === "object" &&
      "id" in userData &&
      userData.id
    ) {
      try {
        transactions = await getUserTransactionHistory({
          data: { userId: userData.id },
        });
      } catch (error) {
        console.error("Failed to fetch transaction history:", error);
        transactions = [];
      }
    }

    return { userData, richestUsers, transactions };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { userData, richestUsers, transactions } = Route.useLoaderData();
  const user = useUserData(userData);

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4 max-w-6xl space-y-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Landmark className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">The Bank</h1>
          </div>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Account Balance
            </CardTitle>
            <CardDescription>Welcome back, {user?.username}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Available Balance
                </p>
                <p className="text-5xl font-bold tracking-tight">
                  ${Number(user?.money || 0).toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 border rounded-lg bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    <p className="text-sm font-medium">Member Since</p>
                  </div>
                  <p className="text-lg font-semibold">
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>

                <div className="p-5 border rounded-lg bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Landmark className="w-4 h-4" />
                    <p className="text-sm font-medium">Account ID</p>
                  </div>
                  <p className="text-lg font-semibold">#{user?.id}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your latest account activity</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No transactions yet</p>
                <p className="text-sm">
                  Your transaction history will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-start justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {transaction.createdAt
                          ? new Date(transaction.createdAt).toLocaleString()
                          : "Unknown date"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <CardTitle>Wealth Leaderboard</CardTitle>
            </div>
            <CardDescription>Top 10 richest citizens</CardDescription>
          </CardHeader>
          <CardContent className="px-2 md:px-6">
            <div className="space-y-3 md:space-y-4">
              {richestUsers.map((richUser, index) => (
                <div
                  key={richUser.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg border bg-card transition-colors"
                >
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div
                      className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full font-bold text-base md:text-lg shrink-0 ${
                        index === 0
                          ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-500"
                          : index === 1
                            ? "bg-slate-400/20 text-slate-600 dark:text-slate-400"
                            : index === 2
                              ? "bg-orange-600/20 text-orange-700 dark:text-orange-500"
                              : "bg-muted"
                      }`}
                    >
                      {index === 0 ? (
                        <Crown className="w-5 h-5 md:w-6 md:h-6" />
                      ) : (
                        `#${index + 1}`
                      )}
                    </div>

                    {richUser.partyId && (
                      <>
                        <div className="shrink-0 sm:hidden md:block">
                          <PartyLogo party_id={richUser.partyId} size={40} />
                        </div>
                        <div className="hidden sm:block md:hidden">
                          <PartyLogo party_id={richUser.partyId} size={48} />
                        </div>
                      </>
                    )}

                    {/* User info - shows next to rank on mobile */}
                    <div className="flex-1 min-w-0 sm:hidden">
                      <h3 className="font-semibold text-base truncate">
                        {richUser.username}
                      </h3>
                      {richUser.politicalLeaning && (
                        <p className="text-xs text-muted-foreground">
                          {richUser.politicalLeaning}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* User info - separate on desktop */}
                  <div className="hidden sm:block sm:flex-1 min-w-0">
                    <h3 className="font-semibold text-base md:text-lg truncate">
                      {richUser.username}
                    </h3>
                    {richUser.politicalLeaning && (
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {richUser.politicalLeaning}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between w-full sm:w-auto gap-3 sm:gap-4">
                    <div className="flex flex-col items-start sm:items-end">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                        <span className="text-xl md:text-2xl font-bold">
                          ${Number(richUser.money || 0).toLocaleString()}
                        </span>
                      </div>
                      <span className="text-[10px] md:text-xs text-muted-foreground">
                        Net Worth
                      </span>
                    </div>

                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      <Link
                        to="/profile/$id"
                        params={{ id: richUser.id.toString() }}
                      >
                        View Profile
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
