import { createFileRoute } from "@tanstack/react-router";
import { CalendarView } from "@/components/calendar-view";
import { getCalendarData } from "@/lib/server/calendar";
import GenericSkeleton from "@/components/generic-skeleton";

export const Route = createFileRoute("/calendar")({
  loader: async () => {
    const calendarData = await getCalendarData();
    return { calendarData };
  },
  component: RouteComponent,
  pendingComponent: () => <GenericSkeleton />,
});

function RouteComponent() {
  const { calendarData } = Route.useLoaderData();

  return <CalendarView data={calendarData} />;
}
