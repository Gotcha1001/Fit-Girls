import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const PAYSTACK = "https://api.paystack.co";
const PLATFORM_PCT = 20; // your commission; checkout can override with a flat fee

type PaystackBank = { name: string; code: string };
type PaystackBankList = {
  status: boolean;
  message?: string;
  data?: PaystackBank[];
};
type PaystackSubaccount = {
  status: boolean;
  message?: string;
  data?: { subaccount_code: string };
};

function headers() {
  const key = process.env.PAYSTACK_SECRET;
  if (!key) throw new Error("PAYSTACK_SECRET is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

// Banks the host can pick from. Confirm the country parameter in Paystack's
// "List Banks" docs for ZAR when you test in sandbox.
export const listBanks = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const res = await fetch(
      `${PAYSTACK}/bank?country=south%20africa&currency=ZAR&perPage=100`,
      { headers: headers() },
    );
    const data = (await res.json()) as PaystackBankList;
    if (!data.status || !data.data)
      throw new Error("Could not load the bank list");

    const seen = new Set<string>();
    const banks: PaystackBank[] = [];
    for (const b of data.data) {
      if (seen.has(b.code)) continue;
      seen.add(b.code);
      banks.push({ name: b.name, code: b.code });
    }
    return banks.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Registers the host's bank account as a Paystack subaccount.
// The account number passes through here and is NOT saved or logged.
export const setupPayout = action({
  args: {
    bankCode: v.string(),
    accountNumber: v.string(),
    accountHolder: v.string(),
  },
  handler: async (ctx, { bankCode, accountNumber, accountHolder }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const acct = accountNumber.replace(/\s+/g, "");
    if (!/^\d{6,17}$/.test(acct))
      throw new Error("Account number must be 6 to 17 digits");
    const holder = accountHolder.trim();
    if (holder.length < 2) throw new Error("Enter the account holder name");

    const host = await ctx.runQuery(internal.hosts.getHostForPayout, {
      clerkId: identity.subject,
    });
    if (!host) throw new Error("Save your profile first");
    if (host.hasPayout)
      throw new Error(
        "Bank details are already set. Contact support to change them.",
      );

    const res = await fetch(`${PAYSTACK}/subaccount`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        business_name: holder,
        settlement_bank: bankCode,
        account_number: acct,
        percentage_charge: PLATFORM_PCT,
        description: `Host ${host.hostId}`,
      }),
    });
    const data = (await res.json()) as PaystackSubaccount;
    if (!data.status || !data.data) {
      // Paystack's message is safe to show; it does not echo the account number.
      throw new Error(data.message ?? "Could not set up payouts");
    }

    await ctx.runMutation(internal.hosts.savePayout, {
      hostId: host.hostId,
      payoutAccountRef: data.data.subaccount_code,
      bankLast4: acct.slice(-4),
    });

    return { bankLast4: acct.slice(-4) };
  },
});
