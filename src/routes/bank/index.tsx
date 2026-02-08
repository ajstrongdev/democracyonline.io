import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  getCurrentUserInfo,
  getTopRichestUsers,
  getUserTransactionHistory,
} from "@/lib/server/users";
import {
  buyShares,
  getCompanies,
  getUserShares,
  getSharePriceHistory,
} from "@/lib/server/stocks";
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Landmark,
  Wallet,
  Clock,
  TrendingUp,
  Crown,
  Building2,
  Plus,
  DollarSign,
  BarChart3,
  Briefcase,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import PartyLogo from "@/components/party-logo";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/bank/")({
  loader: async () => {
    const userData = await getCurrentUserInfo();
    const richestUsers = await getTopRichestUsers();
    const companiesList = await getCompanies();
    const priceHistory = await getSharePriceHistory();

    let transactions: Array<{
      id: number;
      description: string | null;
      createdAt: Date | null;
    }> = [];
    let userHoldings: Array<{
      id: number;
      quantity: number | null;
      acquiredAt: Date | null;
      companyId: number;
      companyName: string;
      companySymbol: string;
      stockPrice: number | null;
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

      try {
        userHoldings = await getUserShares();
      } catch (error) {
        console.error("Failed to fetch user holdings:", error);
        userHoldings = [];
      }
    }

    return {
      userData,
      richestUsers,
      transactions,
      companiesList,
      userHoldings,
      priceHistory,
    };
  },
  component: RouteComponent,
});

function HoldingItem({ holding }: { holding: any }) {
  const [sellQty, setSellQty] = useState(1);
  const [isSelling, setIsSelling] = useState(false);
  const navigate = useNavigate();

  // Get logo icon component
  let LogoIcon: LucideIcon | null = null;
  if (holding.companyLogo) {
    const iconsMap = LucideIcons as unknown as Record<string, LucideIcon>;
    LogoIcon = iconsMap[holding.companyLogo] || null;
  }

  return (
    <div
      key={holding.id}
      className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg border bg-card"
    >
      <div className="flex items-center gap-4 w-full sm:w-auto">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg font-bold text-sm"
          style={{
            backgroundColor: holding.companyColor
              ? `${holding.companyColor}20`
              : "hsl(var(--primary) / 0.1)",
            color: holding.companyColor || "hsl(var(--primary))",
          }}
        >
          {LogoIcon ? (
            <LogoIcon className="w-5 h-5" />
          ) : (
            holding.companySymbol.slice(0, 2)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{holding.companyName}</h3>
            <span className="text-xs px-2 py-0.5 bg-muted rounded font-mono">
              {holding.companySymbol}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Acquired{" "}
            {holding.acquiredAt
              ? new Date(holding.acquiredAt).toLocaleDateString()
              : "N/A"}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto sm:ml-auto">
        <div className="flex flex-col items-start sm:items-end">
          <span className="text-lg font-bold">
            {(holding.quantity || 0).toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">Shares</span>
        </div>
        <div className="flex flex-col items-start sm:items-end">
          <span className="text-lg font-bold flex items-center gap-1">
            <span className="text-muted-foreground text-base">$</span>
            {(holding.stockPrice || 0).toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">Share Price</span>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!holding.companyId || !sellQty || sellQty < 1) return;
            setIsSelling(true);
            try {
              const mod = await import("@/lib/server/stocks");
              await mod.sellShares({
                data: {
                  companyId: holding.companyId,
                  quantity: sellQty,
                },
              });
              toast.success(
                `Sold ${sellQty} share${sellQty > 1 ? "s" : ""} of ${holding.companySymbol}`,
              );
              navigate({ to: "/bank" });
            } catch (err) {
              const msg =
                typeof err === "object" && err && "message" in err
                  ? (err as any).message
                  : undefined;
              toast.error(msg || "Failed to sell shares.");
            } finally {
              setIsSelling(false);
            }
          }}
        >
          <div className="flex items-center border rounded overflow-hidden bg-background">
            <input
              type="number"
              min={1}
              max={holding.quantity || 1}
              value={sellQty}
              onChange={(e) => setSellQty(Number(e.target.value))}
              className="w-14 px-2 py-1.5 text-sm text-center bg-background text-foreground border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              disabled={isSelling}
            />
            <div className="flex flex-col border-l">
              <button
                type="button"
                onClick={() =>
                  setSellQty((prev) =>
                    Math.min(prev + 1, holding.quantity || 1),
                  )
                }
                disabled={isSelling || sellQty >= (holding.quantity || 1)}
                className="px-1 py-0.5 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setSellQty((prev) => Math.max(prev - 1, 1))}
                disabled={isSelling || sellQty <= 1}
                className="px-1 py-0.5 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-t"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={isSelling || (holding.quantity || 0) < 1}
          >
            {isSelling ? "Selling..." : "Sell"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function RouteComponent() {
  const {
    userData,
    richestUsers,
    transactions: initialTransactions,
    companiesList,
    userHoldings,
    priceHistory,
  } = Route.useLoaderData();
  const user = useUserData(userData);
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState(initialTransactions);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialTransactions.length === 10);

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

  // Calculate available shares to purchase for each company
  // availableShares: [{...company, available: issuedShares - total user shares for that company}]
  const availableShares = companiesList
    .map((company) => {
      // Sum all user shares for this company
      const totalUserShares = userHoldings
        .filter((share) => share.companyId === company.id)
        .reduce((sum, share) => sum + (share.quantity || 0), 0);
      return {
        ...company,
        available: (company.issuedShares || 0) - totalUserShares,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

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
            <TabsTrigger value="stocks" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Stock Market
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

          <TabsContent value="stocks" className="space-y-8">
            {/* Share Price History Chart */}
            {priceHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <CardTitle>Share Price History</CardTitle>
                  </div>
                  <CardDescription>
                    Price movements of listed companies in the last 48 hours.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      ...Object.fromEntries(
                        Array.from(
                          new Set(priceHistory.map((h) => h.companySymbol)),
                        ).map((symbol) => {
                          const company = priceHistory.find(
                            (h) => h.companySymbol === symbol,
                          );
                          return [
                            symbol,
                            {
                              label: symbol,
                              color: company?.companyColor || "#3b82f6",
                            },
                          ];
                        }),
                      ),
                    }}
                    className="h-[400px] w-full"
                  >
                    <LineChart
                      width={800}
                      height={400}
                      data={(() => {
                        const timestamps = Array.from(
                          new Set(
                            priceHistory.map((h) =>
                              new Date(h.recordedAt!).getTime(),
                            ),
                          ),
                        )
                          .sort((a, b) => a - b)
                          .slice(-48);

                        const symbols = Array.from(
                          new Set(priceHistory.map((h) => h.companySymbol)),
                        );

                        const lastPrices: Record<string, number> = {};

                        return timestamps.map((timestamp) => {
                          const point: any = {
                            time: new Date(timestamp).toLocaleString(),
                            timestamp,
                          };

                          // For each company, find price at this timestamp or carry forward last price
                          symbols.forEach((symbol) => {
                            const priceEntry = priceHistory.find(
                              (h) =>
                                h.companySymbol === symbol &&
                                new Date(h.recordedAt!).getTime() === timestamp,
                            );

                            if (priceEntry) {
                              // Update with new price
                              lastPrices[symbol] = Number(priceEntry.price);
                            }

                            // Always set the price (either new or carried forward)
                            if (lastPrices[symbol] !== undefined) {
                              point[symbol] = lastPrices[symbol];
                            }
                          });

                          return point;
                        });
                      })()}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />
                      <XAxis dataKey="time" hide />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        domain={["auto", "auto"]}
                        label={{
                          value: "Price ($)",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {Array.from(
                        new Set(priceHistory.map((h) => h.companySymbol)),
                      ).map((symbol) => {
                        const company = priceHistory.find(
                          (h) => h.companySymbol === symbol,
                        );
                        const color = company?.companyColor || "#3b82f6";
                        return (
                          <Line
                            key={symbol}
                            type="monotone"
                            dataKey={symbol}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </ChartContainer>
                  <div className="flex flex-wrap gap-4 mt-4 justify-center">
                    {Array.from(
                      new Set(priceHistory.map((h) => h.companySymbol)),
                    ).map((symbol) => {
                      const company = priceHistory.find(
                        (h) => h.companySymbol === symbol,
                      );
                      const color = company?.companyColor || "#3b82f6";
                      return (
                        <div
                          key={symbol}
                          className="flex items-center gap-2 text-sm"
                        >
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{
                              backgroundColor: color,
                            }}
                          />
                          <span className="font-medium">{symbol}</span>
                          <span className="text-muted-foreground">
                            {company?.companyName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  <CardTitle>Your Holdings</CardTitle>
                </div>
                <CardDescription>
                  Shares you own in listed companies
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userHoldings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No holdings yet</p>
                    <p className="text-sm">
                      Create a company or buy shares to get started
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userHoldings.map((holding) => (
                      <HoldingItem key={holding.id} holding={holding} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    <CardTitle>Listed Companies</CardTitle>
                  </div>
                  <Button asChild>
                    <Link to="/bank/create">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Company
                    </Link>
                  </Button>
                </div>
                <CardDescription>
                  Browse companies available on the stock market
                </CardDescription>
              </CardHeader>
              <CardContent>
                {companiesList.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No companies yet</p>
                    <p className="text-sm">Be the first to create a company!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {availableShares.map((company) => {
                      // Get logo icon component
                      let LogoIcon: LucideIcon | null = null;
                      if (company.logo) {
                        const iconsMap = LucideIcons as unknown as Record<
                          string,
                          LucideIcon
                        >;
                        LogoIcon = iconsMap[company.logo] || null;
                      }

                      return (
                        <div
                          key={company.id}
                          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div
                              className="flex items-center justify-center w-12 h-12 rounded-lg font-bold"
                              style={{
                                backgroundColor: company.color
                                  ? `${company.color}20`
                                  : "hsl(var(--primary) / 0.1)",
                                color: company.color || "hsl(var(--primary))",
                              }}
                            >
                              {LogoIcon ? (
                                <LogoIcon className="w-6 h-6" />
                              ) : (
                                company.symbol.slice(0, 2)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold truncate">
                                  {company.name}
                                </h3>
                                <span className="text-xs px-2 py-0.5 bg-muted rounded font-mono">
                                  {company.symbol}
                                </span>
                              </div>
                              {company.description && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {company.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto sm:ml-auto">
                            <div className="grid grid-cols-3 gap-3 sm:flex sm:gap-4">
                              <div className="flex flex-col items-center sm:items-end">
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-lg sm:text-xl font-bold">
                                    {company.stockPrice?.toLocaleString() ??
                                      "N/A"}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground text-center sm:text-right">
                                  Price
                                </span>
                              </div>

                              <div className="flex flex-col items-center sm:items-end">
                                <span className="text-lg sm:text-lg font-semibold">
                                  {Number(company.available).toLocaleString()}
                                </span>
                                <span className="text-xs text-muted-foreground text-center sm:text-right">
                                  Available
                                </span>
                              </div>

                              <div className="flex flex-col items-center sm:items-end">
                                <span className="text-lg sm:text-lg font-semibold">
                                  {Number(
                                    company.issuedShares,
                                  ).toLocaleString()}
                                </span>
                                <span className="text-xs text-muted-foreground text-center sm:text-right">
                                  Total
                                </span>
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={company.available <= 0}
                              className="w-full sm:w-auto"
                              onClick={async () => {
                                if (
                                  Number(user?.money) <
                                  (company.stockPrice || 0)
                                ) {
                                  toast.error(
                                    "Insufficient funds to buy a share.",
                                  );
                                  return;
                                }
                                await buyShares({
                                  data: { companyId: company.id },
                                })
                                  .then(() => navigate({ to: "/bank" }))
                                  .catch((err) => {
                                    toast.error(
                                      err?.message || "Failed to buy share.",
                                    );
                                  });
                              }}
                            >
                              {company.available <= 0 ? "Sold Out" : "Buy"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}
