import { Link, createFileRoute } from "@tanstack/react-router";
import { Building2, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getCurrentUserInfo } from "@/lib/server/users";
import {
  getCompanies,
  getSharePriceHistory,
  getUserShares,
} from "@/lib/server/stocks";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateMarketCap } from "@/lib/utils/stock-economy";

export const Route = createFileRoute("/companies/")({
  component: CompaniesPage,
  loader: async () => {
    const companies = await getCompanies();
    const priceHistory = await getSharePriceHistory();
    const userData = await getCurrentUserInfo();

    let userHoldings: Array<{
      id: number;
      quantity: number | null;
      companyId: number;
    }> = [];

    if (
      userData &&
      typeof userData === "object" &&
      "id" in userData &&
      userData.id
    ) {
      try {
        userHoldings = await getUserShares();
      } catch {
        userHoldings = [];
      }
    }

    return { companies, priceHistory, userHoldings };
  },
});

function CompaniesPage() {
  const { companies, priceHistory, userHoldings } = Route.useLoaderData();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [filterHoldings, setFilterHoldings] = useState(false);

  const heldCompanyIds = useMemo(
    () =>
      new Set(
        userHoldings
          .filter((h) => (h.quantity || 0) > 0)
          .map((h) => h.companyId),
      ),
    [userHoldings],
  );

  // Pre-compute derived data for each company
  const enrichedCompanies = useMemo(() => {
    return companies.map((company) => {
      const marketCap = calculateMarketCap({
        sharePrice: company.stockPrice,
        issuedShares: company.issuedShares,
      });

      const companyHistory = priceHistory.filter(
        (h) => h.stockId === company.id,
      );
      const now = Date.now();
      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
      const last24Hours = companyHistory
        .filter((h) => new Date(h.recordedAt!).getTime() >= twentyFourHoursAgo)
        .sort(
          (a, b) =>
            new Date(a.recordedAt!).getTime() -
            new Date(b.recordedAt!).getTime(),
        );

      const chartData = last24Hours.map((h) => ({
        time: new Date(h.recordedAt!).getTime(),
        price: h.price,
      }));

      let priceChange = 0;
      if (chartData.length > 1) {
        const oldPrice = chartData[0].price;
        const newPrice = chartData[chartData.length - 1].price;
        priceChange = ((newPrice - oldPrice) / oldPrice) * 100;
      }

      let LogoIcon: LucideIcon | null = null;
      if (company.logo) {
        const iconsMap = LucideIcons as unknown as Record<string, LucideIcon>;
        LogoIcon = iconsMap[company.logo] || null;
      }

      return { company, marketCap, chartData, priceChange, LogoIcon };
    });
  }, [companies, priceHistory]);

  // Filter & sort
  const filteredCompanies = useMemo(() => {
    let result = enrichedCompanies;

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        ({ company }) =>
          company.name.toLowerCase().includes(q) ||
          company.symbol.toLowerCase().includes(q),
      );
    }

    // My Holdings filter
    if (filterHoldings) {
      result = result.filter(({ company }) => heldCompanyIds.has(company.id));
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "price-asc":
          return (a.company.stockPrice || 0) - (b.company.stockPrice || 0);
        case "price-desc":
          return (b.company.stockPrice || 0) - (a.company.stockPrice || 0);
        case "change-asc":
          return a.priceChange - b.priceChange;
        case "change-desc":
          return b.priceChange - a.priceChange;
        case "mcap-asc":
          return a.marketCap - b.marketCap;
        case "mcap-desc":
          return b.marketCap - a.marketCap;
        case "newest":
          return (
            new Date(b.company.createdAt || 0).getTime() -
            new Date(a.company.createdAt || 0).getTime()
          );
        case "name-asc":
        default:
          return a.company.name.localeCompare(b.company.name);
      }
    });

    return result;
  }, [enrichedCompanies, search, filterHoldings, sortBy, heldCompanyIds]);

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <div className="mb-4">
          <h1 className="text-4xl font-bold">Companies</h1>
          <p className="text-muted-foreground mt-2">
            Explore all registered companies and their market performance
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link to="/companies/market">
              <TrendingUp className="w-4 h-4 mr-2" />
              Stock Market
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/companies/create">
              <Building2 className="w-4 h-4 mr-2" />
              Create Company
            </Link>
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or symbol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {userHoldings.length > 0 && (
            <Button
              variant={filterHoldings ? "default" : "outline"}
              onClick={() => setFilterHoldings(!filterHoldings)}
              size="sm"
              className="whitespace-nowrap h-9"
            >
              My Holdings
            </Button>
          )}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A–Z)</SelectItem>
              <SelectItem value="price-desc">Price (High → Low)</SelectItem>
              <SelectItem value="price-asc">Price (Low → High)</SelectItem>
              <SelectItem value="change-desc">Change (High → Low)</SelectItem>
              <SelectItem value="change-asc">Change (Low → High)</SelectItem>
              <SelectItem value="mcap-desc">Market Cap (High → Low)</SelectItem>
              <SelectItem value="mcap-asc">Market Cap (Low → High)</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No companies registered yet</p>
          </CardContent>
        </Card>
      ) : filteredCompanies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No companies match your search
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCompanies.map(
            ({ company, marketCap, chartData, priceChange, LogoIcon }) => {
              return (
                <Link
                  key={company.id}
                  to="/companies/$id"
                  params={{ id: String(company.id) }}
                  className="block"
                >
                  <Card className="hover:bg-accent/50 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex-1">
                          <div className="flex items-start gap-4 mb-4">
                            <div
                              className="h-16 w-16 rounded-lg flex items-center justify-center font-bold text-2xl"
                              style={{
                                backgroundColor: company.color
                                  ? `${company.color}20`
                                  : "hsl(var(--primary) / 0.1)",
                                color: company.color || "hsl(var(--primary))",
                              }}
                            >
                              {LogoIcon ? (
                                <LogoIcon className="w-8 h-8" />
                              ) : (
                                company.symbol.charAt(0)
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-2xl font-bold">
                                  {company.name}
                                </h3>
                                <Badge variant="secondary">
                                  {company.symbol}
                                </Badge>
                              </div>
                              {company.description && (
                                <p className="text-sm text-muted-foreground mt-1 break-all overflow-hidden">
                                  {company.description.length > 200
                                    ? company.description.slice(0, 200) + "…"
                                    : company.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Stock Price
                              </div>
                              <div className="text-xl font-bold">
                                ${company.stockPrice?.toLocaleString() || "N/A"}
                              </div>
                              {chartData.length > 1 && (
                                <div
                                  className={`text-sm flex items-center gap-1 ${
                                    priceChange === 0
                                      ? "text-muted-foreground"
                                      : priceChange > 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                  }`}
                                >
                                  {priceChange === 0 ? (
                                    <TrendingUp className="h-4 w-4" />
                                  ) : priceChange > 0 ? (
                                    <TrendingUp className="h-4 w-4" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4" />
                                  )}
                                  {priceChange > 0 ? "+" : ""}
                                  {priceChange.toFixed(2)}% (24h)
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Market Cap
                              </div>
                              <div className="text-xl font-bold">
                                ${marketCap.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Shares
                              </div>
                              <div className="text-xl font-bold">
                                {company.issuedShares?.toLocaleString() || 0}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                CEO
                              </div>
                              <div className="text-xl font-bold">
                                {company.creatorUsername || "Unknown"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {chartData.length > 1 && (
                          <div className="lg:w-64 h-24">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData}>
                                <XAxis
                                  dataKey="time"
                                  hide
                                  domain={["dataMin", "dataMax"]}
                                />
                                <YAxis
                                  hide
                                  domain={["dataMin - 5", "dataMax + 5"]}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="price"
                                  stroke={
                                    priceChange === 0
                                      ? "#9ca3af"
                                      : priceChange > 0
                                        ? "#16a34a"
                                        : "#dc2626"
                                  }
                                  strokeWidth={2}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}
