// // convex/lib/slots.ts
// //
// // Extra slot helpers that sit next to convex/lib/schedule.ts.
// // Import-free apart from schedule.ts, so Convex AND the Next.js app can use it.
// //
// // Rule of the calendar: the grid is hourly (SAST). A call reserves every
// // hourly slot it touches, so a 10-minute call at 14:00 blocks 14:00-15:00 and a
// // 90-minute call at 14:00 blocks 14:00 and 15:00. That also gives the girl a
// // few minutes' buffer between calls.

// import { HOUR_MS, MIN_MS } from "./schedule";

// export const ALL_HOURS: readonly number[] = Array.from(
//   { length: 24 },
//   (_, i) => i,
// );

// /** Calls must start exactly on the hour (SAST has whole-hour offset, so epoch maths works). */
// export function isOnTheHour(ts: number): boolean {
//   return Number.isInteger(ts) && ts % HOUR_MS === 0;
// }

// /** How many hourly slots a call of this length reserves. */
// export function hoursNeeded(minutes: number): number {
//   return Math.max(1, Math.ceil(minutes / 60));
// }

// /** Start timestamps of every hourly slot touched by [startsAt, endsAt). */
// export function slotStartsBetween(startsAt: number, endsAt: number): number[] {
//   const out: number[] = [];
//   for (
//     let t = Math.floor(startsAt / HOUR_MS) * HOUR_MS;
//     t < endsAt;
//     t += HOUR_MS
//   ) {
//     out.push(t);
//   }
//   return out;
// }

// export function slotStartsFor(startsAt: number, minutes: number): number[] {
//   return slotStartsBetween(startsAt, startsAt + minutes * MIN_MS);
// }

// /** "2d 4h", "3h 05m", "12m 09s", "45s". */
// export function formatCountdown(ms: number): string {
//   if (ms <= 0) return "0s";
//   const total = Math.floor(ms / 1000);
//   const d = Math.floor(total / 86_400);
//   const h = Math.floor((total % 86_400) / 3_600);
//   const m = Math.floor((total % 3_600) / 60);
//   const s = total % 60;
//   if (d > 0) return `${d}d ${h}h`;
//   if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
//   if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
//   return `${s}s`;
// }
// convex/lib/slots.ts
//
// Slot helpers that sit next to convex/lib/schedule.ts.
// Import-free apart from schedule.ts, so Convex AND the Next.js app can use it.
//
// RULES OF THE CALENDAR (SAST)
//   1. Working hours are still whole hours (09:00, 10:00 ...).
//   2. A call can START on any 5-minute mark inside her working hours.
//   3. There must always be a GAP_MINUTES (5 min) break between two calls,
//      before and after every booking, so she can prepare.
//   4. A call must finish inside her working hours and before midnight.
//
// The client calendar asks `openStarts` "where can a call of N minutes go?".
// The server (createBooking) re-checks the same rules, so the two can't disagree.
//
// Examples with a 10-minute call and a 5-minute gap (pitch = 15 min):
//   14:00  14:15  14:30  14:45   -> 4 calls per hour (the last ends 14:55)
// With a 20-minute call (pitch = 25 min):
//   14:00  14:25  14:50  15:15 ...  (calls may run over the hour mark)
// After someone books 14:15-14:25 the packing re-starts after that booking:
//   14:00 (ends 14:10, 5 min gap, fits)  14:30  14:45  15:00 ...

// convex/lib/slots.ts
//
// Pure slot maths, shared by Convex and the browser. No database access.
//
// Rule: every call needs GAP_MS (5 min) of free time on both sides, so a
// 10-minute call fits 4 times an hour: :00-:10, :15-:25, :30-:40, :45-:55.
import { GAP_MS, HOUR_MS, MIN_MS, SLOT_GRID_MS, dayStartMs } from "./schedule";

export const ALL_HOURS: readonly number[] = Array.from(
  { length: 24 },
  (_, i) => i,
);

/** A booked block of time. */
export type Busy = { startsAt: number; endsAt: number };

/** True when `ts` sits on a 5-minute mark (SAST is a whole-hour offset, so epoch maths works). */
export function isOnGrid(ts: number): boolean {
  return Number.isInteger(ts) && ts % SLOT_GRID_MS === 0;
}

/** Round up to the next 5-minute mark. */
export function ceilToGrid(ts: number): number {
  return Math.ceil(ts / SLOT_GRID_MS) * SLOT_GRID_MS;
}

/**
 * Would a call at [startsAt, endsAt) break the gap rule against any booking in
 * `busy`? Overlapping is a clash, and so is being closer than GAP_MS.
 */
export function clashesWithGap(
  startsAt: number,
  endsAt: number,
  busy: readonly Busy[],
): boolean {
  return busy.some(
    (b) => startsAt < b.endsAt + GAP_MS && b.startsAt < endsAt + GAP_MS,
  );
}

/**
 * Her working hours as unbroken runs, in ms. Hours 9,10,11 and 14,15 give
 * [[09:00, 12:00], [14:00, 16:00]]. A call can't bridge two runs.
 */
export function openRuns(
  dayIndex: number,
  openHours: readonly number[],
): Array<readonly [number, number]> {
  const hours = [...new Set(openHours)].sort((a, b) => a - b);
  const dayStart = dayStartMs(dayIndex);
  const runs: Array<readonly [number, number]> = [];
  let firstHour = -1;
  let lastHour = -2;
  for (const h of hours) {
    if (h !== lastHour + 1) {
      if (firstHour >= 0) {
        runs.push([
          dayStart + firstHour * HOUR_MS,
          dayStart + (lastHour + 1) * HOUR_MS,
        ]);
      }
      firstHour = h;
    }
    lastHour = h;
  }
  if (firstHour >= 0) {
    runs.push([
      dayStart + firstHour * HOUR_MS,
      dayStart + (lastHour + 1) * HOUR_MS,
    ]);
  }
  return runs;
}

/** Does [startsAt, endsAt) sit fully inside one of her working runs? */
export function fitsInRuns(
  startsAt: number,
  endsAt: number,
  runs: ReadonlyArray<readonly [number, number]>,
): boolean {
  return runs.some(([from, to]) => startsAt >= from && endsAt <= to);
}

/**
 * Every start time where a call of `minutes` fits that day, packed as tightly
 * as the gap allows (10 min -> :00 :15 :30 :45). Does NOT apply the 1-hour
 * lead time: the client does that against its live clock, so the list stays
 * right as time passes without re-running the query.
 */
export function openStarts(opts: {
  dayIndex: number;
  openHours: readonly number[];
  busy: readonly Busy[];
  minutes: number;
}): number[] {
  const { dayIndex, openHours, busy, minutes } = opts;
  const duration = minutes * MIN_MS;
  const sorted = [...busy].sort((a, b) => a.startsAt - b.startsAt);
  const out: number[] = [];
  for (const [runStart, runEnd] of openRuns(dayIndex, openHours)) {
    let t = runStart;
    while (t + duration <= runEnd) {
      const hit = sorted.find(
        (b) => t < b.endsAt + GAP_MS && b.startsAt < t + duration + GAP_MS,
      );
      if (hit) {
        // Jump to the first free moment after that booking and its gap.
        t = ceilToGrid(hit.endsAt + GAP_MS);
        continue;
      }
      out.push(t);
      // Next call starts after this one plus the gap.
      t = ceilToGrid(t + duration + GAP_MS);
    }
  }
  return out;
}

/** Start timestamps of every whole-hour block touched by [startsAt, endsAt). */
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
