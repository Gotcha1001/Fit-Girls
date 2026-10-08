import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const PLATFORM_PERCENT = 20; // Paystack's percentage_charge is the platform's cut

type PaystackBank = { name: string; code: string; active?: boolean };
type PaystackBanksResponse = {
  status: boolean;
  message?: string;
  data?: PaystackBank[];
};
type PaystackSubaccountResponse = {
  status: boolean;
  message?: string;
  data?: { subaccount_code: string };
};

// Bank list for the onboarding dropdown. Signed-in users only.
export const listBanks = action({
  args: {},
  handler: async (ctx): Promise<{ name: string; code: string }[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const res = await fetch(
      "https://api.paystack.co/bank?country=south%20africa&perPage=100",
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` } },
    );
    const data = (await res.json()) as PaystackBanksResponse;
    if (!res.ok || !data.status || !data.data) {
      throw new Error(data.message ?? "Could not load banks");
    }
    return data.data
      .filter((b) => b.active !== false)
      .map((b) => ({ name: b.name, code: b.code }));
  },
});

// Creates the host's Paystack subaccount. The full account number is sent to
// Paystack and then discarded: only the subaccount code and last 4 digits are
// stored. Never console.log the arguments of this action.
export const setupPayout = action({
  args: {
    bankCode: v.string(),
    accountNumber: v.string(),
    accountHolder: v.string(),
  },
  handler: async (
    ctx,
    { bankCode, accountNumber, accountHolder },
  ): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const bank = bankCode.trim();
    const account = accountNumber.replace(/\s+/g, "");
    const holder = accountHolder.trim();
    if (!/^[A-Za-z0-9-]{1,20}$/.test(bank)) throw new Error("Invalid bank");
    if (!/^\d{6,16}$/.test(account)) {
      throw new Error("Account number must be 6 to 16 digits");
    }
    if (holder.length < 2 || holder.length > 80) {
      throw new Error("Enter the account holder's name");
    }

    const host = await ctx.runQuery(internal.hosts.getHostForPayout, {
      clerkId: identity.subject,
    });
    if (!host) throw new Error("Save your profile first");
    if (host.hasPayout) {
      throw new Error(
        "Payout account already set up. Contact support to change it.",
      );
    }

    const res = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_name: `Host ${host.hostId}`, // internal label
        description: `Account holder: ${holder}`, // helps you reconcile payouts
        settlement_bank: bank,
        account_number: account,
        percentage_charge: PLATFORM_PERCENT,
      }),
    });

    const data = (await res.json()) as PaystackSubaccountResponse;
    if (!res.ok || !data.status || !data.data?.subaccount_code) {
      throw new Error(data.message ?? "Could not create payout account");
    }

    await ctx.runMutation(internal.hosts.savePayout, {
      hostId: host.hostId,
      payoutAccountRef: data.data.subaccount_code,
      bankLast4: account.slice(-4),
    });
  },
});
