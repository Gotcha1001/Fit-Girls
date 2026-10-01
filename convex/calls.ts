import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";

// "Book" a call: either right now (scheduledFor omitted) or at a future time
// the requester picked on the booking page.
export const requestCall = mutation({
  args: {
    recipientId: v.id("users"),
    scheduledFor: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"callSessions">> => {
    const user = await requireCurrentUser(ctx);
    if (user._id === args.recipientId) {
      throw new Error("You can't book a call with yourself");
    }

    const roomName = `call-${user._id}-${args.recipientId}-${Date.now()}`;

    return await ctx.db.insert("callSessions", {
      requesterId: user._id,
      recipientId: args.recipientId,
      roomName,
      status: "pending",
      scheduledFor: args.scheduledFor,
      createdAt: Date.now(),
    });
  },
});

export const respondToCall = mutation({
  args: {
    callSessionId: v.id("callSessions"),
    accept: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireCurrentUser(ctx);
    const session = await ctx.db.get(args.callSessionId);
    if (!session) throw new Error("Call session not found");
    if (session.recipientId !== user._id) {
      throw new Error("Only the recipient can respond to this call request");
    }

    await ctx.db.patch(args.callSessionId, {
      status: args.accept ? "accepted" : "declined",
    });
  },
});

export const endCall = mutation({
  args: { callSessionId: v.id("callSessions") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireCurrentUser(ctx);
    const session = await ctx.db.get(args.callSessionId);
    if (!session) throw new Error("Call session not found");
    if (session.requesterId !== user._id && session.recipientId !== user._id) {
      throw new Error("You're not part of this call");
    }
    await ctx.db.patch(args.callSessionId, { status: "ended" });
  },
});

export const getCallSession = query({
  args: { callSessionId: v.id("callSessions") },
  handler: async (ctx, args): Promise<Doc<"callSessions"> | null> => {
    const user = await requireCurrentUser(ctx);
    const session = await ctx.db.get(args.callSessionId);
    if (!session) return null;
    if (session.requesterId !== user._id && session.recipientId !== user._id) {
      throw new Error("You're not part of this call");
    }
    return session;
  },
});

// Pending/upcoming calls in either direction, newest first — used for a
// "call requests" / booking inbox on the dashboard.
export const listMyCallSessions = query({
  args: {},
  handler: async (ctx): Promise<Doc<"callSessions">[]> => {
    const user = await requireCurrentUser(ctx);

    const asRequester = await ctx.db
      .query("callSessions")
      .withIndex("by_requester", (q) => q.eq("requesterId", user._id))
      .collect();
    const asRecipient = await ctx.db
      .query("callSessions")
      .withIndex("by_recipient", (q) => q.eq("recipientId", user._id))
      .collect();

    const combined = [...asRequester, ...asRecipient];
    combined.sort((a, b) => b.createdAt - a.createdAt);
    return combined;
  },
});
