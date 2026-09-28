import { createFileRoute } from "@tanstack/react-router";
import { AdminContent } from "@/components/admin/admin-page";

export const Route = createFileRoute("/dashboard/admin")({
  component: AdminContent,
});
