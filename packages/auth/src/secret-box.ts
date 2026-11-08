// SEC-01 (lot 16, ADR 0037) — secret de double authentification chiffré au
// repos. AES-256-GCM de la bibliothèque standard de Node (même choix que les
// fiches PDF du lot 15, ADR 0035), clé d'environnement MFA_ENCRYPTION_KEY.
// Le chiffré est rattaché au compte (données associées) : recopié sur un autre
// compte, il ne se déchiffre pas. Format stocké : « v1: » + base64(iv | chiffré
// | étiquette). Un secret enregistré en clair avant le lot 16 (base32, jamais
// préfixé) se relit tel quel, le temps qu'il soit chiffré.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export class MfaKeyError extends Error {
  constructor() {
    super("MFA_ENCRYPTION_KEY absente ou invalide : 32 octets encodés en base64 (openssl rand -base64 32)");
    this.name = "MfaKeyError";
  }
}

export function readMfaEncryptionKey(env: Record<string, string | undefined> = process.env): Buffer {
  const value = env.MFA_ENCRYPTION_KEY?.trim() ?? "";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new MfaKeyError();
  const key = Buffer.from(value, "base64");
  if (key.length !== KEY_BYTES) throw new MfaKeyError();
  return key;
}

function associatedData(userId: string): Buffer {
  return Buffer.from(`symbola:totp:${userId}`, "utf8");
}

export function isSealedTotpSecret(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export function sealTotpSecret(secret: string, userId: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(associatedData(userId));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64");
}

// Lève une erreur si la valeur a été altérée, recopiée d'un autre compte ou
// chiffrée avec une autre clé.
export function openTotpSecret(stored: string, userId: string, key: Buffer): string {
  if (!isSealedTotpSecret(stored)) return stored;
  const buffer = Buffer.from(stored.slice(PREFIX.length), "base64");
  if (buffer.length <= IV_BYTES + TAG_BYTES) throw new Error("secret de double authentification illisible");
  const iv = buffer.subarray(0, IV_BYTES);
  const tag = buffer.subarray(buffer.length - TAG_BYTES);
  // Longueur d'étiquette imposée : refuse une étiquette tronquée (Semgrep, lot 15).
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(associatedData(userId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buffer.subarray(IV_BYTES, buffer.length - TAG_BYTES)), decipher.final()]).toString("utf8");
}
