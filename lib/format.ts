const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format an ISO date, ISO timestamp, or RSS pubDate for display
 * (e.g. "Oct 13, 2026"); falls back to the raw text if unparseable.
 *
 * Uses a fixed time zone so server and browser render the same string
 * (no hydration mismatch). Date-only values are read as calendar dates;
 * timestamps are shown in Massachusetts time.
 */
export function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: DATE_ONLY.test(value) ? "UTC" : "America/New_York",
  });
}
