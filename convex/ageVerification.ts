import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const myAgeStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .unique();
    return user ? { ageVerified: user.ageVerified } : null;
  },
});

// Date of birth is checked, then discarded. Only the boolean is stored.
export const confirmAdult = mutation({
  args: { dateOfBirth: v.string() }, // "YYYY-MM-DD"
  handler: async (ctx, { dateOfBirth }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User record not found");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth))
      throw new Error("Enter a valid date of birth");
    const dob = new Date(`${dateOfBirth}T00:00:00Z`);
    if (isNaN(dob.getTime())) throw new Error("Enter a valid date of birth");

    const now = new Date();
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    const hadBirthday =
      now.getUTCMonth() > dob.getUTCMonth() ||
      (now.getUTCMonth() === dob.getUTCMonth() &&
        now.getUTCDate() >= dob.getUTCDate());
    if (!hadBirthday) age -= 1;

    if (age < 0 || age > 120) throw new Error("Enter a valid date of birth");
    if (age < 18) throw new Error("You must be 18 or older to book");

    await ctx.db.patch(user._id, { ageVerified: true });
  },
});
