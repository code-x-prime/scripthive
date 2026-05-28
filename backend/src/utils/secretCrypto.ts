import crypto from "node:crypto";
import { env } from "../config/env.js";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";

function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(env.JWT_SECRET).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted secret format");
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivB64!, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64!, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64!, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const plain = isEncryptedSecret(value) ? decryptSecret(value) : value;
    if (plain.length <= 4) return "••••";
    return `••••••••${plain.slice(-4)}`;
  } catch {
    return "••••••••";
  }
}
