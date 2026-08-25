const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parses "2027-01-25" or "2027-01-25T11:45" as a *local* date, matching countdown.ts. */
function parseLocal(value: string): Date {
  const [date, time] = value.split("T");
  return new Date(`${date}T${time ?? "00:00"}:00`);
}

/**
 * Some ICU builds render Dutch abbreviated months with a trailing period
 * ("jan." on one browser, "jan" on another). The trip's own writing style has
 * no period, and a date string that changes shape per browser is worse than
 * either choice, so it's stripped.
 */
function trimAbbrev(value: string): string {
  return value.replace(/\.$/, "");
}

const dayFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric" });
const monthFmt = new Intl.DateTimeFormat("nl-NL", { month: "short" });
const weekdayFmt = new Intl.DateTimeFormat("nl-NL", { weekday: "short" });
const longDayMonthFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" });

/** Date part of an ISO timestamp: "2027-01-25T11:45" → "2027-01-25". */
export function toDateOnly(value: string): string {
  return value.split("T")[0];
}

/** Time part of an ISO timestamp: "2027-01-25T11:45" → "11:45". */
export function toTimeOnly(value: string): string {
  return value.split("T")[1] ?? "";
}

/** "2027-01-25" + 3 → "2027-01-28". Day arithmetic only, so DST can't shift it. */
export function addDays(dateOnly: string, days: number): string {
  const date = parseLocal(dateOnly);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from `from` to `to`. Negative when `to` comes first. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseLocal(toDateOnly(to)).getTime() - parseLocal(toDateOnly(from)).getTime()) / MS_PER_DAY);
}

/** "2027-01-25" → "25 jan". */
export function formatDayMonth(dateOnly: string): string {
  const date = parseLocal(dateOnly);
  return `${dayFmt.format(date)} ${trimAbbrev(monthFmt.format(date))}`;
}

/** "2027-01-25" → "ma 25 jan". */
export function formatWeekdayDayMonth(dateOnly: string): string {
  const date = parseLocal(dateOnly);
  return `${trimAbbrev(weekdayFmt.format(date))} ${formatDayMonth(dateOnly)}`;
}

/** "2027-01-26T06:10" → "26 jan 06:10". The date is always shown: an overnight flight lands on another day. */
export function formatDayMonthTime(value: string): string {
  return `${formatDayMonth(toDateOnly(value))} ${toTimeOnly(value)}`;
}

/**
 * A stop's check-in to check-out line, the way you'd fill in a booking:
 * "wo 27 tot vr 29 jan". The month is named once when both dates share it and
 * twice when they don't ("vr 29 jan tot ma 1 feb"), which is how you'd say it
 * out loud. A stopover (0 nights) has no departure day of its own, so it names
 * one date: "zo 7 feb".
 */
export function formatStopDates(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatWeekdayDayMonth(startDate);

  const sameMonth = startDate.slice(0, 7) === endDate.slice(0, 7);
  const start = parseLocal(startDate);
  const startLabel = sameMonth
    ? `${trimAbbrev(weekdayFmt.format(start))} ${dayFmt.format(start)}`
    : formatWeekdayDayMonth(startDate);

  return `${startLabel} tot ${formatWeekdayDayMonth(endDate)}`;
}

export function formatDateRange(start: string, end: string): string {
  const startDate = parseLocal(start);
  const endDate = parseLocal(end);
  const year = endDate.getFullYear();
  return `${longDayMonthFmt.format(startDate)} – ${longDayMonthFmt.format(endDate)} ${year}`;
}
