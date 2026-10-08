import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

async function hmacSha512Hex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

http.route({
  path: "/paystack-webhook", // CHANGED: the URL already saved in Paystack
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text(); // raw body, must not be re-serialised
    const signature = request.headers.get("x-paystack-signature");
    const expected = await hmacSha512Hex(
      process.env.PAYSTACK_SECRET!, // CHANGED: same name as the other files
      body,
    );
    if (!signature || signature !== expected)
      return new Response("Invalid signature", { status: 401 });

    const event = JSON.parse(body);
    if (event.event !== "charge.success")
      return new Response("ok", { status: 200 });

    const data = event.data;
    const reference = String(data.reference);

    // NEW: token purchases are tagged "tk_<purchaseId>"
    if (reference.startsWith("tk_")) {
      const purchaseId = reference.slice(3) as Id<"tokenPurchases">;
      const purchase = await ctx.runQuery(
        internal.tokens.getForPaymentInternal,
        { purchaseId },
      );

      if (!purchase) {
        await ctx.runMutation(internal.tokens.logFailedPayment, {
          paymentId: reference,
          status: "NOT_FOUND",
          amount: data.amount / 100,
          reason: "Purchase not found",
        });
        return new Response("ok", { status: 200 });
      }
      if (data.amount !== purchase.priceCents || data.currency !== "ZAR") {
        await ctx.runMutation(internal.tokens.logFailedPayment, {
          paymentId: reference,
          purchaseId,
          status: "AMOUNT_MISMATCH",
          amount: data.amount / 100,
          reason: `Expected ${purchase.priceCents}, got ${data.amount} ${data.currency}`,
        });
        return new Response("ok", { status: 200 });
      }
      await ctx.runMutation(internal.tokens.markPaidFromWebhook, {
        purchaseId,
        paystackReference: reference,
      });
      return new Response("ok", { status: 200 });
    }

    // NEW: everything else (bookings, gallery) goes to the existing handler
    await ctx.runMutation(internal.payments.markSucceeded, {
      reference,
      amountCents: data.amount,
      currency: data.currency,
    });
    return new Response("ok", { status: 200 });
  }),
});

export default http;
