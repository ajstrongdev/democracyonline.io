import { queryOptions } from "@tanstack/react-query";
import { getDashboardData } from "@/lib/server/dashboard/data";

export const dashboardQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "home"] as const,
    queryFn: () => getDashboardData(),
    staleTime: 7_000,
  });
