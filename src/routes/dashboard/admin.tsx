import { createFileRoute } from "@tanstack/react-router";
import { AdminContent } from "@/routes/admin";

export const Route = createFileRoute("/dashboard/admin")({
  component: AdminContent,
});
