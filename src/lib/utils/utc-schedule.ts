export const DEFAULT_HOURLY_ADVANCE_SCHEDULE_UTC = "0 * * * *";
export const DEFAULT_BILL_ADVANCE_SCHEDULE_UTC = "0 4,12,20 * * *";
export const DEFAULT_GAME_ADVANCE_SCHEDULE_UTC = "0 20 * * *";

type ParsedUtcCronSchedule = {
  minuteValues: Array<number>;
  hourValues: Array<number>;
};

function parseFieldToken(token: string): number {
  const value = Number.parseInt(token, 10);
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid numeric token: ${token}`);
  }
  return value;
}

function parseUtcCronField(
  field: string,
  min: number,
  max: number,
): Array<number> {
  if (field === "*") {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  if (field.startsWith("*/")) {
    const step = parseFieldToken(field.slice(2));
    if (step <= 0 || step > max) {
      throw new Error(`Invalid step value: ${field}`);
    }

    const values: Array<number> = [];
    for (let value = min; value <= max; value += step) {
      values.push(value);
    }
    return values;
  }

  const values = field.split(",").map((token) => {
    const value = parseFieldToken(token);
    if (value < min || value > max) {
      throw new Error(`Out-of-range value: ${value}`);
    }
    return value;
  });

  return Array.from(new Set(values)).sort((a, b) => a - b);
}

export function parseUtcCronSchedule(schedule: string): ParsedUtcCronSchedule {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Expected 5 cron fields, got ${fields.length}`);
  }

  const [minuteField, hourField, dayOfMonth, month, dayOfWeek] = fields;

  // Timer displays only support recurring daily/hourly patterns in UTC.
  if (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") {
    throw new Error("Only '*' is supported for day/month/week fields");
  }

  return {
    minuteValues: parseUtcCronField(minuteField, 0, 59),
    hourValues: parseUtcCronField(hourField, 0, 23),
  };
}

function includesValue(values: Array<number>, value: number): boolean {
  return values.includes(value);
}

function matchesUtcSchedule(
  parsed: ParsedUtcCronSchedule,
  time: Date,
): boolean {
  return (
    includesValue(parsed.minuteValues, time.getUTCMinutes()) &&
    includesValue(parsed.hourValues, time.getUTCHours())
  );
}

export function getNextUtcTimeFromCron(schedule: string, now: Date): Date {
  const parsed = parseUtcCronSchedule(schedule);
  const candidate = new Date(now);
  candidate.setUTCSeconds(0, 0);

  // If we're partway through a minute, move to the next minute.
  if (now.getUTCSeconds() !== 0 || now.getUTCMilliseconds() !== 0) {
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }

  const MAX_MINUTES_TO_SCAN = 60 * 24 * 14;
  for (let i = 0; i < MAX_MINUTES_TO_SCAN; i++) {
    if (matchesUtcSchedule(parsed, candidate)) {
      return candidate;
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }

  throw new Error(`Could not find next UTC time for schedule: ${schedule}`);
}

export function resolveUtcCronSchedule(
  schedule: string,
  fallback: string,
): string {
  try {
    parseUtcCronSchedule(schedule);
    return schedule;
  } catch {
    return fallback;
  }
}

export function getSingleDailyUtcAnchor(
  schedule: string,
): { hour: number; minute: number } | null {
  const parsed = parseUtcCronSchedule(schedule);
  if (parsed.hourValues.length !== 1 || parsed.minuteValues.length !== 1) {
    return null;
  }

  return {
    hour: parsed.hourValues[0],
    minute: parsed.minuteValues[0],
  };
}
