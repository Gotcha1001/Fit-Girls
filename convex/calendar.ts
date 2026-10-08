// convex/calendar.ts
import {
  dayIndexOf,
  dayStartMs,
  lastBookableDay,
  MAX_CALL_MINUTES,
  MAX_RANGE_DAYS,
  MIN_LEAD_MS,
  HOUR_MS,
} from "./lib/schedule";
import {
  bookingEnd,
  bookingsTouching,
  cleanHours,
  daySlotStates,
  effectiveHours,
  loadOverrides,
  loadWeekly,
  requireMyHost,
  findMyHost,
} from "./lib/availability";
import { openStarts } from "./lib/slots";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./lib/auth";

// ───────────── PUBLIC (client booking calendar) ─────────────

/** One day’s 24 slot states for a host. Applies 1-hour lead time. */
export const getDay = query({
  args: {
    hostId: v.id("hosts"),
    dayIndex: v.number(),
    minutes: v.number(),
  },
  handler: async (ctx, { hostId, dayIndex, minutes }) => {
    if (
      !Number.isInteger(minutes) ||
      minutes <= 0 ||
      minutes > MAX_CALL_MINUTES
    ) {
      return null;
    }
    const now = Date.now();
    const today = dayIndexOf(now);
    if (dayIndex < today || dayIndex > lastBookableDay(now)) return null;

    const host = await ctx.db.get(hostId);
    if (!host || host.status !== "approved") return null;

    const weekly = await loadWeekly(ctx, hostId);
    const overrides = await loadOverrides(ctx, hostId, dayIndex, dayIndex);
    const { hours, isOverride } = effectiveHours(weekly, overrides, dayIndex);

    const fromMs = dayStartMs(dayIndex);
    const toMs = fromMs + 24 * HOUR_MS;
    // +1 hour so a call that starts just after midnight still protects the
    // 5-minute gap at the very end of this day.
    const bookings = await bookingsTouching(
      ctx,
      hostId,
      fromMs,
      toMs + HOUR_MS,
    );
    const viewer = await getCurrentUser(ctx);

    const busy = bookings.map((b) => ({
      startsAt: b.startsAt,
      endsAt: bookingEnd(b),
    }));
    const slots = openStarts({ dayIndex, openHours: hours, busy, minutes });

    const segments = bookings.map((b) => ({
      startsAt: b.startsAt,
      endsAt: bookingEnd(b),
      mine: viewer !== null && b.guestId === viewer._id,
    }));

    return {
      dayIndex,
      isOverride,
      hours,
      slots,
      segments,
      hostName: host.displayName,
      ratePerMinuteCents: host.ratePerMinuteCents,
      minMinutes: host.minMinutes,
    };
  },
});

/** Multi-day range (week view). Max MAX_RANGE_DAYS. */
export const getRange = query({
  args: {
    hostId: v.id("hosts"),
    fromDay: v.number(),
    toDay: v.number(), // inclusive
  },
  handler: async (ctx, { hostId, fromDay, toDay }) => {
    if (toDay < fromDay || toDay - fromDay + 1 > MAX_RANGE_DAYS) {
      throw new Error(`Range must be 1–${MAX_RANGE_DAYS} days`);
    }

    const now = Date.now();
    const today = dayIndexOf(now);
    const last = lastBookableDay(now);

    const host = await ctx.db.get(hostId);
    if (!host || host.status !== "approved") return [];

    const weekly = await loadWeekly(ctx, hostId);
    const overrides = await loadOverrides(ctx, hostId, fromDay, toDay);
    const fromMs = dayStartMs(fromDay);
    const toMs = dayStartMs(toDay + 1);
    const bookings = await bookingsTouching(ctx, hostId, fromMs, toMs);
    const viewer = await getCurrentUser(ctx);
    const leadCutoff = now + MIN_LEAD_MS;

    const days = [];
    for (let d = fromDay; d <= toDay; d++) {
      if (d < today || d > last) continue;
      const { hours, isOverride } = effectiveHours(weekly, overrides, d);
      const states = daySlotStates(d, hours, bookings, viewer?._id ?? null);
      const dayStart = dayStartMs(d);
      const visible = states.map((s, h) => {
        if (s !== "open") return s;
        return dayStart + h * HOUR_MS >= leadCutoff ? "open" : "off";
      });
      days.push({ dayIndex: d, isOverride, hours, states: visible });
    }
    return days;
  },
});

// ───────────── HOST-ONLY ─────────────

/** Host’s own day: slot states + booking details (guest names). */
export const getMyDay = query({
  args: { dayIndex: v.number() },
  handler: async (ctx, { dayIndex }) => {
    const me = await findMyHost(ctx);
    if (!me) return null;

    const weekly = await loadWeekly(ctx, me.host._id);
    const overrides = await loadOverrides(ctx, me.host._id, dayIndex, dayIndex);
    const { hours, isOverride } = effectiveHours(weekly, overrides, dayIndex);

    const fromMs = dayStartMs(dayIndex);
    const toMs = fromMs + 24 * HOUR_MS;
    const bookings = await bookingsTouching(ctx, me.host._id, fromMs, toMs);
    const states = daySlotStates(dayIndex, hours, bookings, me.user._id);

    const bookingDetails = await Promise.all(
      bookings.map(async (b) => {
        const guest = await ctx.db.get(b.guestId);
        return {
          _id: b._id,
          startsAt: b.startsAt,
          endsAt: b.endsAt ?? b.startsAt + b.minutes * 60_000,
          minutes: b.minutes,
          status: b.status,
          guestName: guest?.name ?? "Guest",
          hostShareCents: b.hostShareCents,
        };
      }),
    );

    return {
      dayIndex,
      isOverride,
      hours,
      states,
      bookings: bookingDetails,
    };
  },
});

/** Host: bookings across a day range (for list views). */
export const getMyBookingsAround = query({
  args: {
    fromDay: v.number(),
    toDay: v.number(),
  },
  handler: async (ctx, { fromDay, toDay }) => {
    const me = await findMyHost(ctx);
    if (!me) return [];

    const fromMs = dayStartMs(fromDay);
    const toMs = dayStartMs(toDay + 1);
    const bookings = await bookingsTouching(ctx, me.host._id, fromMs, toMs);

    return Promise.all(
      bookings.map(async (b) => {
        const guest = await ctx.db.get(b.guestId);
        return {
          _id: b._id,
          startsAt: b.startsAt,
          endsAt: b.endsAt ?? b.startsAt + b.minutes * 60_000,
          minutes: b.minutes,
          status: b.status,
          guestName: guest?.name ?? "Guest",
          hostShareCents: b.hostShareCents,
        };
      }),
    );
  },
});

/** Host: current weekly map for settings UI. */
export const getMyWeeklyHours = query({
  args: {},
  handler: async (ctx) => {
    const me = await findMyHost(ctx);
    if (!me) return null;
    const weekly = await loadWeekly(ctx, me.host._id);
    return Array.from({ length: 7 }, (_, wd) => ({
      weekday: wd,
      hours: weekly === null ? null : (weekly.get(wd) ?? []),
    }));
  },
});

/** Host: save weekly hours for one weekday (0–6). */
export const setWeeklyHours = mutation({
  args: {
    weekday: v.number(),
    hours: v.array(v.number()),
  },
  handler: async (ctx, { weekday, hours }) => {
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new Error("weekday must be 0–6");
    }
    const cleaned = cleanHours(hours);
    const { host } = await requireMyHost(ctx);

    const existing = await ctx.db
      .query("hostWeeklyHours")
      .withIndex("by_host_weekday", (q) =>
        q.eq("hostId", host._id).eq("weekday", weekday),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { hours: cleaned });
    } else {
      await ctx.db.insert("hostWeeklyHours", {
        hostId: host._id,
        weekday,
        hours: cleaned,
      });
    }
  },
});

/** Host: set / replace a one-day override. Empty hours = day off. */
export const setDayOverride = mutation({
  args: {
    dayIndex: v.number(),
    hours: v.array(v.number()),
  },
  handler: async (ctx, { dayIndex, hours }) => {
    const cleaned = cleanHours(hours);
    const { host } = await requireMyHost(ctx);
    if (dayIndex < dayIndexOf(Date.now())) {
      throw new Error("Cannot change past days");
    }

    const existing = await ctx.db
      .query("hostDayOverrides")
      .withIndex("by_host_day", (q) =>
        q.eq("hostId", host._id).eq("dayIndex", dayIndex),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { hours: cleaned });
    } else {
      await ctx.db.insert("hostDayOverrides", {
        hostId: host._id,
        dayIndex,
        hours: cleaned,
      });
    }
  },
});

/** Host: remove override → fall back to weekly hours. */
export const clearDayOverride = mutation({
  args: { dayIndex: v.number() },
  handler: async (ctx, { dayIndex }) => {
    const { host } = await requireMyHost(ctx);
    const existing = await ctx.db
      .query("hostDayOverrides")
      .withIndex("by_host_day", (q) =>
        q.eq("hostId", host._id).eq("dayIndex", dayIndex),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
