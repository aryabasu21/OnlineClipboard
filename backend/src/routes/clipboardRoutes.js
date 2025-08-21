import { Router } from "express";
import {
  createSession,
  getSession,
  updateClipboard,
  getHistory,
  deleteHistoryItem,
  toggleHistory,
  restoreHistoryItems,
} from "../controllers/clipboardController.js";
import ClipboardSession from "../models/ClipboardSession.js";
import { authOptional } from "../middleware/auth.js";

const router = Router();

router.post("/session", createSession); // create new session
router.get("/session/:code", authOptional, getSession); // get session meta (no clipboard content)
router.post("/session/:code/update", authOptional, updateClipboard); // update clipboard ciphertext
router.get("/session/:code/history", authOptional, getHistory);
router.delete(
  "/session/:code/history/:version",
  authOptional,
  deleteHistoryItem
);
router.post("/session/:code/history/toggle", authOptional, toggleHistory);
router.post("/session/:code/history/restore", authOptional, restoreHistoryItems);
router.get("/session/:code/latest", authOptional, async (req, res) => {
  try {
    const session = await ClipboardSession.findOne({ code: req.params.code });
    if (!session || !session.latest)
      return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({
      version: session.latest.version,
      ciphertext: session.latest.ciphertext,
    });
  } catch {
    return res.status(500).json({ error: "FAILED_LATEST" });
  }
});

// Join by link token (does not reveal history / latest ciphertext directly)
router.get("/join/:linkToken", authOptional, async (req, res) => {
  try {
    const session = await ClipboardSession.findOne({
      linkToken: req.params.linkToken,
    });
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({
      code: session.code,
      linkToken: session.linkToken,
      allowHistory: session.allowHistory,
      hasLatest: !!session.latest,
    });
  } catch {
    return res.status(500).json({ error: "FAILED_JOIN" });
  }
});

export default router;
