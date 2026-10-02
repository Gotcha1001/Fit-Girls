import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { normalizeAppearance } from "@/lib/appearance";

export const createOrGet = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized – no identity found");
    }

    const clerkId = identity.subject;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();
    if (existing) return existing;

    const email = typeof identity.email === "string" ? identity.email : "";
    const name =
      typeof identity.name === "string"
        ? identity.name
        : typeof identity.givenName === "string"
          ? identity.givenName
          : "Unknown User";
    const imageUrl =
      typeof identity.pictureUrl === "string"
        ? identity.pictureUrl
        : typeof identity.picture === "string"
          ? identity.picture
          : undefined;

    // First account ever created becomes admin. Check + insert happen in the
    // same mutation, and Convex serializes conflicting writes, so two
    // simultaneous sign-ups cannot both win.
    const existingAdmin = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();

    const userId = await ctx.db.insert("users", {
      clerkId,
      email,
      name,
      imageUrl,
      role: existingAdmin ? ("user" as const) : ("admin" as const),
      createdAt: Date.now(),
    });

    return await ctx.db.get(userId);
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return (
      (await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first()) ?? null
    );
  },
});

export const setAppearance = mutation({
  args: {
    appearance: v.object({
      accent: v.string(),
      rainMode: v.string(),
      rainDensity: v.number(),
      rainSpeed: v.number(),
      rainOpacity: v.number(),
      glow: v.boolean(),
    }),
  },
  handler: async (ctx, { appearance }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!existing) throw new Error("User not found");

    await ctx.db.patch(existing._id, {
      appearance: normalizeAppearance(appearance),
    });
  },
});
