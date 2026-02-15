import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownUp,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  ListOrdered,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getCurrentUserInfo } from "@/lib/server/users";
import {
  buyShares,
  getCompanies,
  getSharePriceHistory,
  getUserShares,
  getUserOrders,
  cancelOrder,
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
import { BackButton } from "@/components/back-button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

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

    let userOrdersList: Array<{
      id: number;
      companyId: number;
      side: string;
      quantity: number;
      filledQuantity: number;
      pricePerShare: number;
      status: string;
      createdAt: Date | null;
      companyName: string;
      companySymbol: string;
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
      try {
        userOrdersList = await getUserOrders();
      } catch (error) {
        console.error("Failed to fetch user orders:", error);
        userOrdersList = [];
      }
    }

    return {
      userData,
      companiesList,
      userHoldings,
      userOrdersList,
      priceHistory,
    };
  },
  component: MarketPage,
});

// ─── Order Status Badge ─────────────────────────────────────────────────────

function OrderStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "open":
      return (
        <Badge
          variant="outline"
          className="text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-800"
        >
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case "partial":
      return (
        <Badge
          variant="outline"
          className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800"
        >
          <ArrowDownUp className="w-3 h-3 mr-1" />
          Partial
        </Badge>
      );
    case "filled":
      return (
        <Badge variant="default" className="bg-green-600">
          Filled
        </Badge>
      );
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Holding Item ────────────────────────────────────────────────────────────

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
    <div className="p-4 rounded-lg border bg-card space-y-3">
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
          <div className="flex flex-col">
            <span className="text-lg font-bold text-muted-foreground">
              $
              {(
                (holding.quantity || 0) * (holding.stockPrice || 0)
              ).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">Value</span>
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
                `Sell order placed for ${sellQty} share${sellQty > 1 ? "s" : ""} of ${holding.companySymbol}`,
              );
              navigate({ to: "/companies/market" });
            } catch (err) {
              const msg =
                typeof err === "object" && err && "message" in err
                  ? (err as any).message
                  : undefined;
              toast.error(msg || "Failed to place sell order.");
            } finally {
              setIsSelling(false);
            }
          }}
        >
          <div className="flex items-center border rounded overflow-hidden bg-background">
            <input
              type="number"
              min={1}
              max={Math.min(5, holding.quantity || 1)}
              value={sellQty}
              onChange={(e) =>
                setSellQty(Math.min(5, Math.max(1, Number(e.target.value))))
              }
              className="w-14 px-2 py-1.5 text-sm text-center bg-background text-foreground border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              disabled={isSelling}
            />
            <div className="flex flex-col border-l">
              <button
                type="button"
                onClick={() =>
                  setSellQty((prev) =>
                    Math.min(prev + 1, 5, holding.quantity || 1),
                  )
                }
                disabled={
                  isSelling || sellQty >= Math.min(5, holding.quantity || 1)
                }
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

// ─── Order Item ──────────────────────────────────────────────────────────────

function OrderItem({
  order,
  onCancel,
}: {
  order: any;
  onCancel: (orderId: number) => void;
}) {
  const [isCancelling, setIsCancelling] = useState(false);

  let LogoIcon: LucideIcon | null = null;
  if (order.companyLogo) {
    const iconsMap = LucideIcons as unknown as Record<string, LucideIcon>;
    LogoIcon = iconsMap[order.companyLogo] || null;
  }

  const remaining = order.quantity - order.filledQuantity;
  const progress =
    order.quantity > 0 ? (order.filledQuantity / order.quantity) * 100 : 0;
  const isBuy = order.side === "buy";
  const canCancel = order.status === "open" || order.status === "partial";

  return (
    <div className="p-4 rounded-lg border bg-card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg font-bold text-sm shrink-0"
            style={{
              backgroundColor: order.companyColor
                ? `${order.companyColor}20`
                : "hsl(var(--primary) / 0.1)",
              color: order.companyColor || "hsl(var(--primary))",
            }}
          >
            {LogoIcon ? (
              <LogoIcon className="w-5 h-5" />
            ) : (
              order.companySymbol?.slice(0, 2)
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge
                variant={isBuy ? "default" : "destructive"}
                className="text-[10px] uppercase tracking-wider"
              >
                {order.side}
              </Badge>
              <h3 className="font-semibold truncate">{order.companyName}</h3>
              <span className="text-xs px-2 py-0.5 bg-muted rounded font-mono shrink-0">
                {order.companySymbol}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {order.createdAt
                ? new Date(order.createdAt).toLocaleString()
                : "N/A"}
            </p>
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-bold">
            {order.filledQuantity}/{order.quantity}
          </p>
          <p className="text-xs text-muted-foreground">Filled</p>
        </div>
        <div>
          <p className="text-lg font-bold">
            ${order.pricePerShare?.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">Price/Share</p>
        </div>
        <div>
          <p className="text-lg font-bold">
            ${(order.quantity * order.pricePerShare).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
      </div>

      {/* Fill progress bar */}
      {(order.status === "open" || order.status === "partial") && (
        <div className="space-y-1">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isBuy ? "bg-primary" : "bg-destructive"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {remaining} share{remaining !== 1 ? "s" : ""} remaining
          </p>
        </div>
      )}

      {canCancel && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isCancelling}
          onClick={async () => {
            setIsCancelling(true);
            try {
              onCancel(order.id);
            } finally {
              setIsCancelling(false);
            }
          }}
        >
          <X className="w-3 h-3 mr-1" />
          {isCancelling ? "Cancelling..." : "Cancel Order"}
        </Button>
      )}
    </div>
  );
}

// ─── Market Page ─────────────────────────────────────────────────────────────

function MarketPage() {
  const {
    userData,
    companiesList,
    userHoldings,
    userOrdersList,
    priceHistory,
  } = Route.useLoaderData();
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

  const handleCancelOrder = async (orderId: number) => {
    try {
      await cancelOrder({ data: { orderId } });
      toast.success("Order cancelled successfully");
      navigate({ to: "/companies/market" });
    } catch (err) {
      const msg =
        typeof err === "object" && err && "message" in err
          ? (err as any).message
          : undefined;
      toast.error(msg || "Failed to cancel order");
    }
  };

  const availableShares = companiesList
    .map((company) => ({
      ...company,
      available: company.availableShares ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeOrders = userOrdersList.filter(
    (o) => o.status === "open" || o.status === "partial",
  );
  const completedOrders = userOrdersList.filter(
    (o) => o.status === "filled" || o.status === "cancelled",
  );

  return (
    <ProtectedRoute>
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8 overflow-x-hidden">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-bold">Stock Market</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Place buy &amp; sell orders
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
              <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-semibold">
                ${Number(user?.money || 0).toLocaleString()}
              </span>
            </div>
            {activeOrders.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {activeOrders.length} active order
                  {activeOrders.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            <Button asChild size="sm">
              <Link to="/companies/create">
                <Building2 className="w-4 h-4 mr-2" />
                Create Company
              </Link>
            </Button>
          </div>

          {/* Info Banner */}
          <div className="rounded-lg bg-muted/50 border p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>How it works:</strong> Buy &amp; sell orders are queued
              and matched every hour. Shares must be bought from another player
              (not yourself) to increase the share price. Sellers receive
              payment only when their shares are purchased. Buy order funds are
              escrowed until filled or cancelled.
            </p>
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

                    const recentHistory = priceHistory.filter(
                      (h) =>
                        new Date(h.recordedAt!).getTime() >= fortyEightHoursAgo,
                    );

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

                      symbols.forEach((symbol) => {
                        const priceEntry = recentHistory.find(
                          (h) =>
                            h.companySymbol === symbol &&
                            new Date(h.recordedAt!).getTime() === timestamp,
                        );

                        if (priceEntry) {
                          lastPrices[symbol] = Number(priceEntry.price);
                        }

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

        {/* Orders & Holdings in Tabs */}
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="orders" className="gap-1.5">
              <ListOrdered className="w-4 h-4" />
              <span className="hidden sm:inline">My Orders</span>
              <span className="sm:hidden">Orders</span>
              {activeOrders.length > 0 && (
                <Badge
                  variant="default"
                  className="ml-1 text-[10px] px-1.5 py-0"
                >
                  {activeOrders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="holdings" className="gap-1.5">
              <Briefcase className="w-4 h-4" />
              <span className="hidden sm:inline">Holdings</span>
              <span className="sm:hidden">Hold</span>
              {userHoldings.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 text-[10px] px-1.5 py-0"
                >
                  {userHoldings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="market" className="gap-1.5">
              <ShoppingCart className="w-4 h-4" />
              Market
            </TabsTrigger>
          </TabsList>

          {/* ─── Orders Tab ─────────────────────────────────────────── */}
          <TabsContent value="orders" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-primary" />
                  <CardTitle>Your Orders</CardTitle>
                </div>
                <CardDescription>
                  Buy &amp; sell orders are matched hourly. Orders execute in
                  queue order (FIFO).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Active Orders */}
                {activeOrders.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Active Orders
                    </h3>
                    {activeOrders.map((order) => (
                      <OrderItem
                        key={order.id}
                        order={order}
                        onCancel={handleCancelOrder}
                      />
                    ))}
                  </div>
                )}

                {activeOrders.length > 0 && completedOrders.length > 0 && (
                  <Separator />
                )}

                {/* Completed / Cancelled Orders */}
                {completedOrders.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Order History
                    </h3>
                    {completedOrders.slice(0, 10).map((order) => (
                      <OrderItem
                        key={order.id}
                        order={order}
                        onCancel={handleCancelOrder}
                      />
                    ))}
                  </div>
                )}

                {userOrdersList.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListOrdered className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No orders yet</p>
                    <p className="text-sm">
                      Place a buy or sell order from the Market tab
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Holdings Tab ───────────────────────────────────────── */}
          <TabsContent value="holdings" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  <CardTitle>Your Holdings</CardTitle>
                </div>
                <CardDescription>
                  Shares you own — sell to place a sell order (filled hourly)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userHoldings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No shares yet</p>
                    <p className="text-sm">
                      Place a buy order to start building your portfolio
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userHoldings.map((holding) => (
                      <HoldingItem key={holding.id} holding={holding} />
                    ))}

                    {/* Portfolio summary */}
                    <Separator className="my-4" />
                    <div className="flex items-center justify-between px-2">
                      <span className="text-sm text-muted-foreground font-medium">
                        Total Portfolio Value
                      </span>
                      <span className="text-lg font-bold">
                        $
                        {userHoldings
                          .reduce(
                            (sum, h) =>
                              sum + (h.quantity || 0) * (h.stockPrice || 0),
                            0,
                          )
                          .toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Market Tab (Buy) ───────────────────────────────────── */}
          <TabsContent value="market" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    <CardTitle>Available Companies</CardTitle>
                  </div>
                </div>
                <CardDescription>
                  Place buy orders — funds are escrowed until the order is
                  filled
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
                            new Date(h.recordedAt!).getTime() >=
                            twentyFourHoursAgo,
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

                      const currentBuyQty = buyQuantities[company.id] || 1;
                      const totalCost =
                        (company.stockPrice || 0) * currentBuyQty;
                      const canAfford = Number(user?.money || 0) >= totalCost;

                      // Count user's pending buy orders for this company
                      const pendingBuyOrders = userOrdersList.filter(
                        (o) =>
                          o.companyId === company.id &&
                          o.side === "buy" &&
                          (o.status === "open" || o.status === "partial"),
                      );
                      const pendingBuyQty = pendingBuyOrders.reduce(
                        (sum, o) => sum + (o.quantity - o.filledQuantity),
                        0,
                      );

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

                          {/* Pending buy orders indicator */}
                          {pendingBuyQty > 0 && (
                            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 rounded-md px-3 py-1.5">
                              <Clock className="w-3 h-3" />
                              You have {pendingBuyQty} share
                              {pendingBuyQty !== 1 ? "s" : ""} pending in buy
                              orders
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <div className="flex items-center border rounded overflow-hidden bg-background">
                              <input
                                type="number"
                                min={1}
                                max={5}
                                value={currentBuyQty}
                                onChange={(e) =>
                                  setBuyQuantities({
                                    ...buyQuantities,
                                    [company.id]: Math.min(
                                      5,
                                      Math.max(1, Number(e.target.value)),
                                    ),
                                  })
                                }
                                className="w-14 px-2 py-1.5 text-sm text-center bg-background text-foreground border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <div className="flex flex-col border-l">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setBuyQuantities({
                                      ...buyQuantities,
                                      [company.id]: Math.min(
                                        5,
                                        currentBuyQty + 1,
                                      ),
                                    })
                                  }
                                  disabled={currentBuyQty >= 5}
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
                                        1,
                                        currentBuyQty - 1,
                                      ),
                                    })
                                  }
                                  disabled={currentBuyQty <= 1}
                                  className="px-1 py-0.5 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-t"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!canAfford}
                              className="flex-1"
                              onClick={async (e) => {
                                e.preventDefault();

                                if (!canAfford) {
                                  toast.error(
                                    `Insufficient funds. Need $${totalCost.toLocaleString()}.`,
                                  );
                                  return;
                                }

                                await buyShares({
                                  data: {
                                    companyId: company.id,
                                    quantity: currentBuyQty,
                                  },
                                })
                                  .then(() => {
                                    toast.success(
                                      `Buy order placed for ${currentBuyQty} share${currentBuyQty > 1 ? "s" : ""} of ${company.symbol} ($${totalCost.toLocaleString()} escrowed)`,
                                    );
                                    navigate({
                                      to: "/companies/market",
                                    });
                                  })
                                  .catch((err) => {
                                    toast.error(
                                      err?.message ||
                                        "Failed to place buy order.",
                                    );
                                  });
                              }}
                            >
                              {!canAfford
                                ? "No Funds"
                                : `Buy Order · $${totalCost.toLocaleString()}`}
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
