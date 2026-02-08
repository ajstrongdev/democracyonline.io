import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  getCompanyById,
  getCompanyStakeholders,
  investInCompany,
} from "@/lib/server/stocks";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  DollarSign,
  TrendingUp,
  Users,
  ArrowLeft,
  Wallet,
  PiggyBank,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { toast } from "sonner";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  const router = useRouter();
  const sharePrice = company?.stockPrice || 100;
  const [investmentAmount, setInvestmentAmount] = useState(sharePrice);
  const [retainedShares, setRetainedShares] = useState(0);
  const [isInvesting, setIsInvesting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const marketCap = company.stockPrice
    ? company.stockPrice * (company.issuedShares || 0)
    : 0;

  const minInvestment = sharePrice;
  // Calculate shares based on proportional ownership: (investment * currentShares) / currentCapital
  const currentCapital = company.capital || 0;
  const currentShares = company.issuedShares || 0;
  const maxShares =
    currentCapital > 0 && currentShares > 0
      ? Math.floor((investmentAmount * currentShares) / currentCapital)
      : Math.floor(investmentAmount / sharePrice);
  const availableShares = maxShares - retainedShares;
  const userMoney =
    userData && typeof userData === "object" && "money" in userData
      ? userData.money
      : 0;

  let LogoIcon: LucideIcon | null = null;
  if (company.logo) {
    const iconsMap = LucideIcons as unknown as Record<string, LucideIcon>;
    LogoIcon = iconsMap[company.logo] || null;
  }

  const handleInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInvesting(true);

    try {
      const result = await investInCompany({
        data: {
          companyId: company.id,
          investmentAmount,
          retainedShares,
        },
      });

      toast.success(
        `Successfully invested $${investmentAmount.toLocaleString()}! Issued ${result.newShares} shares (${retainedShares} retained, ${availableShares} available)`,
      );
      setDialogOpen(false);
      router.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Failed to invest");
    } finally {
      setIsInvesting(false);
    }
  };

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
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="lg"
                        className="gap-2 flex-1 sm:flex-initial"
                      >
                        <PiggyBank className="h-5 w-5" />
                        Invest
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invest in {company.name}</DialogTitle>
                        <DialogDescription>
                          Invest money to issue new shares. You can choose how
                          many shares to retain for yourself.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleInvest} className="space-y-4">
                        <div>
                          <Label>Your Balance</Label>
                          <div className="flex items-center gap-2 text-lg font-bold">
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                            ${userMoney?.toLocaleString() || 0}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="amount">Investment Amount</Label>
                            <span className="text-lg font-medium">
                              ${investmentAmount.toLocaleString()}
                            </span>
                          </div>
                          <Slider
                            id="amount"
                            min={minInvestment}
                            max={Math.min(
                              userMoney || minInvestment,
                              minInvestment * 1000,
                            )}
                            step={sharePrice}
                            value={[investmentAmount]}
                            onValueChange={(value) => {
                              setInvestmentAmount(value[0]);
                              const newMaxShares =
                                currentCapital > 0 && currentShares > 0
                                  ? Math.floor(
                                      (value[0] * currentShares) /
                                        currentCapital,
                                    )
                                  : Math.floor(value[0] / sharePrice);
                              setRetainedShares(
                                Math.min(retainedShares, newMaxShares),
                              );
                            }}
                            className="w-full"
                          />
                          <p className="text-sm text-muted-foreground">
                            Will issue {maxShares} shares based on proportional
                            ownership
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="retained">Shares to Retain</Label>
                          <Input
                            id="retained"
                            type="number"
                            min={0}
                            max={maxShares}
                            value={retainedShares}
                            onChange={(e) =>
                              setRetainedShares(
                                Math.min(
                                  parseInt(e.target.value) || 0,
                                  maxShares,
                                ),
                              )
                            }
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            {availableShares} shares will be available for
                            trading
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted p-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Investment:
                            </span>
                            <span className="font-medium">
                              ${investmentAmount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Shares Issued:
                            </span>
                            <span className="font-medium">{maxShares}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              You Keep:
                            </span>
                            <span className="font-medium">
                              {retainedShares}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Available to Buy:
                            </span>
                            <span className="font-medium">
                              {availableShares}
                            </span>
                          </div>
                        </div>
                        <Button
                          type="submit"
                          disabled={isInvesting}
                          className="w-full"
                        >
                          {isInvesting
                            ? "Investing..."
                            : `Invest $${investmentAmount.toLocaleString()}`}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
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
                <CardDescription className="text-sm sm:text-base">
                  {company.description}
                </CardDescription>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Company Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  Total Shares
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
