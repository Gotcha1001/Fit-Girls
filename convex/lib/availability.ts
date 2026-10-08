// convex/lib/availability.ts
//
// SERVER-ONLY helpers that turn "weekly hours + one-day overrides + bookings"
// into the hourly calendar. Used by convex/calendar.ts (what the calendar
// shows) AND by convex/bookings.ts (what createBooking allows), so what a
// client sees and what the server accepts can never disagree.
//
// The pure rules (SAST maths, 1-hour lead time, slot maths) live in
// ./schedule.ts and ./slots.ts, which the browser also imports.

import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  DEFAULT_OPEN_HOURS,
  HOUR_MS,
  MAX_CALL_MINUTES,
  MIN_MS,
  dayStartMs,
  weekdayOf,
  type SlotState,
} from "./schedule";
import { ALL_HOURS, slotStartsBetween } from "./slots";
import { getCurrentUser } from "./auth";

type Ctx = QueryCtx | MutationCtx;
type BookingDoc = Doc<"bookings">;

/** weekday (0 = Mon) -> open hours. `null` means she never saved her hours. */
export type WeeklyHours = Map<number, number[]> | null;

/** A booking starting this long before a window can still reach into it. */
const LOOKBACK_MS = (MAX_CALL_MINUTES + 60) * MIN_MS;

// ───────────── bookings ─────────────

/** Cancelled, expired and refunded bookings give the slot back. */
export function holdsSlot(status: BookingDoc["status"]): boolean {
  return (
    status !== "cancelled" && status !== "expired" && status !== "refunded"
  );
}

export function bookingEnd(b: BookingDoc): number {
  return b.endsAt ?? b.startsAt + b.minutes * MIN_MS;
}

/** Every hourly slot this booking reserves (a 90-min call at 14:00 = 14:00 and 15:00). */
export function bookingSlots(b: BookingDoc): number[] {
  return slotStartsBetween(b.startsAt, bookingEnd(b));
}

/**
 * Bookings of one girl that reserve at least one hourly slot inside
 * [fromMs, toMs). Only bookings that still hold their slot are returned.
 * Uses the by_host_time index, so it never scans her whole history.
 */
export async function bookingsTouching(
  ctx: Ctx,
  hostId: Id<"hosts">,
  fromMs: number,
  toMs: number,
): Promise<BookingDoc[]> {
  const rows = await ctx.db
    .query("bookings")
    .withIndex("by_host_time", (q) =>
      q
        .eq("hostId", hostId)
        .gte("startsAt", fromMs - LOOKBACK_MS)
        .lt("startsAt", toMs),
    )
    .collect();
  return rows.filter(
    (b) =>
      holdsSlot(b.status) &&
      bookingSlots(b).some((s) => s >= fromMs && s < toMs),
  );
}

// ───────────── working hours ─────────────

/** Validates and sorts a list of hours (0-23). Throws a readable error. */
export function cleanHours(input: number[]): number[] {
  const set = new Set<number>();
  for (const h of input) {
    if (!Number.isInteger(h) || h < 0 || h > 23) {
      throw new Error("Hours must be whole numbers from 0 to 23");
    }
    set.add(h);
  }
  return [...set].sort((a, b) => a - b);
}

export async function loadWeekly(
  ctx: Ctx,
  hostId: Id<"hosts">,
): Promise<WeeklyHours> {
  const rows = await ctx.db
    .query("hostWeeklyHours")
    .withIndex("by_host", (q) => q.eq("hostId", hostId))
    .collect();
  if (rows.length === 0) return null;
  return new Map(rows.map((r) => [r.weekday, r.hours]));
}

/** Her usual hours for a weekday, before any one-day change. */
export function usualHoursFor(
  weekly: WeeklyHours,
  weekday: number,
): readonly number[] {
  if (weekly === null) return DEFAULT_OPEN_HOURS;
  return weekly.get(weekday) ?? [];
}

/** One-day overrides in an inclusive range of day indexes. */
export async function loadOverrides(
  ctx: Ctx,
  hostId: Id<"hosts">,
  firstDay: number,
  lastDay: number,
): Promise<Map<number, number[]>> {
  const rows = await ctx.db
    .query("hostDayOverrides")
    .withIndex("by_host_day", (q) =>
      q.eq("hostId", hostId).gte("dayIndex", firstDay).lte("dayIndex", lastDay),
    )
    .collect();
  return new Map(rows.map((r) => [r.dayIndex, r.hours]));
}

/** The hours she works on one date: the override if there is one, else her usual hours. */
export function effectiveHours(
  weekly: WeeklyHours,
  overrides: Map<number, number[]>,
  dayIndex: number,
): { hours: number[]; isOverride: boolean } {
  const override = overrides.get(dayIndex);
  if (override) return { hours: override, isOverride: true };
  return {
    hours: [...usualHoursFor(weekly, weekdayOf(dayIndex))],
    isOverride: false,
  };
}

/** Same as effectiveHours, for a single day (used inside createBooking). */
export async function workingHoursOn(
  ctx: Ctx,
  hostId: Id<"hosts">,
  weekly: WeeklyHours,
  dayIndex: number,
): Promise<Set<number>> {
  const overrides = await loadOverrides(ctx, hostId, dayIndex, dayIndex);
  return new Set(effectiveHours(weekly, overrides, dayIndex).hours);
}

// ───────────── the calendar for one day ─────────────

/**
 * 24 slot states for one day.
 *   off    = she isn't working that hour
 *   open   = free (the client still applies the 1-hour lead time on top)
 *   booked = someone else has it (never says who)
 *   mine   = the viewer's own booking
 * A booking always wins over "off", so a booking made earlier is never hidden
 * if she later trims her hours.
 */
export function daySlotStates(
  dayIndex: number,
  openHours: readonly number[],
  bookings: readonly BookingDoc[],
  viewerId: Id<"users"> | null,
): SlotState[] {
  const open = new Set(openHours);
  const states: SlotState[] = ALL_HOURS.map((h) =>
    open.has(h) ? "open" : "off",
  );
  const dayStart = dayStartMs(dayIndex);
  for (const b of bookings) {
    for (const slot of bookingSlots(b)) {
      const i = (slot - dayStart) / HOUR_MS;
      if (Number.isInteger(i) && i >= 0 && i < 24) {
        states[i] =
          viewerId !== null && b.guestId === viewerId ? "mine" : "booked";
      }
    }
  }
  return states;
}

// ───────────── who is this girl? ─────────────

export async function findMyHost(
  ctx: Ctx,
): Promise<{ user: Doc<"users">; host: Doc<"hosts"> } | null> {
  const user = await getCurrentUser(ctx);
  if (!user || user.role !== "host") return null;
  const host = await ctx.db
    .query("hosts")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();
  return host ? { user, host } : null;
}

export async function requireMyHost(
  ctx: Ctx,
): Promise<{ user: Doc<"users">; host: Doc<"hosts"> }> {
  const me = await findMyHost(ctx);
  if (!me)
    throw new Error("Only girls with a saved profile can manage a schedule");
  return me;
}
