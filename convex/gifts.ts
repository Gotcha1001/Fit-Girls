import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";
import { GIFT_CATALOG, findGiftById, type GiftDefinition } from "../lib/gifts";

function findGift(giftId: string): GiftDefinition {
  const gift = findGiftById(giftId);
  if (!gift) throw new Error(`Unknown gift: ${giftId}`);
  return gift;
}

export const listGiftCatalog = query({
  args: {},
  handler: async (): Promise<GiftDefinition[]> => GIFT_CATALOG,
});

export const sendGift = mutation({
  args: {
    toUserId: v.id("users"),
    giftId: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"giftTransactions">> => {
    const user = await requireCurrentUser(ctx);
    if (user._id === args.toUserId) {
      throw new Error("You can't send a gift to yourself");
    }

    const gift = findGift(args.giftId);

    const myProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!myProfile) throw new Error("Finish your profile before sending gifts");
    if (myProfile.coins < gift.coinCost) {
      throw new Error("Not enough coins for this gift");
    }

    await ctx.db.patch(myProfile._id, {
      coins: myProfile.coins - gift.coinCost,
    });

    return await ctx.db.insert("giftTransactions", {
      fromUserId: user._id,
      toUserId: args.toUserId,
      giftId: gift.id,
      coinCost: gift.coinCost,
      message: args.message,
      createdAt: Date.now(),
    });
  },
});

export const getGiftsReceived = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args): Promise<Doc<"giftTransactions">[]> => {
    const user = await requireCurrentUser(ctx);
    const targetUserId = args.userId ?? user._id;

    return await ctx.db
      .query("giftTransactions")
      .withIndex("by_recipient", (q) => q.eq("toUserId", targetUserId))
      .collect();
  },
});

export const getGiftsSent = query({
  args: {},
  handler: async (ctx): Promise<Doc<"giftTransactions">[]> => {
    const user = await requireCurrentUser(ctx);
    return await ctx.db
      .query("giftTransactions")
      .withIndex("by_sender", (q) => q.eq("fromUserId", user._id))
      .collect();
  },
});
