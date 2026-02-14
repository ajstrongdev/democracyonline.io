import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  PieChart,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getCurrentUserInfo } from "@/lib/server/users";
import { createCompany } from "@/lib/server/stocks";
import { useUserData } from "@/lib/hooks/use-user-data";
import ProtectedRoute from "@/components/auth/protected-route";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { icons } from "@/lib/utils/logo-helper";

export const Route = createFileRoute("/companies/create")({
  loader: async () => {
    const userData = await getCurrentUserInfo();
    return { userData };
  },
  component: CreateCompanyPage,
});

function CreateCompanyPage() {
  const { userData } = Route.useLoaderData();
  const user = useUserData(userData);
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [companySymbol, setCompanySymbol] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [companyCapital, setCompanyCapital] = useState(100);
  const [retainedSharesPercent, setRetainedSharesPercent] = useState(50);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [companyColor, setCompanyColor] = useState("#3b82f6");
  const [isCreating, setIsCreating] = useState(false);

  const totalShares = Math.floor(companyCapital / 100);
  const safeRetainedPercent = Math.min(retainedSharesPercent, 100);
  const retainedShares = Math.floor((totalShares * safeRetainedPercent) / 100);
  const availableShares = totalShares - retainedShares;

  const handleCreateCompany = async () => {
    if (!companyName || !companySymbol) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (companyCapital < 100) {
      toast.error("Minimum startup capital is $100");
      return;
    }

    if ((user?.money || 0) < companyCapital) {
      toast.error("Insufficient funds for startup capital");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createCompany({
        data: {
          name: companyName,
          symbol: companySymbol.toUpperCase(),
          description: companyDescription || undefined,
          logo: selectedLogo,
          color: companyColor,
          capital: companyCapital,
          retainedShares: retainedShares,
        },
      });

      toast.success(
        `Created ${result.company.name} (${result.company.symbol}) with ${result.sharesIssued} shares! You retained ${result.sharesRetained} shares.`,
      );

      // Navigate back to bank page
      navigate({ to: "/bank" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create company",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const maxCapital =
    Math.floor(Math.min(user?.money || 100, 1000000) / 100) * 100;

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4 max-w-6xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/bank">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Create a Company</h1>
              <p className="text-muted-foreground">
                Start your own company and issue shares
              </p>
            </div>
          </div>
        </div>

        {/* Your Balance Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Your Balance</span>
              <span className="text-2xl font-bold">
                ${Number(user?.money || 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Create Company Form */}
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>
              Every $100 in startup capital creates 1 share at $100 per share
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name *</Label>
                  <Input
                    id="company-name"
                    placeholder="Acme Corporation"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-symbol">
                    Stock Symbol * (e.g., ACME)
                  </Label>
                  <Input
                    id="company-symbol"
                    placeholder="ACME"
                    maxLength={10}
                    value={companySymbol}
                    onChange={(e) =>
                      setCompanySymbol(e.target.value.toUpperCase())
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-description">
                  Description (optional)
                </Label>
                <Textarea
                  id="company-description"
                  placeholder="What does your company do?"
                  value={companyDescription}
                  onChange={(e) =>
                    setCompanyDescription(e.target.value.slice(0, 300))
                  }
                  maxLength={300}
                />
                <p className="text-sm text-muted-foreground text-right">
                  {companyDescription.length}/300
                </p>
              </div>

              {/* Company Color */}
              <div className="space-y-2">
                <Label htmlFor="company-color">Company Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="company-color"
                    type="text"
                    placeholder="#3b82f6"
                    value={companyColor}
                    onChange={(e) => setCompanyColor(e.target.value)}
                    maxLength={7}
                    className="flex-1"
                  />
                  <Input
                    type="color"
                    value={companyColor}
                    onChange={(e) => setCompanyColor(e.target.value)}
                    className="w-20 h-10 cursor-pointer"
                  />
                </div>
              </div>

              {/* Company Logo */}
              <div className="space-y-2">
                <Label>Company Logo (optional)</Label>
                <div className="grid grid-cols-6 gap-2">
                  <Button
                    type="button"
                    variant={selectedLogo === null ? "default" : "outline"}
                    className="h-12 w-full"
                    onClick={() => setSelectedLogo(null)}
                  >
                    None
                  </Button>
                  {icons.map((icon) => {
                    const Icon = icon.Icon;
                    return (
                      <Button
                        key={icon.name}
                        type="button"
                        variant={
                          selectedLogo === icon.name ? "default" : "outline"
                        }
                        className="h-12 w-full"
                        onClick={() => setSelectedLogo(icon.name)}
                        aria-label={icon.name}
                        aria-pressed={selectedLogo === icon.name}
                      >
                        <Icon className="w-5 h-5" />
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Startup Capital */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="startup-capital"
                    className="flex items-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    Startup Capital
                  </Label>
                  <Input
                    id="startup-capital"
                    type="number"
                    min={100}
                    max={maxCapital}
                    step={100}
                    value={companyCapital}
                    onChange={(e) =>
                      setCompanyCapital(
                        Math.max(
                          100,
                          Math.min(
                            Math.floor(Number(e.target.value) / 100) * 100,
                            maxCapital,
                          ),
                        ),
                      )
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    $100 per share &middot; {totalShares} shares will be issued
                    &middot; Max: ${maxCapital.toLocaleString()}
                  </p>
                </div>

                {/* Shares to Retain */}
                <div className="space-y-2">
                  <Label
                    htmlFor="retained-shares"
                    className="flex items-center gap-2"
                  >
                    <PieChart className="w-4 h-4" />
                    Shares to Retain
                  </Label>
                  <Input
                    id="retained-shares"
                    type="number"
                    min={0}
                    max={totalShares}
                    value={retainedShares}
                    onChange={(e) => {
                      const val = Math.max(
                        0,
                        Math.min(parseInt(e.target.value) || 0, totalShares),
                      );
                      setRetainedSharesPercent(
                        totalShares > 0
                          ? Math.round((val / totalShares) * 100)
                          : 0,
                      );
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    {availableShares} shares will be available for trading
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  IPO Summary
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Shares:</span>
                    <span className="font-semibold">
                      {totalShares.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Share Price:</span>
                    <span className="font-semibold">$100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">You Retain:</span>
                    <span className="font-semibold text-primary">
                      {retainedShares.toLocaleString()} shares
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Available to Buy:
                    </span>
                    <span className="font-semibold">
                      {availableShares.toLocaleString()} shares
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Your Investment:
                    </span>
                    <span className="text-lg font-bold">
                      ${companyCapital.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCreateCompany}
                disabled={
                  isCreating ||
                  !companyName ||
                  !companySymbol ||
                  (user?.money || 0) < companyCapital
                }
                className="w-full"
                size="lg"
              >
                {isCreating ? (
                  "Creating..."
                ) : (
                  <>
                    <Building2 className="w-4 h-4 mr-2" />
                    Create Company (${companyCapital.toLocaleString()})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
