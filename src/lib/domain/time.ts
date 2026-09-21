/** Everything is displayed in the EVENT's timezone, never the viewer's or the server's. */

export function formatTime(d: Date | string, tz: string): string {
  return new Intl.DateTimeFormat("en-NZ", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz })
    .format(new Date(d))
    .replace(/\s?([ap])\.?m\.?/i, (_, x: string) => ` ${x.toUpperCase()}M`);
}

export function formatTimeRange(a: Date | string, b: Date | string, tz: string) {
  return `${formatTime(a, tz)} – ${formatTime(b, tz)}`;
}

/** "Friday 2 October 2026" from a YYYY-MM-DD string. */
export function formatEventDate(dateStr: string | Date, tz = "UTC"): string {
  const s = typeof dateStr === "string" ? dateStr.slice(0, 10) : dateStr.toISOString().slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  return new Intl.DateTimeFormat("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d, 12)))
    .replace(",", "");
}

export function formatDateTime(d: Date | string, tz: string): string {
  return `${new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", timeZone: tz }).format(new Date(d))}, ${formatTime(d, tz)}`;
}

/** Offset (ms) of `tz` from UTC at the given instant. */
function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Wall-clock time in `tz` ("2026-10-02", "18:30") → the UTC instant. */
export function zonedToUtc(dateStr: string, hhmm: string, tz: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let result = guess - tzOffsetMs(new Date(guess), tz);
  result = guess - tzOffsetMs(new Date(result), tz); // second pass handles DST edges
  return new Date(result);
}

/** UTC instant → "HH:MM" wall-clock in `tz` (for <input type="time">). */
export function toHHMM(d: Date | string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(new Date(d));
}

export function timeAgo(d: Date | string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)} d ago`;
}
