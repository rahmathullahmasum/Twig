const UNITS: { limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60, divisor: 1, unit: "second" },
  { limit: 3600, divisor: 60, unit: "minute" },
  { limit: 86400, divisor: 3600, unit: "hour" },
  { limit: 2592000, divisor: 86400, unit: "day" },
  { limit: 31536000, divisor: 2592000, unit: "month" },
  { limit: Infinity, divisor: 31536000, unit: "year" },
];

const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "2 hours ago", "in 3 days", etc. Falls back gracefully for far-future/past dates. */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const target = typeof date === "string" ? new Date(date) : date;
  const seconds = (target.getTime() - Date.now()) / 1000;
  const absSeconds = Math.abs(seconds);

  for (const { limit, divisor, unit } of UNITS) {
    if (absSeconds < limit) {
      return formatter.format(Math.round(seconds / divisor), unit);
    }
  }
  return target.toLocaleDateString();
}
