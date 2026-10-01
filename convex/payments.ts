import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

type PaystackInitResponse = {
  status: boolean;
  message?: string;
  data?: { authorization_url: string; reference: string };
};

export const initCheckout = action({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }): Promise<string> => {
    // getForCheckout should verify: caller is the guest, booking is pending_payment,
    // host is approved and has a subaccount code.
    const b = await ctx.runQuery(internal.bookings.getForCheckout, {
      bookingId,
    });

    const reference = `bk_${bookingId}_${Date.now()}`;

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: b.guestEmail,
        amount: b.amountCents,
        currency: "ZAR",
        subaccount: b.hostSubaccountCode,
        transaction_charge: b.platformFeeCents, // what the platform keeps
        bearer: "subaccount", // host pays Paystack's fee; use "account" for the platform to pay
        reference,
        callback_url: `${process.env.SITE_URL}/bookings/${bookingId}`,
      }),
    });

    const data = (await res.json()) as PaystackInitResponse;
    if (!res.ok || !data.status || !data.data) {
      throw new Error(data.message ?? "Paystack initialize failed");
    }

    await ctx.runMutation(internal.payments.record, {
      providerReference: reference,
      bookingId,
      hostId: b.hostId,
      payerId: b.payerId,
      amountCents: b.amountCents,
      platformFeeCents: b.platformFeeCents,
    });

    return data.data.authorization_url;
  },
});

export const record = internalMutation({
  args: {
    providerReference: v.string(),
    bookingId: v.id("bookings"),
    hostId: v.id("hosts"),
    payerId: v.id("users"),
    amountCents: v.number(),
    platformFeeCents: v.number(),
  },
  handler: async (ctx, a) => {
    await ctx.db.insert("payments", {
      providerReference: a.providerReference,
      refId: a.bookingId,
      kind: "booking",
      hostId: a.hostId,
      payerId: a.payerId,
      amountCents: a.amountCents,
      platformFeeCents: a.platformFeeCents,
      hostShareCents: a.amountCents - a.platformFeeCents,
      currency: "ZAR",
      status: "initiated",
    });
  },
});

export const markSucceeded = internalMutation({
  args: {
    reference: v.string(),
    amountCents: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, { reference, amountCents, currency }) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_reference", (q) => q.eq("providerReference", reference))
      .unique();

    if (!payment) return; // unknown reference: acknowledge, don't retry
    if (payment.status !== "initiated") return; // idempotent

    if (payment.amountCents !== amountCents || currency !== "ZAR") {
      await ctx.db.patch(payment._id, { status: "failed" });
      return;
    }

    await ctx.db.patch(payment._id, { status: "succeeded" });

    if (payment.kind === "booking") {
      const bookingId = ctx.db.normalizeId("bookings", payment.refId);
      const booking = bookingId ? await ctx.db.get(bookingId) : null;
      if (!booking || booking.status !== "pending_payment") return; // expired: needs refund

      const roomName = `call_${booking._id}`;
      await ctx.db.patch(booking._id, {
        status: "paid",
        paymentId: payment._id,
        roomName,
      });
      const host = await ctx.db.get(booking.hostId);
      if (!host) return;
      // Reuse the shared callSessions table (LiveKit call page): guest = requester,
      // host's user = recipient, pre-accepted because the booking is paid.
      await ctx.db.insert("callSessions", {
        requesterId: booking.guestId,
        recipientId: host.userId,
        roomName,
        status: "accepted",
        scheduledFor: booking.startsAt,
        createdAt: Date.now(),
        bookingId: booking._id,
      });
    } else {
      const itemId = ctx.db.normalizeId("galleryItems", payment.refId);
      if (itemId) {
        await ctx.db.insert("purchases", {
          galleryItemId: itemId,
          buyerId: payment.payerId,
          paymentId: payment._id,
        });
      }
    }
  },
});
