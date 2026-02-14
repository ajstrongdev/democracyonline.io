import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Edit,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getCompanyById, getCompanyStakeholders } from "@/lib/server/stocks";
import { getCurrentUserInfo } from "@/lib/server/users";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { calculateMarketCap } from "@/lib/utils/stock-economy";

export const Route = createFileRoute("/companies/$id")({
  loader: async ({ params }) => {
    const companyId = parseInt(params.id);
    const company = await getCompanyById({ data: { companyId } });
    const stakeholders = await getCompanyStakeholders({ data: { companyId } });
    const userData = await getCurrentUserInfo();
    return { company, stakeholders, userData };
  },
  component: CompanyDetailPage,
});

function CompanyDetailPage() {
  const { company, stakeholders, userData } = Route.useLoaderData();

  if (!company) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Company not found</p>
            <Button asChild className="mt-4">
              <Link to="/companies">Back to Companies</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const marketCap = calculateMarketCap({
    sharePrice: company.stockPrice,
    issuedShares: company.issuedShares,
  });

  const currentUserId =
    userData && typeof userData === "object" && "id" in userData
      ? (userData as any).id
      : null;
  const isCEO = currentUserId != null && currentUserId === company.ceoId;

  let LogoIcon: LucideIcon | null = null;
  if (company.logo) {
    const iconsMap = LucideIcons as unknown as Record<string, LucideIcon>;
    LogoIcon = iconsMap[company.logo] || null;
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <Button variant="ghost" asChild className="mb-6">
        <Link to="/companies">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Companies
        </Link>
      </Button>

      <div className="space-y-6">
        {/* Company Header */}
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl flex items-center justify-center font-bold text-2xl sm:text-3xl shadow-lg shrink-0"
                    style={{
                      backgroundColor: company.color
                        ? `${company.color}20`
                        : "hsl(var(--primary) / 0.1)",
                      color: company.color || "hsl(var(--primary))",
                    }}
                  >
                    {LogoIcon ? (
                      <LogoIcon className="w-10 h-10 sm:w-12 sm:h-12" />
                    ) : (
                      company.symbol.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-xl sm:text-2xl lg:text-3xl mb-2">
                      {company.name}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="font-mono text-xs sm:text-sm"
                      >
                        {company.symbol}
                      </Badge>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        Founded{" "}
                        {company.createdAt
                          ? new Date(company.createdAt).toLocaleDateString()
                          : "Unknown"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-row gap-2 w-full sm:w-auto">
                  {isCEO && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 flex-1 sm:flex-initial"
                      asChild
                    >
                      <Link
                        to="/companies/edit/$id"
                        params={{ id: String(company.id) }}
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1 sm:flex-initial"
                    asChild
                  >
                    <Link to="/companies/market">Trade Shares</Link>
                  </Button>
                </div>
              </div>
              {company.description && (
                <CardDescription className="text-sm sm:text-base break-all">
                  {company.description.length > 400
                    ? company.description.slice(0, 400) + "…"
                    : company.description}
                </CardDescription>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Company Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  Stock Price
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${company.stockPrice?.toLocaleString() || "N/A"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  Market Cap
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${marketCap.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  Issued Shares
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {company.issuedShares?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  Owned Shares
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {company.totalOwnedShares?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  Total Capital
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${company.capital?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stakeholders */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Stakeholders</CardTitle>
                <CardDescription>
                  {stakeholders.length} shareholder
                  {stakeholders.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {stakeholders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="mx-auto h-16 w-16 opacity-20 mb-4" />
                <p className="font-medium">No shareholders yet</p>
                <p className="text-sm">Be the first to invest!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stakeholders.map((stakeholder, index) => (
                  <div
                    key={stakeholder.userId}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to="/profile/$id"
                            params={{ id: String(stakeholder.userId) }}
                            className="font-semibold hover:underline truncate"
                          >
                            {stakeholder.username}
                          </Link>
                          {index === 0 && (
                            <Badge variant="default" className="text-xs">
                              CEO
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {stakeholder.shares.toLocaleString()} shares • $
                          {(
                            stakeholder.shares * (company.stockPrice || 0)
                          ).toLocaleString()}{" "}
                          value
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 self-end sm:self-auto">
                      <div className="text-xl sm:text-2xl font-bold">
                        {stakeholder.percentage.toFixed(2)}%
                      </div>
                      <div className="w-24 sm:w-32">
                        <Progress
                          value={stakeholder.percentage}
                          className="h-2"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
