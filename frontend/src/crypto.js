// Simple E2E crypto helpers using Web Crypto

async function deriveKey(secret) {
  const enc = new TextEncoder();
  const salt = enc.encode("online-clipboard-v1");
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(secret, text) {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );
  const combined = new Uint8Array(iv.byteLength + ciphertextBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBuf), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptText(secret, b64) {
  try {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const iv = bin.slice(0, 12);
    const data = bin.slice(12);
    const key = await deriveKey(secret);
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return null;
  }
}
