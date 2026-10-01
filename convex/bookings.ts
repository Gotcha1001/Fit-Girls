import { internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { split } from "../lib/fees";
import { query } from "./_generated/server";

export const createBooking = mutation({
  args: { hostId: v.id("hosts"), startsAt: v.number(), minutes: v.number() },
  handler: async (ctx, { hostId, startsAt, minutes }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");
    const guest = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!guest?.ageVerified) throw new Error("Age verification required");

    const host = await ctx.db.get(hostId);
    if (!host || host.status !== "approved" || host.kycStatus !== "verified")
      throw new Error("Host unavailable");
    if (minutes < host.minMinutes) throw new Error("Below minimum duration");

    // Reject overlapping bookings
    const clash = await ctx.db
      .query("bookings")
      .withIndex("by_host", (q) => q.eq("hostId", hostId))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "cancelled"),
          q.lt(q.field("startsAt"), startsAt + minutes * 60000),
          q.gt(q.field("startsAt"), startsAt - 3 * 3600000),
        ),
      )
      .collect();
    if (clash.some((b) => b.startsAt + b.minutes * 60000 > startsAt))
      throw new Error("Time slot taken");

    const amountCents = host.ratePerMinuteCents * minutes;
    const fees = split(amountCents);
    const bookingId = await ctx.db.insert("bookings", {
      hostId,
      guestId: guest._id,
      startsAt,
      minutes,
      amountCents,
      ...fees,
      status: "pending_payment",
    });
    return bookingId;
  },
});

export const getForCheckout = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "pending_payment")
      throw new Error("Booking is not awaiting payment");

    const host = await ctx.db.get(booking.hostId);
    if (!host) throw new Error("Host not found");
    if (!host.payoutAccountRef) throw new Error("Host has no payout account");

    const guest = await ctx.db.get(booking.guestId);
    if (!guest) throw new Error("Guest not found");

    return {
      hostId: host._id,
      payerId: guest._id,
      guestEmail: guest.email,
      hostSubaccountCode: host.payoutAccountRef,
      amountCents: booking.amountCents,
      platformFeeCents: booking.platformFeeCents,
    };
  },
});

export const getMine = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const booking = await ctx.db.get(bookingId);
    if (!booking) return null;
    const guest = await ctx.db.get(booking.guestId);
    const host = await ctx.db.get(booking.hostId);
    if (!guest || !host) return null;
    const hostUser = await ctx.db.get(host.userId);

    // only the guest or the host may view
    const isGuest = guest.clerkId === identity.subject;
    const isHost = hostUser?.clerkId === identity.subject;
    if (!isGuest && !isHost) return null;

    return {
      ...booking,
      hostName: host.displayName,
      isGuest,
      isHost,
    };
  },
});
