// DAT-08 (socle des lots 46 et 49, ADR 0078) — chiffrement au niveau du champ :
// AES-256-GCM, clé propre, rattaché à l'organisation, la table, la colonne et la ligne.
import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DataKeyError, FieldUnreadableError, isSealedField, openField, readDataEncryptionKey, sealField, type FieldPlace } from "./field-box";

const key = randomBytes(32);
// Valeur quelconque, générée à chaque exécution (aucune donnée écrite dans le dépôt).
const VALUE = `Sans gluten ; arachide ${randomBytes(4).toString("hex")}`;
const place: FieldPlace = { organizationId: randomUUID(), table: "guests.diets", column: "options", rowId: randomUUID() };

describe("DAT-08 — Chiffrement au niveau du champ", () => {
  it("chiffre la valeur : le stockage ne la contient pas et la relit à l'identique, accents compris", () => {
    const sealed = sealField(VALUE, place, key);
    expect(isSealedField(sealed)).toBe(true);
    expect(sealed).not.toContain("gluten");
    expect(openField(sealed, place, key)).toBe(VALUE);
    expect(openField(sealField("", place, key), place, key)).toBe("");
  });

  it("deux chiffrements de la même valeur diffèrent (vecteur d'initialisation aléatoire)", () => {
    expect(sealField(VALUE, place, key)).not.toBe(sealField(VALUE, place, key));
  });

  it("refuse une valeur recopiée dans une autre organisation, une autre ligne, une autre colonne ou une autre table", () => {
    const sealed = sealField(VALUE, place, key);
    for (const other of [
      { ...place, organizationId: randomUUID() },
      { ...place, rowId: randomUUID() },
      { ...place, column: "notes" },
      { ...place, table: "appointments.calendar_sources" },
    ]) {
      expect(() => openField(sealed, other, key)).toThrow(FieldUnreadableError);
    }
  });

  it("refuse une valeur altérée, tronquée, en clair, ou une autre clé, sans répéter la valeur dans l'erreur", () => {
    const sealed = sealField(VALUE, place, key);
    const body = Buffer.from(sealed.slice(3), "base64");
    body[body.length - 1] = (body[body.length - 1] ?? 0) ^ 0xff;
    expect(() => openField(`f1:${body.toString("base64")}`, place, key)).toThrow(FieldUnreadableError);
    expect(() => openField("f1:AAAA", place, key)).toThrow(FieldUnreadableError);
    expect(() => openField(VALUE, place, key)).toThrow(FieldUnreadableError);
    try {
      openField(sealed, place, randomBytes(32));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(FieldUnreadableError);
      expect((error as Error).message).not.toContain("gluten");
    }
  });

  it("refuse une place mal formée plutôt que de chiffrer sans la rattacher", () => {
    expect(() => sealField(VALUE, { ...place, rowId: "1" }, key)).toThrow(/place de champ invalide/);
    expect(() => sealField(VALUE, { ...place, table: "diets" }, key)).toThrow(/place de champ invalide/);
    expect(() => sealField(VALUE, { ...place, column: "Options;" }, key)).toThrow(/place de champ invalide/);
  });

  it("lit la clé de l'environnement : 32 octets en base64, sinon refus", () => {
    const encoded = key.toString("base64");
    expect(readDataEncryptionKey({ DATA_ENCRYPTION_KEY: encoded }).equals(key)).toBe(true);
    expect(() => readDataEncryptionKey({})).toThrow(DataKeyError);
    expect(() => readDataEncryptionKey({ DATA_ENCRYPTION_KEY: randomBytes(16).toString("base64") })).toThrow(DataKeyError);
    expect(() => readDataEncryptionKey({ DATA_ENCRYPTION_KEY: "pas une clé" })).toThrow(DataKeyError);
  });
});
