import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  Clock,
  Coins,
  DollarSign,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Vote,
} from "lucide-react";
import { toast } from "sonner";
import type {CampaignData, CampaignItem} from "@/lib/server/campaign";
import { getCurrentUserInfo } from "@/lib/server/users";
import {
  
  
  getCampaignData,
  getCampaignItems,
  purchaseCampaignItem
} from "@/lib/server/campaign";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/elections/campaign")({
  loader: async () => {
    const userData = await getCurrentUserInfo();

    let campaignData: CampaignData | null = null;
    let campaignItems: Array<CampaignItem> = [];

    if (userData?.id) {
      campaignData = await getCampaignData({ data: { userId: userData.id } });

      if (campaignData?.candidateId) {
        campaignItems = await getCampaignItems({
          data: { candidateId: campaignData.candidateId },
        });
      }
    }

    return { userData, campaignData, campaignItems };
  },
  component: RouteComponent,
});

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

function ItemCard({
  item,
  canAfford,
  onPurchase,
  isPurchasing,
}: {
  item: CampaignItem;
  canAfford: boolean;
  onPurchase: () => void;
  isPurchasing: boolean;
}) {
  const isVoteItem = item.target === "Votes";

  return (
    <Card
      className={`transition-all ${canAfford ? "hover:shadow-lg hover:border-primary/50" : "opacity-60"}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {isVoteItem ? (
              <Vote className="w-5 h-5 text-blue-500" />
            ) : (
              <Coins className="w-5 h-5 text-green-500" />
            )}
            {item.name}
          </CardTitle>
          <span className="text-xs px-2 py-1 rounded-full bg-muted font-medium">
            Owned: {item.owned}
          </span>
        </div>
        <CardDescription className="text-sm">
          {item.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Produces</span>
            <span
              className={`font-bold ${isVoteItem ? "text-blue-500" : "text-green-500"}`}
            >
              +{item.increaseAmount} {isVoteItem ? "votes" : "donations"}/hr
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground">Cost</span>
            <span
              className={`font-bold ${canAfford ? "text-foreground" : "text-destructive"}`}
            >
              ${formatNumber(item.currentCost)}
            </span>
          </div>
        </div>
        <Button
          onClick={onPurchase}
          disabled={!canAfford || isPurchasing}
          className="w-full"
          variant={canAfford ? "default" : "secondary"}
        >
          {isPurchasing
            ? "Purchasing..."
            : canAfford
              ? "Purchase"
              : "Not Enough Funds"}
        </Button>
      </CardContent>
    </Card>
  );
}

function RouteComponent() {
  const {
    userData: loaderUserData,
    campaignData,
    campaignItems: initialItems,
  } = Route.useLoaderData();
  const userData = useUserData(loaderUserData);

  const [localCampaignData, setLocalCampaignData] =
    useState<CampaignData | null>(campaignData);
  const [localItems, setLocalItems] = useState<Array<CampaignItem>>(initialItems);
  const [purchasingItemId, setPurchasingItemId] = useState<number | null>(null);

  // Not a candidate
  if (!localCampaignData) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto p-4 max-w-4xl">
          <Alert className="bg-card border-yellow-500/50">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <AlertTitle className="text-lg font-bold">
              Not a Candidate
            </AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">
                You are not currently running in any election. To access the
                campaign management page, you must first declare your candidacy
                in either the Presidential or Senate election.
              </p>
              <div className="flex gap-4">
                <Button asChild variant="outline">
                  <Link to="/elections/president">Presidential Election</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/elections/senate">Senate Election</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </ProtectedRoute>
    );
  }

  // Not in voting phase
  if (localCampaignData.electionStatus !== "Voting") {
    return (
      <ProtectedRoute>
        <div className="container mx-auto p-4 max-w-4xl">
          <Alert className="bg-card border-blue-500/50">
            <Clock className="h-5 w-5 text-blue-500" />
            <AlertTitle className="text-lg font-bold">
              Waiting for Voting Phase
            </AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-2">
                The campaign page is only available during the voting phase of
                the election.
              </p>
              <p className="text-muted-foreground">
                Current Status:{" "}
                <span className="font-semibold text-foreground">
                  {localCampaignData.electionStatus}
                </span>
                {localCampaignData.electionStatus === "Candidate" && (
                  <span className="ml-2">
                    • Voting starts in {localCampaignData.daysLeft} days
                  </span>
                )}
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Once voting begins, you'll be able to spend your campaign
                donations on upgrades to earn votes and attract more donors.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </ProtectedRoute>
    );
  }

  const handlePurchase = async (itemId: number) => {
    if (!localCampaignData?.candidateId) return;

    setPurchasingItemId(itemId);
    try {
      const result = await purchaseCampaignItem({
        data: { candidateId: localCampaignData.candidateId, itemId },
      });

      // Refresh data
      const newCampaignData = await getCampaignData({
        data: { userId: userData!.id },
      });
      const newItems = await getCampaignItems({
        data: { candidateId: localCampaignData.candidateId },
      });

      setLocalCampaignData(newCampaignData);
      setLocalItems(newItems);

      const item = localItems.find((i) => i.id === itemId);
      toast.success(
        `Purchased ${item?.name} for $${formatNumber(result.cost)}`,
      );
    } catch (error) {
      console.error("Purchase failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to purchase item",
      );
    } finally {
      setPurchasingItemId(null);
    }
  };

  const voteItems = localItems
    .filter((item) => item.target === "Votes")
    .sort((a, b) => a.baseCost - b.baseCost);
  const donationItems = localItems
    .filter((item) => item.target === "Donations")
    .sort((a, b) => a.baseCost - b.baseCost);

  const totalVotesPerHour = localCampaignData.votesPerHour;
  const totalDonationsPerHour = localCampaignData.donationsPerHour;

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4 max-w-7xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary" />
              Campaign Headquarters
            </h1>
            <p className="text-muted-foreground mt-1">
              {localCampaignData.election === "President"
                ? "Presidential Election"
                : "Senate Election"}{" "}
              • {localCampaignData.daysLeft} days remaining
            </p>
          </div>
          <Button asChild variant="outline">
            <Link
              to={
                localCampaignData.election === "President"
                  ? "/elections/president"
                  : "/elections/senate"
              }
            >
              View Election
            </Link>
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-linear-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-500 mb-1">
                <Vote className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">
                  Total Votes
                </span>
              </div>
              <p className="text-3xl font-bold">
                {formatNumber(localCampaignData.votes)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-linear-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-500 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">
                  Campaign Funds
                </span>
              </div>
              <p className="text-3xl font-bold">
                ${formatNumber(localCampaignData.donations)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-linear-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-500 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">
                  Votes/Hour
                </span>
              </div>
              <p className="text-3xl font-bold">
                +{formatNumber(totalVotesPerHour)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-linear-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <Coins className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">
                  Donations/Hour
                </span>
              </div>
              <p className="text-3xl font-bold">
                +${formatNumber(totalDonationsPerHour)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Production Summary
            </CardTitle>
            <CardDescription>
              Your current hourly production from all purchased upgrades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Vote className="w-4 h-4 text-blue-500" />
                  Vote Generators
                </h4>
                <div className="space-y-2">
                  {voteItems.filter((i) => i.owned > 0).length > 0 ? (
                    voteItems
                      .filter((i) => i.owned > 0)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between text-sm"
                        >
                          <span>
                            {item.name}{" "}
                            <span className="text-muted-foreground">
                              x{item.owned}
                            </span>
                          </span>
                          <span className="text-blue-500">
                            +{item.owned * item.increaseAmount}/hr
                          </span>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No vote generators purchased yet
                    </p>
                  )}
                  <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-blue-500">
                      +{totalVotesPerHour} votes/hr
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-green-500" />
                  Donation Generators
                </h4>
                <div className="space-y-2">
                  {donationItems.filter((i) => i.owned > 0).length > 0 ? (
                    donationItems
                      .filter((i) => i.owned > 0)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between text-sm"
                        >
                          <span>
                            {item.name}{" "}
                            <span className="text-muted-foreground">
                              x{item.owned}
                            </span>
                          </span>
                          <span className="text-green-500">
                            +${item.owned * item.increaseAmount}/hr
                          </span>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No donation generators purchased yet
                    </p>
                  )}
                  <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-green-500">
                      +${totalDonationsPerHour}/hr
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Strategy Tips */}
        <Alert className="bg-card">
          <Target className="h-4 w-4" />
          <AlertTitle>Campaign Strategy</AlertTitle>
          <AlertDescription>
            Balance your spending between vote generators (to win the election)
            and donation generators (to fund more purchases). Each upgrade costs
            more as you buy more of them. Plan your purchases carefully!
          </AlertDescription>
        </Alert>

        {/* Items Shop */}
        {localItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                No Campaign Items Available
              </h3>
              <p className="text-muted-foreground">
                Campaign items haven't been set up yet. Please contact an
                administrator to set up the campaign items.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="votes" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="votes" className="flex items-center gap-2">
                <Vote className="w-4 h-4" />
                Vote Generators ({voteItems.length})
              </TabsTrigger>
              <TabsTrigger
                value="donations"
                className="flex items-center gap-2"
              >
                <Coins className="w-4 h-4" />
                Donation Generators ({donationItems.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="votes">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {voteItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    canAfford={localCampaignData.donations >= item.currentCost}
                    onPurchase={() => handlePurchase(item.id)}
                    isPurchasing={purchasingItemId === item.id}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="donations">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {donationItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    canAfford={localCampaignData.donations >= item.currentCost}
                    onPurchase={() => handlePurchase(item.id)}
                    isPurchasing={purchasingItemId === item.id}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </ProtectedRoute>
  );
}
