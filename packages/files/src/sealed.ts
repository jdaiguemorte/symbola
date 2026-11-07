// Lot 15 (IMP-10, ADR 0035) — fichier gardé chiffré le temps d'un traitement
// (fiches PDF en attente de lecture) : AES-256-GCM de la bibliothèque
// standard de Node, clé aléatoire propre à chaque fichier, gardée en base à
// part du fichier et effacée avec lui. Le stockage objet (Garage) ne chiffre
// pas au repos : sans la clé, l'objet stocké est illisible.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type SealedFile = { data: Buffer; key: string };

export function sealFile(content: Uint8Array): SealedFile {
  const key = randomBytes(32);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
  // iv | données chiffrées | étiquette d'authenticité
  return { data: Buffer.concat([iv, encrypted, cipher.getAuthTag()]), key: key.toString("base64") };
}

// Lève une erreur si le fichier ou la clé ont été altérés.
export function openSealedFile(sealed: Uint8Array, key: string): Buffer {
  const buffer = Buffer.from(sealed);
  const iv = buffer.subarray(0, IV_BYTES);
  const tag = buffer.subarray(buffer.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(key, "base64"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buffer.subarray(IV_BYTES, buffer.length - TAG_BYTES)), decipher.final()]);
}
