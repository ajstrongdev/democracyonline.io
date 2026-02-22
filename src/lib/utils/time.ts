/** Returns the next top-of-hour on UTC boundaries. */
export function getNextTopOfUtcHour(now: Date): Date {
  const target = new Date(now);
  target.setUTCMinutes(0, 0, 0);
  if (target < now) {
    target.setUTCHours(target.getUTCHours() + 1);
  }
  return target;
}
