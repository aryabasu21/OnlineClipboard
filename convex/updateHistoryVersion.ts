import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const updateHistoryVersion = mutation({
  args: {
    code: v.string(),
    version: v.number(),
    ciphertext: v.string(),
    lang: v.optional(v.string()),
  },
  handler: async (ctx, { code, version, ciphertext, lang }) => {
    const row = await ctx.db
      .query("history")
      .withIndex("by_session_version", (q) =>
        q.eq("sessionCode", code).eq("version", version)
      )
      .unique();
    if (!row) {
      return { ok: false, missing: true } as const;
    }
    await ctx.db.patch(row._id, {
      ciphertext,
      updatedAt: Date.now(),
      ...(lang ? { lang } : {}),
    });
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (session && session.lastVersion === version) {
      await ctx.db.patch(session._id, {
        latest: ciphertext,
        ...(lang ? { currentLang: lang } : {}),
      });
    }
    return { ok: true } as const;
  },
});
