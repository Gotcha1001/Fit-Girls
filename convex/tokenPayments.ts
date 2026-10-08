"use node"; // not needed for fetch, remove if you also export queries/mutations here
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const initialize = action({
  args: { packageId: v.string(), siteUrl: v.string() },
  handler: async (ctx, { packageId, siteUrl }): Promise<{ url: string }> => {
    const purchase = await ctx.runMutation(api.tokens.createPurchase, {
      packageId,
    });
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: purchase.email,
        amount: purchase.priceCents, // Paystack wants the smallest unit (cents for ZAR)
        currency: "ZAR",
        reference: `tk_${purchase.purchaseId}`, // lets the webhook find the purchase directly
        callback_url: `${siteUrl}/tokens/${purchase.purchaseId}/success`,
        metadata: { purchaseId: purchase.purchaseId },
      }),
    });
    const json = await res.json();
    if (!json.status) throw new Error(json.message ?? "Paystack init failed");
    return { url: json.data.authorization_url };
  },
});
