import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

http.route({
  path: "/paystack-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.text();
    const sig = req.headers.get("x-paystack-signature");
    const expected = await hmacSha512Hex(process.env.PAYSTACK_SECRET!, body);
    if (!sig || !safeEqual(sig, expected)) {
      return new Response("bad sig", { status: 401 });
    }

    const event = JSON.parse(body);
    if (event.event === "charge.success") {
      await ctx.runMutation(internal.payments.markSucceeded, {
        reference: event.data.reference,
        amountCents: event.data.amount,
        currency: event.data.currency,
      });
    }
    return new Response("ok", { status: 200 });
  }),
});

export default http;
