import { createFileRoute } from "@tanstack/react-router";
import { CalendarView } from "@/components/calendar-view";
import { getCalendarData } from "@/lib/server/calendar";

export const Route = createFileRoute("/calendar")({
  loader: async () => {
    const calendarData = await getCalendarData();
    return { calendarData };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { calendarData } = Route.useLoaderData();

  return <CalendarView data={calendarData} />;
}
