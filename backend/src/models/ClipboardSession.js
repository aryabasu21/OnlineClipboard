import mongoose from "mongoose";

const clipboardItemSchema = new mongoose.Schema({
  ciphertext: { type: String, required: true },
  version: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const sessionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // 5-char alphanumeric or nanoid
  linkToken: { type: String, required: true, unique: true },
  history: [clipboardItemSchema],
  latest: clipboardItemSchema,
  expiresAt: { type: Date, required: true },
  allowHistory: { type: Boolean, default: true },
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("ClipboardSession", sessionSchema);
