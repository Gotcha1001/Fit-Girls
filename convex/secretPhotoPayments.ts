// convex/secretPhotoPayments.ts
//
// Starts the Paystack checkout for a photo order. Same shape as
// payments.initCheckout for bookings: the host's subaccount is paid, and the
// platform keeps `transaction_charge` (its 20%).
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

type PaystackInitResponse = {
  status: boolean;
  message?: string;
  data?: { authorization_url: string; reference: string };
};

export const initCheckout = action({
  args: { orderId: v.id("secretPhotoOrders") },
  handler: async (ctx, { orderId }): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const o = await ctx.runQuery(internal.secretPhotos.getForCheckout, {
      orderId,
      clerkId: identity.subject,
    });

    const reference = `ph_${orderId}_${Date.now()}`;
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: o.buyerEmail,
        amount: o.amountCents,
        currency: "ZAR",
        subaccount: o.hostSubaccountCode,
        transaction_charge: o.platformFeeCents, // what the platform keeps (20%)
        bearer: "subaccount", // same as bookings: the host bears Paystack's fee
        reference,
        callback_url: `${process.env.SITE_URL}/photos?order=${orderId}`,
      }),
    });
    const data = (await res.json()) as PaystackInitResponse;
    if (!res.ok || !data.status || !data.data) {
      throw new Error(data.message ?? "Paystack initialize failed");
    }

    await ctx.runMutation(internal.secretPhotos.recordPayment, {
      providerReference: reference,
      orderId,
      hostId: o.hostId,
      payerId: o.payerId,
      amountCents: o.amountCents,
      platformFeeCents: o.platformFeeCents,
    });
    return data.data.authorization_url;
  },
});
