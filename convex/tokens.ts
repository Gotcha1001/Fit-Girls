// convex/tokens.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";
import { findTokenPackage } from "../lib/tokenPackages";

// ---------------------------------------------------------------------------
// Webhook guard
// ---------------------------------------------------------------------------
// ConvexHttpClient (used by the Next.js ITN route) can only call PUBLIC
// functions, so the webhook mutations below are normal mutations guarded by a
// shared server secret. Set the same value in Convex
//   npx convex env set PAYFAST_WEBHOOK_SECRET <long random string>
// and in the Next.js env. Never expose it to the browser.
function assertWebhookSecret(secret: string): void {
  const expected = process.env.PAYFAST_WEBHOOK_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Forbidden");
  }
}

// ---------------------------------------------------------------------------
// Checkout (signed-in user, called by /api/payfast/checkout)
// ---------------------------------------------------------------------------
export interface CreatedPurchase {
  purchaseId: Id<"tokenPurchases">;
  tokens: number;
  priceCents: number;
  name: string;
  email: string;
}

export const createPurchase = mutation({
  args: { packageId: v.string() },
  handler: async (ctx, { packageId }): Promise<CreatedPurchase> => {
    const user = await requireCurrentUser(ctx);

    // Price comes from the server-side catalog, never from the client.
    const pkg = findTokenPackage(packageId);
    if (!pkg) throw new Error("Unknown token package");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!profile) throw new Error("Finish your profile before buying tokens");

    const purchaseId = await ctx.db.insert("tokenPurchases", {
      userId: user._id,
      packageId: pkg.id,
      tokens: pkg.tokens,
      priceCents: pkg.priceCents,
      status: "pending",
      createdAt: Date.now(),
    });

    return {
      purchaseId,
      tokens: pkg.tokens,
      priceCents: pkg.priceCents,
      name: user.name,
      email: user.email,
    };
  },
});

// ---------------------------------------------------------------------------
// PUBLIC read: the ITN route and the success page poll this.
// Purchase ids are unguessable and we only expose the bare minimum.
// ---------------------------------------------------------------------------
export interface PurchaseForPayment {
  _id: Id<"tokenPurchases">;
  status: "pending" | "paid";
  tokens: number;
  priceCents: number;
}

export const getForPayment = query({
  args: { purchaseId: v.id("tokenPurchases") },
  handler: async (ctx, { purchaseId }): Promise<PurchaseForPayment | null> => {
    const purchase = await ctx.db.get(purchaseId);
    if (!purchase) return null;
    return {
      _id: purchase._id,
      status: purchase.status,
      tokens: purchase.tokens,
      priceCents: purchase.priceCents,
    };
  },
});

// Recent purchases for the settings page.
export const listMyPurchases = query({
  args: {},
  handler: async (ctx): Promise<Doc<"tokenPurchases">[]> => {
    const user = await requireCurrentUser(ctx);
    return await ctx.db
      .query("tokenPurchases")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(10);
  },
});

// ---------------------------------------------------------------------------
// Webhook mutations (only the ITN route calls these)
// ---------------------------------------------------------------------------

// Called only after signature + PayFast server validation + amount check have
// all passed. Marks the purchase paid AND credits the tokens in one atomic
// mutation, so a duplicate ITN can never credit twice.
export const markPaidFromWebhook = mutation({
  args: {
    secret: v.string(),
    purchaseId: v.id("tokenPurchases"),
    payfastPaymentId: v.string(),
  },
  handler: async (ctx, { secret, purchaseId, payfastPaymentId }) => {
    assertWebhookSecret(secret);

    const purchase = await ctx.db.get(purchaseId);
    if (!purchase) throw new Error("Purchase not found");
    if (purchase.status === "paid") return; // PayFast resends ITNs

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", purchase.userId))
      .first();

    // Money arrived but there is nowhere to put the tokens: log for a manual fix.
    if (!profile) {
      await ctx.db.insert("failedPayments", {
        paymentId: payfastPaymentId,
        purchaseId,
        status: "NO_PROFILE",
        amount: purchase.priceCents / 100,
        reason:
          "Payment received but the user has no profile. Credit or refund by hand.",
        timestamp: Date.now(),
        resolved: false,
      });
      return;
    }

    await ctx.db.patch(purchase._id, {
      status: "paid",
      paidAt: Date.now(),
      payfastPaymentId,
    });
    await ctx.db.patch(profile._id, {
      coins: profile.coins + purchase.tokens,
    });
  },
});

export const logFailedPayment = mutation({
  args: {
    secret: v.string(),
    paymentId: v.string(),
    purchaseId: v.optional(v.id("tokenPurchases")),
    status: v.string(),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { secret, ...entry }) => {
    assertWebhookSecret(secret);
    await ctx.db.insert("failedPayments", {
      ...entry,
      timestamp: Date.now(),
      resolved: false,
    });
  },
});
