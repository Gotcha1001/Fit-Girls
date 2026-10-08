// convex/lib/schedule.ts
//
// Shared by Convex (server) AND the Next.js app (browser) -- keep it free of
// imports so both sides can use it. One source of truth for the rules.
//
// All slot maths happens in South African time (SAST, UTC+2, no daylight
// saving), so every viewer sees the same hourly grid whatever their device
// time zone is. A "day index" is the number of SAST days since 1970-01-01.

export const HOUR_MS = 3_600_000;
export const MIN_MS = 60_000;
export const DAY_MS = 86_400_000;

export const SCHEDULE_TZ_OFFSET_MS = 2 * HOUR_MS;
export const SCHEDULE_TZ_LABEL = "SAST";

/** A call can only be booked while its start is at least this far away. */
export const MIN_LEAD_MS = HOUR_MS;
/** How far ahead clients can book. */
export const MAX_DAYS_AHEAD = 30;
/** Most days one availability query may return. */
export const MAX_RANGE_DAYS = 14;
/** Longest single call (must match MAX_MINUTES in bookings.ts). */
export const MAX_CALL_MINUTES = 120;

/** Used for a girl who has never saved her weekly hours: 09:00 to 21:00. */
export const DEFAULT_OPEN_HOURS: readonly number[] = [
  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
];

/** open = bookable, booked = someone else has it, mine = my booking, off = she isn't working. */
export type SlotState = "open" | "booked" | "mine" | "off";

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const mod = (n: number, m: number): number => ((n % m) + m) % m;

// ───────────── day / hour maths ─────────────

export function dayIndexOf(ts: number): number {
  return Math.floor((ts + SCHEDULE_TZ_OFFSET_MS) / DAY_MS);
}

/** Epoch ms of 00:00 SAST on that day. */
export function dayStartMs(dayIndex: number): number {
  return dayIndex * DAY_MS - SCHEDULE_TZ_OFFSET_MS;
}

/** 0 = Monday ... 6 = Sunday. (1970-01-01 was a Thursday.) */
export function weekdayOf(dayIndex: number): number {
  return mod(dayIndex + 3, 7);
}

/** Hour of day (0-23) in SAST. */
export function hourOf(ts: number): number {
  return Math.floor(mod(ts + SCHEDULE_TZ_OFFSET_MS, DAY_MS) / HOUR_MS);
}

export function slotStartMs(dayIndex: number, hour: number): number {
  return dayStartMs(dayIndex) + hour * HOUR_MS;
}

// ───────────── booking rules ─────────────

/** True while a slot starting at `startsAt` can still be booked. */
export function isSlotBookable(startsAt: number, now: number): boolean {
  return startsAt >= now + MIN_LEAD_MS;
}

/** Moment bookings for that slot close. */
export function bookingClosesAt(startsAt: number): number {
  return startsAt - MIN_LEAD_MS;
}

export function lastBookableDay(now: number): number {
  return dayIndexOf(now) + MAX_DAYS_AHEAD;
}

// ───────────── formatting (display only) ─────────────

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** "14:30" in SAST. */
export function formatTime(ts: number): string {
  const local = mod(ts + SCHEDULE_TZ_OFFSET_MS, DAY_MS);
  const h = Math.floor(local / HOUR_MS);
  const m = Math.floor((local % HOUR_MS) / MIN_MS);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTimeRange(startsAt: number, endsAt: number): string {
  return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}

const dayDate = (dayIndex: number): Date => new Date(dayIndex * DAY_MS);

/** "Wednesday 7 October" */
export function formatDayLong(dayIndex: number): string {
  return dayDate(dayIndex).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** "Wed 7 Oct" */
export function formatDayShort(dayIndex: number): string {
  return dayDate(dayIndex).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function dayOfMonth(dayIndex: number): number {
  return dayDate(dayIndex).getUTCDate();
}

/** "Today", "Tomorrow", otherwise "Friday". */
export function relativeDayLabel(dayIndex: number, todayIndex: number): string {
  if (dayIndex === todayIndex) return "Today";
  if (dayIndex === todayIndex + 1) return "Tomorrow";
  if (dayIndex === todayIndex - 1) return "Yesterday";
  return WEEKDAY_LONG[weekdayOf(dayIndex)];
}

// ───────────── bridge to the shadcn <Calendar> (uses local Dates) ─────────────

export function dayIndexToLocalDate(dayIndex: number): Date {
  const d = dayDate(dayIndex);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function localDateToDayIndex(date: Date): number {
  return Math.round(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );
}

/** Call lengths offered in the UI. */
export function durationOptions(
  minMinutes: number,
  maxMinutes: number,
): number[] {
  const set = new Set<number>();
  for (const n of [1, 2, 3, 4]) set.add(minMinutes * n);
  for (const m of [60, 90, 120]) set.add(m);
  return [...set]
    .filter(
      (m) => m >= minMinutes && m <= Math.min(maxMinutes, MAX_CALL_MINUTES),
    )
    .sort((a, b) => a - b);
}
