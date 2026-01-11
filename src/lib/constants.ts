export const leanings = [
  "Far Left",
  "Left",
  "Center Left",
  "Center",
  "Center Right",
  "Right",
  "Far Right",
];

export function getLastSeenText(lastActivity: number | null): string {
  if (!lastActivity || lastActivity < 0) {
    return "Unknown";
  }
  if (lastActivity === 0) {
    return "Today";
  }
  if (lastActivity === 1) {
    return "1 day ago";
  }
  return `${lastActivity} days ago`;
}
