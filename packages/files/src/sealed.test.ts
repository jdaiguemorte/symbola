import { describe, expect, it } from "vitest";
import { openSealedFile, sealFile } from "./sealed";

describe("IMP-10 — fichier gardé chiffré le temps d'un traitement (lot 15)", () => {
  const content = new TextEncoder().encode("%PDF-1.4 fiche fictive");

  it("le fichier stocké est illisible sans sa clé, et se relit à l'identique avec elle", () => {
    const sealed = sealFile(content);
    expect(sealed.data.includes(Buffer.from("fiche fictive"))).toBe(false);
    expect(new Uint8Array(openSealedFile(sealed.data, sealed.key))).toEqual(content);
  });

  it("chaque fichier a sa propre clé ; un fichier altéré ou une mauvaise clé sont refusés", () => {
    const first = sealFile(content);
    const second = sealFile(content);
    expect(first.key).not.toBe(second.key);
    expect(() => openSealedFile(first.data, second.key)).toThrow();
    const altered = Buffer.from(first.data);
    altered[20] = altered[20]! ^ 1;
    expect(() => openSealedFile(altered, first.key)).toThrow();
  });
});
