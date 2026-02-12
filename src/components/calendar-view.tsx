import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ChevronLeft,
  ChevronRight,
  Landmark,
  Crown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarData, CalendarEvent } from "@/lib/server/calendar";

// Countdown timer component
function CountdownTimer({
  targetDate,
  label,
  icon: Icon,
  color,
}: {
  targetDate: Date;
  label: string;
  icon: any;
  color: string;
}) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Now!");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <Card className={`border-l-4 ${color}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          <CardTitle className="text-sm font-semibold">{label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold font-mono">{timeRemaining}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {targetDate.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })}
        </p>
      </CardContent>
    </Card>
  );
}

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
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Group events by date (excluding bill events)
  const eventsByDate = new Map<string, CalendarEvent[]>();
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Calendar</h1>
        <p className="text-muted-foreground">
          View upcoming elections, bill advances, and important dates
        </p>
      </div>

      {/* Live Countdown Timers */}
      {/* <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.senateElection && (
            <CountdownTimer
              targetDate={new Date(data.senateElection.nextStageTime)}
              label={data.senateElection.nextStageName}
              icon={Landmark}
              color="border-l-blue-500"
            />
          )}
          {data.presidentialElection && (
            <CountdownTimer
              targetDate={new Date(data.presidentialElection.nextStageTime)}
              label={data.presidentialElection.nextStageName}
              icon={Crown}
              color="border-l-purple-500"
            />
          )}
          <CountdownTimer
            targetDate={new Date(data.billAdvance.nextAdvanceTime)}
            label="Bills Advance"
            icon={FileText}
            color="border-l-green-500"
          />
        </div>
      </div> */}

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
