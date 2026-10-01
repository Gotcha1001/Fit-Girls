// app/api/payfast/notify/route.ts
//
// PayFast ITN (Instant Transaction Notification). Server-to-server, so it has
// NO Clerk session: this path must be public in proxy.ts.
//
// Order of checks is the same as the resort site:
//   1. signature  2. source IP (warn only)  3. PayFast server confirmation
//   4. purchase exists  5. not already paid  6. status COMPLETE
//   7. amount matches  8. credit tokens
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getPayFastCredentials,
  getPayFastHost,
  validateSignature,
} from "@/lib/payfastUtils";

const VALID_IPS: readonly string[] = [
  "197.97.145.144",
  "197.97.145.145",
  "197.97.145.146",
  "197.97.145.147",
  "197.97.145.148",
  "41.74.179.194",
  "41.74.179.195",
  "41.74.179.196",
  "41.74.179.197",
  "41.74.179.198",
];

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const webhookSecret = process.env.PAYFAST_WEBHOOK_SECRET;
    if (!convexUrl || !webhookSecret) {
      console.error(
        "PayFast ITN: NEXT_PUBLIC_CONVEX_URL / PAYFAST_WEBHOOK_SECRET missing",
      );
      return NextResponse.json({ status: "ERROR" }, { status: 500 });
    }
    const convex = new ConvexHttpClient(convexUrl);

    const body = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of body.entries()) params[key] = value as string;

    // 1. Signature
    const credentials = getPayFastCredentials();
    if (!validateSignature(params, credentials.passphrase)) {
      console.error("PayFast ITN: invalid signature");
      return NextResponse.json(
        { status: "INVALID_SIGNATURE" },
        { status: 400 },
      );
    }

    // 2. Source IP (warn only, same as resort: proxies can mangle this header)
    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (
      process.env.NODE_ENV === "production" &&
      !VALID_IPS.includes(clientIP)
    ) {
      console.warn(`PayFast ITN: suspicious IP ${clientIP}`);
    }

    // 3. Ask PayFast to confirm it really sent this
    const confirmResponse = await fetch(
      `https://${getPayFastHost()}/eng/query/validate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
      },
    );
    const confirmText = (await confirmResponse.text()).trim();
    if (confirmText !== "VALID") {
      console.error("PayFast ITN: server confirmation failed", confirmText);
      return NextResponse.json(
        { status: "INVALID_CONFIRMATION" },
        { status: 400 },
      );
    }

    const { payment_status, amount_gross, m_payment_id } = params;
    const purchaseId = m_payment_id as Id<"tokenPurchases">;

    // 4. Purchase exists (a malformed id makes Convex throw, treat as not found)
    let purchase;
    try {
      purchase = await convex.query(api.tokens.getForPayment, { purchaseId });
    } catch {
      purchase = null;
    }
    if (!purchase) {
      console.error("PayFast ITN: purchase not found", m_payment_id);
      return NextResponse.json(
        { status: "INVALID_PAYMENT_ID" },
        { status: 400 },
      );
    }

    // 5. Duplicate ITN: already handled, ack and stop
    if (purchase.status === "paid") {
      return NextResponse.json({ status: "OK" }, { status: 200 });
    }

    // 6. Not a successful payment: log it, ack so PayFast stops retrying
    const receivedAmount = parseFloat(amount_gross);
    if (payment_status !== "COMPLETE") {
      await convex.mutation(api.tokens.logFailedPayment, {
        secret: webhookSecret,
        paymentId: m_payment_id,
        purchaseId,
        status: payment_status,
        amount: Number.isFinite(receivedAmount) ? receivedAmount : 0,
        reason: `Payment status: ${payment_status}`,
      });
      return NextResponse.json({ status: "OK" }, { status: 200 });
    }

    // 7. Amount must match what we asked for
    const expectedAmount = purchase.priceCents / 100;
    if (
      !Number.isFinite(receivedAmount) ||
      Math.abs(expectedAmount - receivedAmount) > 0.01
    ) {
      console.error(
        `PayFast ITN: amount mismatch. Expected ${expectedAmount}, got ${amount_gross}`,
      );
      await convex.mutation(api.tokens.logFailedPayment, {
        secret: webhookSecret,
        paymentId: m_payment_id,
        purchaseId,
        status: "AMOUNT_MISMATCH",
        amount: Number.isFinite(receivedAmount) ? receivedAmount : 0,
        reason: `Expected ${expectedAmount}, got ${amount_gross}`,
      });
      return NextResponse.json({ status: "AMOUNT_MISMATCH" }, { status: 400 });
    }

    // 8. This is the line that credits the tokens
    await convex.mutation(api.tokens.markPaidFromWebhook, {
      secret: webhookSecret,
      purchaseId,
      payfastPaymentId: params.pf_payment_id ?? m_payment_id,
    });

    return NextResponse.json({ status: "OK" }, { status: 200 });
  } catch (error) {
    console.error("PayFast ITN handler error:", error);
    return NextResponse.json({ status: "ERROR" }, { status: 500 });
  }
}
