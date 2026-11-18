// DAT-08 (socle des lots 46 et 49, ADR 0078) — chiffrement au niveau du champ pour
// les données sensibles : adresse secrète d'un agenda extérieur (lot 46), régimes
// et allergies des invités (lot 49), plus tard l'IBAN (lot 48). Même construction
// que les secrets de double authentification (secret-box.ts, ADR 0037) :
// AES-256-GCM de la bibliothèque standard de Node, mais avec sa propre clé,
// DATA_ENCRYPTION_KEY. Le chiffré est rattaché à sa place (organisation, table,
// colonne, ligne) par les données associées : recopié ailleurs, il ne se
// déchiffre pas. Format stocké : « f1: » + base64(iv | chiffré | étiquette).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "f1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME = /^[a-z][a-z0-9_]*$/;

// Place d'une valeur chiffrée : l'organisation, la table (avec son schéma), la
// colonne et l'identifiant de la ligne. Aucune donnée personnelle.
export type FieldPlace = {
  organizationId: string;
  table: string;
  column: string;
  rowId: string;
};

export class DataKeyError extends Error {
  constructor() {
    super("DATA_ENCRYPTION_KEY absente ou invalide : 32 octets encodés en base64 (openssl rand -base64 32)");
    this.name = "DataKeyError";
  }
}

// Valeur illisible : altérée, recopiée ailleurs ou chiffrée avec une autre clé.
// Le message ne reprend jamais la valeur.
export class FieldUnreadableError extends Error {
  constructor() {
    super("valeur chiffrée illisible");
    this.name = "FieldUnreadableError";
  }
}

export function readDataEncryptionKey(env: Record<string, string | undefined> = process.env): Buffer {
  const value = env.DATA_ENCRYPTION_KEY?.trim() ?? "";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new DataKeyError();
  const key = Buffer.from(value, "base64");
  if (key.length !== KEY_BYTES) throw new DataKeyError();
  return key;
}

function associatedData(place: FieldPlace): Buffer {
  if (!UUID.test(place.organizationId) || !UUID.test(place.rowId) || !/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(place.table) || !NAME.test(place.column)) {
    throw new Error("place de champ invalide : organisation et ligne en UUID, table « schéma.table », colonne en minuscules");
  }
  return Buffer.from(`symbola:field:${place.organizationId}:${place.table}.${place.column}:${place.rowId}`, "utf8");
}

export function isSealedField(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export function sealField(value: string, place: FieldPlace, key: Buffer = readDataEncryptionKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(associatedData(place));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64");
}

// Contrairement aux secrets du lot 16, aucune valeur en clair n'existe avant ce
// socle : une valeur non préfixée est refusée, jamais relue telle quelle.
export function openField(stored: string, place: FieldPlace, key: Buffer = readDataEncryptionKey()): string {
  const aad = associatedData(place);
  if (!isSealedField(stored)) throw new FieldUnreadableError();
  const buffer = Buffer.from(stored.slice(PREFIX.length), "base64");
  if (buffer.length < IV_BYTES + TAG_BYTES) throw new FieldUnreadableError();
  const iv = buffer.subarray(0, IV_BYTES);
  const tag = buffer.subarray(buffer.length - TAG_BYTES);
  try {
    // Longueur d'étiquette imposée : refuse une étiquette tronquée (Semgrep, lot 15).
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(buffer.subarray(IV_BYTES, buffer.length - TAG_BYTES)), decipher.final()]).toString("utf8");
  } catch {
    throw new FieldUnreadableError();
  }
}
