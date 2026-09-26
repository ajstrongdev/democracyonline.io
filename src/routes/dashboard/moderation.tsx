import { createFileRoute, redirect } from "@tanstack/react-router";
import { ModerationQueue } from "@/components/moderation/moderation-queue";
import { getModerationAccess, getModerationQueue } from "@/lib/server/moderation";

export const Route = createFileRoute("/dashboard/moderation")({
  loader: async () => {
    const access = await getModerationAccess();
    if (!access.allowed) throw redirect({ to: "/dashboard" });
    return { queue: await getModerationQueue() };
  },
  component: () => <main className="mx-auto max-w-5xl p-4 sm:p-8"><ModerationQueue initialQueue={Route.useLoaderData().queue} /></main>,
});
