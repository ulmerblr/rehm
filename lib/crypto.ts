import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM encryption for user API keys. APP_ENCRYPTION_KEY is 32 random
// bytes provided as base64 (or hex) in the environment. Ciphertext, iv, and
// auth tag are returned/consumed as base64 and stored as bytea via
// decode(...,'base64') / encode(...,'base64') at the SQL boundary. Plaintext
// keys are never logged, never persisted, and never leave a request.

function appKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY is not set");
  let buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    const hex = Buffer.from(raw, "hex");
    if (hex.length === 32) buf = hex;
  }
  if (buf.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes (base64 or hex)");
  }
  return buf;
}

export type Encrypted = { ciphertext: string; iv: string; authTag: string };

export function encrypt(plaintext: string): Encrypted {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", appKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ct.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decrypt(enc: Encrypted): string {
  const decipher = createDecipheriv("aes-256-gcm", appKey(), Buffer.from(enc.iv, "base64"));
  decipher.setAuthTag(Buffer.from(enc.authTag, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}
