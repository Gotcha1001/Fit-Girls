// convex/lib/slots.ts
//
// Extra slot helpers that sit next to convex/lib/schedule.ts.
// Import-free apart from schedule.ts, so Convex AND the Next.js app can use it.
//
// Rule of the calendar: the grid is hourly (SAST). A call reserves every
// hourly slot it touches, so a 10-minute call at 14:00 blocks 14:00-15:00 and a
// 90-minute call at 14:00 blocks 14:00 and 15:00. That also gives the girl a
// few minutes' buffer between calls.

import { HOUR_MS, MIN_MS } from "./schedule";

export const ALL_HOURS: readonly number[] = Array.from(
  { length: 24 },
  (_, i) => i,
);

/** Calls must start exactly on the hour (SAST has whole-hour offset, so epoch maths works). */
export function isOnTheHour(ts: number): boolean {
  return Number.isInteger(ts) && ts % HOUR_MS === 0;
}

/** How many hourly slots a call of this length reserves. */
export function hoursNeeded(minutes: number): number {
  return Math.max(1, Math.ceil(minutes / 60));
}

/** Start timestamps of every hourly slot touched by [startsAt, endsAt). */
export function slotStartsBetween(startsAt: number, endsAt: number): number[] {
  const out: number[] = [];
  for (
    let t = Math.floor(startsAt / HOUR_MS) * HOUR_MS;
    t < endsAt;
    t += HOUR_MS
  ) {
    out.push(t);
  }
  return out;
}

export function slotStartsFor(startsAt: number, minutes: number): number[] {
  return slotStartsBetween(startsAt, startsAt + minutes * MIN_MS);
}

/** "2d 4h", "3h 05m", "12m 09s", "45s". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}
