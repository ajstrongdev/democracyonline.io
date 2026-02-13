import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getCurrentUserInfo } from "@/lib/server/users";
import {
  getCompanies,
  getSharePriceHistory,
  getUserShares,
  buyShares,
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
import { Button } from "@/components/ui/button";
import {
  Building2,
  Briefcase,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/companies/market")({
  loader: async () => {
    const userData = await getCurrentUserInfo();
    const companiesList = await getCompanies();
    const priceHistory = await getSharePriceHistory();

    let userHoldings: Array<{
      id: number;
      quantity: number | null;
      acquiredAt: Date | null;
      companyId: number;
      companyName: string;
      companySymbol: string;
      stockPrice: number | null;
      companyLogo: string | null;
      companyColor: string | null;
    }> = [];

    if (
      userData &&
      typeof userData === "object" &&
      "id" in userData &&
      userData.id
    ) {
      try {
        userHoldings = await getUserShares();
      } catch (error) {
        console.error("Failed to fetch user holdings:", error);
        userHoldings = [];
      }
    }

    return {
      userData,
      companiesList,
      userHoldings,
      priceHistory,
    };
  },
  component: MarketPage,
});

function HoldingItem({ holding }: { holding: any }) {
  const [sellQty, setSellQty] = useState(1);
  const [isSelling, setIsSelling] = useState(false);
  const navigate = useNavigate();

  let LogoIcon: LucideIcon | null = null;
  if (holding.companyLogo) {
    const iconsMap = LucideIcons as unknown as Record<string, LucideIcon>;
    LogoIcon = iconsMap[holding.companyLogo] || null;
  }

  return (
    <div key={holding.id} className="p-4 rounded-lg border bg-card space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg font-bold text-sm shrink-0"
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
            <span className="text-xs px-2 py-0.5 bg-muted rounded font-mono shrink-0">
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

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-lg font-bold">
              {(holding.quantity || 0).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">Shares</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold">
              ${(holding.stockPrice || 0).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">Price</span>
          </div>
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
              navigate({ to: "/companies/market" });
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
            {isSelling ? "..." : "Sell"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function MarketPage() {
  const { userData, companiesList, userHoldings, priceHistory } =
    Route.useLoaderData();
  const user = useUserData(userData);
  const navigate = useNavigate();
  const [buyQuantities, setBuyQuantities] = useState<Record<number, number>>(
    {},
  );
  const [hiddenCompanies, setHiddenCompanies] = useState<Set<string>>(
    new Set(),
  );

  const toggleCompanyVisibility = (symbol: string) => {
    setHiddenCompanies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(symbol)) {
        newSet.delete(symbol);
      } else {
        newSet.add(symbol);
      }
      return newSet;
    });
  };

  const availableShares = companiesList
    .map((company) => ({
      ...company,
      available: company.availableShares ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ProtectedRoute>
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8 overflow-x-hidden">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-bold">Stock Market</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Trade shares and manage your portfolio
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
              <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-semibold">
                ${Number(user?.money || 0).toLocaleString()}
              </span>
            </div>
            <Button asChild size="sm">
              <Link to="/companies/create">
                <Building2 className="w-4 h-4 mr-2" />
                Create Company
              </Link>
            </Button>
          </div>
        </div>

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
                className="h-[300px] sm:h-[400px] w-full"
              >
                <LineChart
                  height={400}
                  data={(() => {
                    const now = Date.now();
                    const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;

                    // Filter to last 48 hours
                    const recentHistory = priceHistory.filter(
                      (h) =>
                        new Date(h.recordedAt!).getTime() >= fortyEightHoursAgo,
                    );

                    // Get unique timestamps and sort
                    const timestamps = Array.from(
                      new Set(
                        recentHistory.map((h) =>
                          new Date(h.recordedAt!).getTime(),
                        ),
                      ),
                    ).sort((a, b) => a - b);

                    const symbols = Array.from(
                      new Set(recentHistory.map((h) => h.companySymbol)),
                    );

                    const lastPrices: Record<string, number> = {};

                    return timestamps.map((timestamp) => {
                      const point: any = {
                        time: new Date(timestamp).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                        }),
                        timestamp,
                      };

                      // For each company, find price at this timestamp or carry forward last price
                      symbols.forEach((symbol) => {
                        const priceEntry = recentHistory.find(
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
                  {Array.from(new Set(priceHistory.map((h) => h.companySymbol)))
                    .filter((symbol) => !hiddenCompanies.has(symbol))
                    .map((symbol) => {
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
                  const isHidden = hiddenCompanies.has(symbol);
                  return (
                    <button
                      key={symbol}
                      onClick={() => toggleCompanyVisibility(symbol)}
                      className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md transition-all hover:bg-muted/50 ${
                        isHidden ? "opacity-40 line-through" : ""
                      }`}
                      title={isHidden ? "Click to show" : "Click to hide"}
                    >
                      <div
                        className="w-4 h-4 rounded-full transition-opacity"
                        style={{
                          backgroundColor: color,
                          opacity: isHidden ? 0.3 : 1,
                        }}
                      />
                      <span className="font-medium">{symbol}</span>
                      <span className="text-muted-foreground">
                        {company?.companyName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Your Holdings */}
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
                <p className="font-medium">No shares yet</p>
                <p className="text-sm">
                  Start investing in companies to build your portfolio
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

        {/* Available Companies */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <CardTitle>Available Companies</CardTitle>
              </div>
            </div>
            <CardDescription>
              Browse companies available on the stock market
            </CardDescription>
          </CardHeader>
          <CardContent>
            {companiesList.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No companies listed yet</p>
                <p className="text-sm">Be the first to create a company!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableShares.map((company) => {
                  let LogoIcon: LucideIcon | null = null;
                  if (company.logo) {
                    const iconsMap = LucideIcons as unknown as Record<
                      string,
                      LucideIcon
                    >;
                    LogoIcon = iconsMap[company.logo] || null;
                  }

                  // Calculate 24h price change
                  const now = Date.now();
                  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
                  const companyHistory = priceHistory
                    .filter((h) => h.stockId === company.id)
                    .filter(
                      (h) =>
                        new Date(h.recordedAt!).getTime() >= twentyFourHoursAgo,
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.recordedAt!).getTime() -
                        new Date(b.recordedAt!).getTime(),
                    );

                  let priceChange = 0;
                  if (companyHistory.length > 1) {
                    const oldPrice = Number(companyHistory[0].price);
                    const newPrice = Number(
                      companyHistory[companyHistory.length - 1].price,
                    );
                    priceChange = ((newPrice - oldPrice) / oldPrice) * 100;
                  }

                  const maxAffordable =
                    company.stockPrice && company.stockPrice > 0
                      ? Math.floor(
                          Number(user?.money || 0) / company.stockPrice,
                        )
                      : 0;
                  const maxBuyable = Math.min(company.available, maxAffordable);

                  return (
                    <div
                      key={company.id}
                      className="p-4 rounded-lg border bg-card space-y-3"
                    >
                      <Link
                        to="/companies/$id"
                        params={{ id: String(company.id) }}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        <div
                          className="flex items-center justify-center w-10 h-10 rounded-lg font-bold shrink-0"
                          style={{
                            backgroundColor: company.color
                              ? `${company.color}20`
                              : "hsl(var(--primary) / 0.1)",
                            color: company.color || "hsl(var(--primary))",
                          }}
                        >
                          {LogoIcon ? (
                            <LogoIcon className="w-5 h-5" />
                          ) : (
                            company.symbol.slice(0, 2)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">
                              {company.name}
                            </h3>
                            <span className="text-xs px-2 py-0.5 bg-muted rounded font-mono shrink-0">
                              {company.symbol}
                            </span>
                          </div>
                          {company.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {company.description.length > 80
                                ? `${company.description.substring(0, 80)}...`
                                : company.description}
                            </p>
                          )}
                        </div>
                      </Link>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold">
                            ${company.stockPrice?.toLocaleString() ?? "N/A"}
                          </span>
                          {companyHistory.length > 1 ? (
                            <div
                              className={`text-xs flex items-center gap-0.5 ${
                                priceChange === 0
                                  ? "text-muted-foreground"
                                  : priceChange > 0
                                    ? "text-green-600"
                                    : "text-red-600"
                              }`}
                            >
                              {priceChange > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : priceChange < 0 ? (
                                <TrendingDown className="h-3 w-3" />
                              ) : (
                                <TrendingUp className="h-3 w-3" />
                              )}
                              {priceChange > 0 ? "+" : ""}
                              {priceChange.toFixed(1)}%
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Price
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-lg font-semibold">
                            {Number(company.available).toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Available
                          </span>
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-lg font-semibold">
                            {Number(company.issuedShares).toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Total
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border rounded overflow-hidden bg-background">
                          <input
                            type="number"
                            min={1}
                            max={maxBuyable}
                            value={buyQuantities[company.id] || 1}
                            onChange={(e) =>
                              setBuyQuantities({
                                ...buyQuantities,
                                [company.id]: Math.max(
                                  1,
                                  Math.min(Number(e.target.value), maxBuyable),
                                ),
                              })
                            }
                            className="w-14 px-2 py-1.5 text-sm text-center bg-background text-foreground border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            disabled={maxBuyable <= 0}
                          />
                          <div className="flex flex-col border-l">
                            <button
                              type="button"
                              onClick={() =>
                                setBuyQuantities({
                                  ...buyQuantities,
                                  [company.id]: Math.min(
                                    (buyQuantities[company.id] || 1) + 1,
                                    maxBuyable,
                                  ),
                                })
                              }
                              disabled={
                                maxBuyable <= 0 ||
                                (buyQuantities[company.id] || 1) >= maxBuyable
                              }
                              className="px-1 py-0.5 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setBuyQuantities({
                                  ...buyQuantities,
                                  [company.id]: Math.max(
                                    (buyQuantities[company.id] || 1) - 1,
                                    1,
                                  ),
                                })
                              }
                              disabled={
                                maxBuyable <= 0 ||
                                (buyQuantities[company.id] || 1) <= 1
                              }
                              className="px-1 py-0.5 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-t"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={maxBuyable <= 0}
                          className="flex-1"
                          onClick={async (e) => {
                            e.preventDefault();
                            const quantity = buyQuantities[company.id] || 1;
                            const totalCost =
                              (company.stockPrice || 0) * quantity;

                            if (Number(user?.money) < totalCost) {
                              toast.error(
                                `Insufficient funds. Need $${totalCost.toLocaleString()}.`,
                              );
                              return;
                            }

                            await buyShares({
                              data: { companyId: company.id, quantity },
                            })
                              .then(() => {
                                toast.success(
                                  `Bought ${quantity} share${quantity > 1 ? "s" : ""} of ${company.symbol} for $${totalCost.toLocaleString()}`,
                                );
                                navigate({ to: "/companies/market" });
                              })
                              .catch((err) => {
                                toast.error(
                                  err?.message || "Failed to buy shares.",
                                );
                              });
                          }}
                        >
                          {company.available <= 0
                            ? "Sold Out"
                            : maxBuyable <= 0
                              ? "No Funds"
                              : `Buy · $${((company.stockPrice || 0) * (buyQuantities[company.id] || 1)).toLocaleString()}`}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
