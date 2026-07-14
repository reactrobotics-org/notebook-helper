/**
 * Formats a date-only string (e.g. "2026-07-14", with no time component)
 * for display, without letting the browser's local timezone shift it to
 * the previous or next day.
 *
 * Plain `new Date("2026-07-14")` parses as UTC midnight, and
 * `.toLocaleDateString()` then renders it in the browser's local timezone
 * — for any timezone behind UTC (all US timezones), that pushes the
 * displayed date back by one day. Forcing the format itself to read the
 * date in UTC sidesteps that entirely, since there's no local-time
 * conversion happening at all.
 *
 * Only use this for genuine date-only values (meeting_date, etc.) — full
 * timestamps like created_at/updated_at should keep using
 * `new Date(value).toLocaleString()` as normal, since those really are a
 * specific moment in time and converting them to the viewer's local time
 * is the correct behavior.
 */
export function formatDateOnly(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }
): string {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${dateString}T00:00:00Z`));
}
