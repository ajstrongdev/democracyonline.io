import { createFileRoute, redirect } from "@tanstack/react-router";
import { ModerationQueue } from "@/components/moderation/moderation-queue";
import {
  getModerationAccess,
  getModerationQueue,
} from "@/lib/server/moderation";

export const Route = createFileRoute("/moderation")({
  loader: async () => {
    const access = await getModerationAccess();
    if (!access.allowed) throw redirect({ to: "/" });
    return { queue: await getModerationQueue(), role: access.role };
  },
  component: ModerationPage,
});

function ModerationPage() {
  const { queue } = Route.useLoaderData();
  return (
    <main className="container mx-auto max-w-5xl p-4 sm:p-8">
      <ModerationQueue initialQueue={queue} />
    </main>
  );
}
