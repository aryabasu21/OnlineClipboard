import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    code: v.string(), // 5-char human code
    linkToken: v.string(), // 16-char token
    allowHistory: v.boolean(),
    expiresAt: v.number(), // epoch ms for TTL (client enforced or cron cleanup)
    latest: v.string(), // ciphertext of latest (empty string if none)
    lastVersion: v.number(), // numeric version counter (0 if none)
    currentLang: v.optional(v.string()), // last chosen language/mode (e.g. 'plain','python')
    autoFormat: v.optional(v.boolean()), // whether auto-format on paste is enabled
  })
    .index("by_code", ["code"])
    .index("by_linkToken", ["linkToken"]),
  history: defineTable({
    sessionCode: v.string(),
    version: v.number(),
    ciphertext: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lang: v.optional(v.string()), // language/mode of this version
  }).index("by_session_version", ["sessionCode", "version"]),
});
