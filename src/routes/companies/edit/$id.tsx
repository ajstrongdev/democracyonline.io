import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getCompanyById, updateCompany } from "@/lib/server/stocks";
import { getCurrentUserInfo } from "@/lib/server/users";
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
import { ArrowLeft, Building2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { icons } from "@/lib/utils/logo-helper";
import { useUserData } from "@/lib/hooks/use-user-data";

export const Route = createFileRoute("/companies/edit/$id")({
  loader: async ({ params }) => {
    const companyId = parseInt(params.id);
    const company = await getCompanyById({ data: { companyId } });
    const userData = await getCurrentUserInfo();
    return { company, userData };
  },
  component: EditCompanyPage,
});

function EditCompanyPage() {
  const { company, userData: loaderUserData } = Route.useLoaderData();
  const navigate = useNavigate();
  const userData = useUserData(loaderUserData);

  const currentUserId = userData?.id ?? null;

  const isCEO = company && currentUserId === company.ceoId;

  const [companyName, setCompanyName] = useState(company?.name || "");
  const [companyDescription, setCompanyDescription] = useState(
    company?.description || "",
  );
  const [selectedLogo, setSelectedLogo] = useState<string | null>(
    company?.logo || null,
  );
  const [companyColor, setCompanyColor] = useState(company?.color || "#3b82f6");
  const [isSaving, setIsSaving] = useState(false);

  if (!company) {
    return (
      <ProtectedRoute>
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
      </ProtectedRoute>
    );
  }

  if (!isCEO) {
    return (
      <ProtectedRoute>
        <div className="container max-w-4xl py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">Access Denied</p>
              <p className="text-sm text-muted-foreground mt-1">
                Only the CEO can edit this company.
              </p>
              <Button asChild className="mt-4">
                <Link to="/companies/$id" params={{ id: String(company.id) }}>
                  Back to Company
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  const handleSave = async () => {
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    setIsSaving(true);
    try {
      await updateCompany({
        data: {
          companyId: company.id,
          name: companyName.trim(),
          description: companyDescription.trim() || undefined,
          logo: selectedLogo,
          color: companyColor,
        },
      });

      toast.success("Company updated successfully");
      navigate({
        to: "/companies/$id",
        params: { id: String(company.id) },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update company",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4 max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/companies/$id" params={{ id: String(company.id) }}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Edit Company</h1>
              <p className="text-sm text-muted-foreground">
                {company.symbol} &middot; Update company details
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>
              Update your company&apos;s name, description, logo, and color.
              Stock symbol cannot be changed.
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
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-symbol">Stock Symbol</Label>
                  <Input
                    id="company-symbol"
                    value={company.symbol}
                    disabled
                    className="opacity-60"
                  />
                  <p className="text-xs text-muted-foreground">
                    Symbol cannot be changed
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-description">Description</Label>
                <Textarea
                  id="company-description"
                  placeholder="What does your company do?"
                  value={companyDescription}
                  onChange={(e) =>
                    setCompanyDescription(e.target.value.slice(0, 200))
                  }
                  maxLength={200}
                />
                <p className="text-sm text-muted-foreground text-right">
                  {companyDescription.length}/200
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
                <Label>Company Logo</Label>
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

              <Button
                onClick={handleSave}
                disabled={isSaving || !companyName.trim()}
                className="w-full"
                size="lg"
              >
                {isSaving ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
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
