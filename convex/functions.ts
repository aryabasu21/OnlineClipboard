import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { nanoid } from "nanoid";

// Lightweight row shape hints (not required by Convex runtime)
interface SessionRow {
  _id: string;
  code: string;
  linkToken: string;
  allowHistory: boolean;
  expiresAt: number;
  latest: string;
  lastVersion: number;
  currentLang?: string;
  autoFormat?: boolean;
}
interface HistoryRow {
  _id: string;
  sessionCode: string;
  version: number;
  ciphertext: string;
  createdAt: number;
  updatedAt: number;
  lang?: string;
}

function genCode(): string {
  // 5-char alphanumeric (fallback: slice ensures length)
  return nanoid(5)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 5);
}
function genLinkToken(): string {
  return nanoid(16);
}

// createSession: builds a new session row with defaults
export const createSession = mutation({
  args: {},
  handler: async (ctx: any) => {
    const code = genCode();
    const linkToken = genLinkToken();
    const expiresAt = Date.now() + 24 * 3600 * 1000; // 24h TTL (soft)
    await ctx.db.insert("sessions", {
      code,
      linkToken,
      allowHistory: true,
      expiresAt,
      latest: "",
      lastVersion: 0,
      currentLang: "plain",
      autoFormat: true,
    });
    return { code, linkToken };
  },
});

export const getSession = query({
  args: { code: v.string() },
  handler: async (ctx: any, { code }: { code: string }) => {
    const session: SessionRow | null = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .unique();
    if (!session) return null;
    return {
      code: session.code,
      linkToken: session.linkToken,
      allowHistory: session.allowHistory,
      hasLatest: !!session.latest,
      autoFormat: session.autoFormat ?? true,
      currentLang: session.currentLang || "plain",
    };
  },
});

export const joinByToken = query({
  args: { linkToken: v.string() },
  handler: async (ctx: any, { linkToken }: { linkToken: string }) => {
    const session: SessionRow | null = await ctx.db
      .query("sessions")
      .withIndex("by_linkToken", (q: any) => q.eq("linkToken", linkToken))
      .unique();
    if (!session) return null;
    return {
      code: session.code,
      linkToken: session.linkToken,
      allowHistory: session.allowHistory,
      hasLatest: !!session.latest,
      autoFormat: session.autoFormat ?? true,
      currentLang: session.currentLang || "plain",
    };
  },
});

export const updateClipboard = mutation({
  args: {
    code: v.string(),
    ciphertext: v.string(),
    replaceLatest: v.optional(v.boolean()),
    lang: v.optional(v.string()),
  },
  handler: async (
    ctx: any,
    {
      code,
      ciphertext,
      replaceLatest,
      lang,
    }: {
      code: string;
      ciphertext: string;
      replaceLatest?: boolean;
      lang?: string;
    }
  ) => {
    const session: SessionRow | null = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .unique();
    if (!session) throw new Error("NOT_FOUND");

    const now = Date.now();
    let nextVersion = session.lastVersion + 1;

    if (replaceLatest && session.lastVersion > 0) {
      // Attempt to patch existing latest history row
      const latestHistory: HistoryRow | null = await ctx.db
        .query("history")
        .withIndex("by_session_version", (q: any) =>
          q.eq("sessionCode", code).eq("version", session.lastVersion)
        )
        .unique();
      if (latestHistory) {
        await ctx.db.patch(latestHistory._id, {
          ciphertext,
          updatedAt: now,
          ...(lang ? { lang } : {}),
        });
        await ctx.db.patch(session._id, {
          latest: ciphertext,
          ...(lang ? { currentLang: lang } : {}),
        });
        nextVersion = session.lastVersion; // version unchanged
      } else {
        // Fallback: insert new history row
        await ctx.db.insert("history", {
          sessionCode: code,
          version: nextVersion,
          ciphertext,
          createdAt: now,
          updatedAt: now,
          ...(lang ? { lang } : {}),
        });
        await ctx.db.patch(session._id, {
          latest: ciphertext,
          lastVersion: nextVersion,
          ...(lang ? { currentLang: lang } : {}),
        });
      }
    } else {
      // Always append a new version
      await ctx.db.insert("history", {
        sessionCode: code,
        version: nextVersion,
        ciphertext,
        createdAt: now,
        updatedAt: now,
        ...(lang ? { lang } : {}),
      });
      await ctx.db.patch(session._id, {
        latest: ciphertext,
        lastVersion: nextVersion,
        ...(lang ? { currentLang: lang } : {}),
      });
    }
    return { version: nextVersion };
  },
});

export const getHistory = query({
  args: { code: v.string() },
  handler: async (ctx: any, { code }: { code: string }) => {
    const rows: HistoryRow[] = await ctx.db
      .query("history")
      .withIndex("by_session_version", (q: any) => q.eq("sessionCode", code))
      .collect();
    return rows
      .sort((a, b) => a.version - b.version)
      .map((h) => ({
        version: h.version,
        ciphertext: h.ciphertext,
        createdAt: h.createdAt,
        lang: h.lang,
      }));
  },
});

export const deleteHistory = mutation({
  args: { code: v.string(), version: v.number() },
  handler: async (
    ctx: any,
    { code, version }: { code: string; version: number }
  ) => {
    const row: HistoryRow | null = await ctx.db
      .query("history")
      .withIndex("by_session_version", (q: any) =>
        q.eq("sessionCode", code).eq("version", version)
      )
      .unique();
    if (row) await ctx.db.delete(row._id);

    const session: SessionRow | null = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .unique();
    if (session) {
      const latest: HistoryRow | null = await ctx.db
        .query("history")
        .withIndex("by_session_version", (q: any) => q.eq("sessionCode", code))
        .order("desc")
        .first();
      await ctx.db.patch(session._id, {
        latest: latest ? latest.ciphertext : "",
        lastVersion: latest ? latest.version : 0,
      });
    }
    return { ok: true };
  },
});

export const deleteHistoryBatch = mutation({
  args: { code: v.string(), versions: v.array(v.number()) },
  handler: async (
    ctx: any,
    { code, versions }: { code: string; versions: number[] }
  ) => {
    for (const vnum of versions) {
      const row: HistoryRow | null = await ctx.db
        .query("history")
        .withIndex("by_session_version", (q: any) =>
          q.eq("sessionCode", code).eq("version", vnum)
        )
        .unique();
      if (row) await ctx.db.delete(row._id);
    }
    const session: SessionRow | null = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .unique();
    if (session) {
      const latest: HistoryRow | null = await ctx.db
        .query("history")
        .withIndex("by_session_version", (q: any) => q.eq("sessionCode", code))
        .order("desc")
        .first();
      await ctx.db.patch(session._id, {
        latest: latest ? latest.ciphertext : "",
        lastVersion: latest ? latest.version : 0,
      });
    }
    return { ok: true };
  },
});

export const restoreHistoryItems = mutation({
  args: {
    code: v.string(),
    items: v.array(
      v.object({
        version: v.number(),
        ciphertext: v.string(),
        createdAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (
    ctx: any,
    {
      code,
      items,
    }: {
      code: string;
      items: { version: number; ciphertext: string; createdAt?: number }[];
    }
  ) => {
    for (const item of items) {
      const exists: HistoryRow | null = await ctx.db
        .query("history")
        .withIndex("by_session_version", (q: any) =>
          q.eq("sessionCode", code).eq("version", item.version)
        )
        .unique();
      if (!exists) {
        await ctx.db.insert("history", {
          sessionCode: code,
          version: item.version,
          ciphertext: item.ciphertext,
          createdAt: item.createdAt || Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
    const latest: HistoryRow | null = await ctx.db
      .query("history")
      .withIndex("by_session_version", (q: any) => q.eq("sessionCode", code))
      .order("desc")
      .first();
    const session: SessionRow | null = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .unique();
    if (session) {
      await ctx.db.patch(session._id, {
        latest: latest ? latest.ciphertext : "",
        lastVersion: latest ? latest.version : 0,
      });
    }
    return { ok: true };
  },
});

export const toggleHistory = mutation({
  args: { code: v.string() },
  handler: async (ctx: any, { code }: { code: string }) => {
    const session: SessionRow | null = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .unique();
    if (!session) throw new Error("NOT_FOUND");

    const newAllow = !session.allowHistory;
    await ctx.db.patch(session._id, { allowHistory: newAllow });

    if (!newAllow) {
      // Prune all but latest history entry
      const latest: HistoryRow | null = await ctx.db
        .query("history")
        .withIndex("by_session_version", (q: any) => q.eq("sessionCode", code))
        .order("desc")
        .first();
      const all: HistoryRow[] = await ctx.db
        .query("history")
        .withIndex("by_session_version", (q: any) => q.eq("sessionCode", code))
        .collect();
      for (const row of all) {
        if (!latest || row._id !== latest._id) await ctx.db.delete(row._id);
      }
      if (latest)
        await ctx.db.patch(session._id, { lastVersion: latest.version });
    }
    return { allowHistory: newAllow };
  },
});

export const updateSessionPrefs = mutation({
  args: {
    code: v.string(),
    autoFormat: v.optional(v.boolean()),
    lang: v.optional(v.string()),
  },
  handler: async (
    ctx: any,
    {
      code,
      autoFormat,
      lang,
    }: { code: string; autoFormat?: boolean; lang?: string }
  ) => {
    const session: SessionRow | null = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .unique();
    if (!session) throw new Error("NOT_FOUND");
    const patch: any = {};
    if (autoFormat !== undefined) patch.autoFormat = autoFormat;
    if (lang) patch.currentLang = lang;
    if (Object.keys(patch).length) await ctx.db.patch(session._id, patch);
    return { ok: true };
  },
});

export const latestCiphertext = query({
  args: { code: v.string() },
  handler: async (ctx: any, { code }: { code: string }) => {
    const session: SessionRow | null = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .unique();
    if (!session) return null;
    if (!session.lastVersion) return { version: 0, ciphertext: "" };
    return { version: session.lastVersion, ciphertext: session.latest };
  },
});
