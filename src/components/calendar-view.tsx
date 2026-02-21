import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ScrollText,
  Gamepad2,
} from "lucide-react";
import type { CalendarData, CalendarEvent } from "@/lib/server/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// Event type configuration
const eventTypeConfig = {
  senate: {
    dot: "bg-blue-500",
    bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30",
  },
  president: {
    dot: "bg-purple-500",
    bg: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30",
  },
  bill: {
    dot: "bg-green-500",
    bg: "bg-green-500/10 hover:bg-green-500/20 border-green-500/30",
  },
  results: {
    dot: "bg-orange-500",
    bg: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30",
  },
};

// Mini event display for calendar cells
function MiniEventBadge({ event }: { event: CalendarEvent }) {
  const config = eventTypeConfig[event.type];
  return (
    <div
      className={`text-xs px-1.5 py-0.5 rounded border ${config.bg} truncate`}
      title={event.title}
    >
      <div className="flex items-center gap-1">
        <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        <span className="truncate">{event.title}</span>
      </div>
    </div>
  );
}

/** Returns the next occurrence of a given UTC hour (0-23) */
function getNextUtcHour(hour: number, now: Date): Date {
  const target = new Date(now);
  target.setUTCMinutes(0, 0, 0);
  target.setUTCHours(hour);
  if (target <= now) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
}

/** Returns the next top-of-the-hour */
function getNextTopOfHour(now: Date): Date {
  const target = new Date(now);
  target.setMinutes(0, 0, 0);
  target.setHours(target.getHours() + 1);
  return target;
}

/** Returns the soonest of the given UTC hours */
function getNextOfUtcHours(hours: number[], now: Date): Date {
  const candidates = hours.map((h) => getNextUtcHour(h, now));
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0];
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function LiveTimers() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const nextMarket = getNextTopOfHour(now);
  const nextBills = getNextOfUtcHours([4, 12, 20], now); // 4am/12pm/8pm GMT
  const nextGame = getNextUtcHour(20, now); // 8pm GMT daily

  const timers = [
    {
      icon: TrendingUp,
      label: "Hourly tick",
      time: nextMarket,
      color: "text-emerald-500",
      bg: "bg-linear-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
      iconBg: "bg-emerald-500/10",
      description:
        "Dividends, stock prices, order matching, and election campaign ticks.",
    },
    {
      icon: ScrollText,
      label: "Bills progress",
      time: nextBills,
      color: "text-blue-500",
      bg: "bg-linear-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20",
      iconBg: "bg-blue-500/10",
      description: "A bill progresses to the next stage.",
    },
    {
      icon: Gamepad2,
      label: "Daily game update",
      time: nextGame,
      color: "text-purple-500",
      bg: "bg-linear-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20",
      iconBg: "bg-purple-500/10",
      description:
        "Elections progress, party fees collected, inactive users processed.",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
      {timers.map((t) => {
        const ms = t.time.getTime() - now.getTime();
        const countdown = formatCountdown(ms);
        return (
          <Card key={t.label} className={t.bg}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`p-2 rounded-md ${t.iconBg}`}>
                  <t.icon className={`h-4 w-4 ${t.color}`} />
                </div>
                <span className="font-semibold text-sm">{t.label}</span>
              </div>
              <div className="text-2xl font-bold tabular-nums tracking-tight mb-2">
                {countdown}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function CalendarView({ data }: { data: CalendarData }) {
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-6"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const now = new Date();

  // Filter out bill events from calendar display
  const calendarEvents = data.upcomingEvents.filter((e) => e.type !== "bill");

  const todayEvents = calendarEvents.filter((e) => {
    return (
      e.date.getDate() === now.getDate() &&
      e.date.getMonth() === now.getMonth() &&
      e.date.getFullYear() === now.getFullYear()
    );
  });

  // Get calendar month data
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Create calendar grid
  const calendarDays: Array<number | null> = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Group events by date (excluding bill events)
  const eventsByDate = new Map<string, Array<CalendarEvent>>();
  calendarEvents.forEach((event) => {
    const dateKey = `${event.date.getFullYear()}-${event.date.getMonth()}-${event.date.getDate()}`;
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  });

  const getEventsForDay = (day: number) => {
    const dateKey = `${year}-${month}-${day}`;
    return eventsByDate.get(dateKey) || [];
  };

  const isToday = (day: number) => {
    return (
      day === now.getDate() &&
      month === now.getMonth() &&
      year === now.getFullYear()
    );
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const selectedDayEvents = selectedDate
    ? getEventsForDay(selectedDate.getDate())
    : [];

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="my-6">
        <h1 className="text-3xl font-bold mb-2">Calendar</h1>
        <p className="text-muted-foreground">
          View upcoming elections, bill advances, and important dates
        </p>
      </div>

      {/* Live Countdown Timers */}
      <LiveTimers />

      {/* Today's Events Alert */}
      {todayEvents.length > 0 && (
        <Alert className="mb-6">
          <AlertTitle className="font-bold">Today's Events</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {todayEvents.map((event, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div
                    className={`w-2 h-2 rounded-full ${eventTypeConfig[event.type].dot}`}
                  />
                  <span className="font-medium">{event.title}</span>
                  <span className="text-muted-foreground">
                    at{" "}
                    {event.date.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">
                  {currentDate.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={goToPreviousMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={goToNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div
                      key={day}
                      className="text-center text-sm font-semibold text-muted-foreground py-2"
                    >
                      {day}
                    </div>
                  ),
                )}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="h-24" />;
                  }

                  const dayEvents = getEventsForDay(day);
                  const isTodayDate = isToday(day);
                  const isSelected =
                    selectedDate?.getDate() === day &&
                    selectedDate?.getMonth() === month &&
                    selectedDate?.getFullYear() === year;

                  return (
                    <button
                      key={day}
                      onClick={() =>
                        setSelectedDate(new Date(year, month, day))
                      }
                      className={`h-24 border rounded-lg p-2 text-left transition-colors relative overflow-hidden ${
                        isTodayDate
                          ? "border-primary bg-primary/5 font-semibold"
                          : "hover:bg-muted/50"
                      } ${isSelected ? "ring-2 ring-primary" : ""}`}
                    >
                      <div className="text-sm mb-1">{day}</div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((event, eventIndex) => (
                          <MiniEventBadge key={eventIndex} event={event} />
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-6 pt-6 border-t">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>Senate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span>President</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span>Results</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Event Details Sidebar */}
        <div>
          <Card>
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-4">
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Select a date"}
              </h3>

              {selectedDate && selectedDayEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayEvents.map((event, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${eventTypeConfig[event.type].bg}`}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 ${eventTypeConfig[event.type].dot}`}
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-sm">
                            {event.title}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {event.date.toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                              timeZoneName: "short",
                            })}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground pl-4">
                        {event.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : selectedDate ? (
                <p className="text-sm text-muted-foreground">
                  No events scheduled for this day.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Click on a date to view events.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
