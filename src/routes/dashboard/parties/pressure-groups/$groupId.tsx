import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { WikiPage, WikiSection } from "@/components/wiki/wiki-layout";
import {
  getPressureGroup,
  joinPressureGroup,
  leavePressureGroup,
} from "@/lib/server/organizations/pressure-groups";
import { getCurrentUserInfo } from "@/lib/server/users/users";

export const Route = createFileRoute(
  "/dashboard/parties/pressure-groups/$groupId",
)({
  loader: async ({ params }) => {
    const id = Number(params.groupId);
    if (!Number.isInteger(id) || id < 1)
      throw new Response("Group not found", { status: 404 });
    const [group, currentUser] = await Promise.all([
      getPressureGroup({ data: { id } }),
      getCurrentUserInfo(),
    ]);
    if (!group) throw new Response("Group not found", { status: 404 });
    return { group, currentUser };
  },
  component: PressureGroupPage,
});

function PressureGroupPage() {
  const { group, currentUser } = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const member = group.members.some((person) => person.id === currentUser?.id);
  const founder = group.founderId === currentUser?.id;
  const forming = group.formedPartyId === null;

  const update = async (join: boolean) => {
    if (
      !join &&
      !window.confirm(
        founder
          ? "Disband this pressure group? All members will be removed."
          : "Leave this pressure group?",
      )
    )
      return;
    setBusy(true);
    try {
      if (join) {
        const result = await joinPressureGroup({ data: { id: group.id } });
        if (result.formed && result.partyId) {
          toast.success("The pressure group is now a party!");
          await router.navigate({
            to: "/dashboard/parties/$partyId",
            params: { partyId: String(result.partyId) },
          });
          return;
        }
        toast.success(
          "You joined the pressure group. You remain Independent until it becomes a party.",
        );
      } else {
        await leavePressureGroup({ data: { id: group.id } });
        toast.success(
          founder ? "Pressure group disbanded" : "You left the pressure group",
        );
        if (founder) {
          await router.navigate({ to: "/dashboard/parties" });
          return;
        }
      }
      await router.invalidate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update membership",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <WikiPage>
      <WikiHeader
        eyebrow="Forming party · Pressure group"
        title={group.name}
        description={group.details.party.bio}
        status={
          <Badge variant="secondary">
            {forming ? `${group.members.length}/3 members` : "Formed"}
          </Badge>
        }
      />
      {forming ? (
        <div className="rounded-md border bg-card p-5 sm:p-6">
          <h2 className="font-serif text-xl font-semibold">Building a party</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Members remain Independent. At three members, this group
            automatically becomes a party; the founder becomes leader and can
            appoint officers. Until then it has no party social-media account or
            party powers.
          </p>
          {currentUser && (
            <div className="mt-4">
              {member ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => update(false)}
                >
                  {founder ? "Disband group" : "Leave group"}
                </Button>
              ) : (
                <Button
                  disabled={busy || Boolean(currentUser.partyId)}
                  onClick={() => update(true)}
                >
                  Join pressure group
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-md border bg-card p-5 text-sm">
          This group has become a party.{" "}
          <Link
            to="/dashboard/parties/$partyId"
            params={{ partyId: String(group.formedPartyId) }}
            className="text-primary underline"
          >
            View the party
          </Link>
        </p>
      )}
      <WikiSection
        title="Members"
        description="Three independent players are needed to form a party."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {group.members.map((person) => (
            <div
              key={person.id}
              className="flex items-center gap-3 rounded-md border bg-card p-3"
            >
              <PlayerAvatar
                username={person.username}
                photoUrl={person.photoUrl}
                className="size-9"
              />
              <span className="min-w-0 truncate font-medium">
                {person.username}
              </span>
              {person.id === group.founderId && (
                <Badge variant="outline" className="ml-auto">
                  Founder
                </Badge>
              )}
            </div>
          ))}
        </div>
      </WikiSection>
    </WikiPage>
  );
}
