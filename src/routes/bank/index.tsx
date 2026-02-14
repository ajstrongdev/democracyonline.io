import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRightLeft,
  Clock,
  Crown,
  Landmark,
  Send,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCurrentUserInfo,
  getTopRichestUsers,
  getUserTransactionHistory,
  transferMoney,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PartyLogo from "@/components/party-logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bank/")({
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
          data: { userId: userData.id, limit: 10, offset: 0 },
        });
      } catch (error) {
        console.error("Failed to fetch transaction history:", error);
        transactions = [];
      }
    }

    return {
      userData,
      richestUsers,
      transactions,
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const {
    userData,
    richestUsers,
    transactions: initialTransactions,
  } = Route.useLoaderData();
  const user = useUserData(userData);
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState(initialTransactions);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialTransactions.length === 10);

  const [recipientUsername, setRecipientUsername] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  const loadMoreTransactions = async () => {
    if (
      !userData ||
      typeof userData !== "object" ||
      !("id" in userData) ||
      !userData.id
    )
      return;

    setIsLoadingMore(true);
    try {
      const moreTransactions = await getUserTransactionHistory({
        data: { userId: userData.id, limit: 10, offset: transactions.length },
      });

      setTransactions([...transactions, ...moreTransactions]);
      setHasMore(moreTransactions.length === 10);
    } catch (error) {
      console.error("Failed to load more transactions:", error);
      toast.error("Failed to load more transactions");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(transferAmount);
    if (!recipientUsername || !amount || amount <= 0) {
      toast.error("Please enter a valid username and amount");
      return;
    }

    if (amount > (user?.money || 0)) {
      toast.error("Insufficient funds");
      return;
    }

    setIsTransferring(true);
    try {
      await transferMoney({
        data: {
          recipientUsername,
          amount,
        },
      });

      toast.success(
        `Successfully sent $${amount.toLocaleString()} to ${recipientUsername}`,
      );
      setRecipientUsername("");
      setTransferAmount("");
      navigate({ to: "/bank" });
    } catch (err) {
      const msg =
        typeof err === "object" && err && "message" in err
          ? (err as any).message
          : undefined;
      toast.error(msg || "Failed to transfer money");
    } finally {
      setIsTransferring(false);
    }
  };

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

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="account" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="transfer" className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Transfer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-8">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Account Balance
                </CardTitle>
                <CardDescription>
                  Welcome back, {user?.username}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="p-8 bg-linear-to-br from-primary/5 to-primary/10 rounded-lg border">
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
                    {hasMore && (
                      <Button
                        onClick={loadMoreTransactions}
                        disabled={isLoadingMore}
                        variant="outline"
                        className="w-full"
                      >
                        {isLoadingMore ? "Loading..." : "Load More"}
                      </Button>
                    )}
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
                              <PartyLogo
                                party_id={richUser.partyId}
                                size={40}
                              />
                            </div>
                            <div className="hidden sm:block md:hidden">
                              <PartyLogo
                                party_id={richUser.partyId}
                                size={48}
                              />
                            </div>
                          </>
                        )}

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
          </TabsContent>

          <TabsContent value="transfer" className="space-y-8">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-primary" />
                  <CardTitle>Transfer Money</CardTitle>
                </div>
                <CardDescription>Send money to another player</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTransfer} className="space-y-6">
                  <div className="p-6 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Your Balance
                      </span>
                      <span className="text-2xl font-bold">
                        ${Number(user?.money || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="recipient"
                        className="text-sm font-medium"
                      >
                        Recipient Username
                      </label>
                      <input
                        id="recipient"
                        type="text"
                        value={recipientUsername}
                        onChange={(e) => setRecipientUsername(e.target.value)}
                        placeholder="Enter username"
                        className="w-full px-3 py-2 border rounded-lg bg-background"
                        disabled={isTransferring}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="amount" className="text-sm font-medium">
                        Amount ($)
                      </label>
                      <input
                        id="amount"
                        type="number"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                        className="w-full px-3 py-2 border rounded-lg bg-background"
                        disabled={isTransferring}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      isTransferring || !recipientUsername || !transferAmount
                    }
                    className="w-full"
                    size="lg"
                  >
                    {isTransferring ? (
                      "Transferring..."
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send $
                        {parseFloat(transferAmount || "0").toLocaleString()}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}
