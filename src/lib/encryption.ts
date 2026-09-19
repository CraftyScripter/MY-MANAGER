import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string");
  }
  return Buffer.from(keyHex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decrypt(encryptedData: string): string {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = encryptedData.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Invalid encrypted data format");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3;
}
