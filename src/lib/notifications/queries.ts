import { queryOptions } from "@tanstack/react-query";
import { getZNotificationPage } from "@/lib/server/notifications/social-notifications";

export const socialNotificationsQuery = () =>
  queryOptions({
    queryKey: ["notifications", "social"] as const,
    queryFn: () => getZNotificationPage({ data: { limit: 5, offset: 0 } }),
    staleTime: 7_000,
  });
