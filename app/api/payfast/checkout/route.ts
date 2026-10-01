// app/api/payfast/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  generateSignature,
  getPayFastCredentials,
  getPayFastUrl,
} from "@/lib/payfastUtils";
import { centsToPayfastAmount, findTokenPackage } from "@/lib/tokenPackages";

interface CheckoutBody {
  packageId?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Unlike the resort (guests), only signed-in users can buy tokens.
  const { getToken } = await auth();
  const convexToken = await getToken({ template: "convex" });
  if (!convexToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as CheckoutBody | null;
  const pkg = body?.packageId ? findTokenPackage(body.packageId) : undefined;
  if (!pkg) {
    return NextResponse.json(
      { error: "Unknown token package" },
      { status: 400 },
    );
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!convexUrl || !siteUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_CONVEX_URL and NEXT_PUBLIC_SITE_URL must be set" },
      { status: 500 },
    );
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(convexToken);

  let purchase;
  try {
    // Creates the pending row. Price is re-read from the catalog inside Convex.
    purchase = await convex.mutation(api.tokens.createPurchase, {
      packageId: pkg.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create the purchase";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const credentials = getPayFastCredentials();
  const [first, ...rest] = purchase.name.trim().split(/\s+/);

  // The purchase id doubles as m_payment_id, so the ITN handler can look the
  // purchase straight up. Keep item_name/description plain ASCII, no ( ) etc.
  const fields: Record<string, string | number> = {
    merchant_id: credentials.merchantId,
    merchant_key: credentials.merchantKey,
    return_url: `${siteUrl}/tokens/${purchase.purchaseId}/success`,
    cancel_url: `${siteUrl}/tokens/${purchase.purchaseId}/cancel`,
    notify_url: `${siteUrl}/api/payfast/notify`,
    name_first: first || "Member",
    name_last: rest.join(" ") || first || "Member",
    email_address: purchase.email,
    m_payment_id: purchase.purchaseId,
    amount: centsToPayfastAmount(purchase.priceCents),
    item_name: `${purchase.tokens} Spark tokens`,
    item_description: "Token package",
  };

  // Empty values are skipped by the signature, so don't post them either.
  for (const key of Object.keys(fields)) {
    if (fields[key] === "") delete fields[key];
  }

  const signature = generateSignature(fields, credentials.passphrase);

  return NextResponse.json({
    actionUrl: getPayFastUrl(),
    fields: { ...fields, signature },
  });
}
