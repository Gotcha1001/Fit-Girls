import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { TOKEN_PACKAGES } from "@/lib/tokenPackages";

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: { authorization_url: string; reference: string };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { packageId } = (await req.json()) as { packageId?: string };
  const pkg = TOKEN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg)
    return NextResponse.json({ error: "Invalid package" }, { status: 400 });

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email)
    return NextResponse.json({ error: "No email on account" }, { status: 400 });

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret)
    return NextResponse.json(
      { error: "Paystack not configured" },
      { status: 500 },
    );

  const reference = `tok_${randomUUID()}`;

  // TODO: create the "pending" purchase record here, keyed by `reference`,
  // exactly as the old PayFast route did (this feeds "Purchase history").

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: pkg.priceCents, // already in cents
      currency: "ZAR",
      reference,
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/tokens`,
      metadata: { clerkUserId: userId, packageId: pkg.id, tokens: pkg.tokens },
    }),
  });

  const json = (await res.json()) as PaystackInitResponse;
  if (!json.status || !json.data) {
    return NextResponse.json({ error: json.message }, { status: 502 });
  }
  return NextResponse.json({ url: json.data.authorization_url });
}
