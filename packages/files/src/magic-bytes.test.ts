import { describe, expect, it } from "vitest";
import { detectFileType } from "./magic-bytes";

describe("SOC-08 — Détection du type de fichier par le contenu", () => {
  it("reconnaît un PDF à sa signature %PDF", () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(detectFileType(bytes)).toEqual({ mime: "application/pdf", extension: "pdf" });
  });

  it("reconnaît un PNG à sa signature", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectFileType(bytes)).toEqual({ mime: "image/png", extension: "png" });
  });

  it("reconnaît un JPEG à sa signature", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(detectFileType(bytes)).toEqual({ mime: "image/jpeg", extension: "jpg" });
  });

  it("refuse un contenu texte renommé .pdf (type ignoré, seul le contenu compte)", () => {
    const bytes = new TextEncoder().encode("ceci n'est pas vraiment un PDF");
    expect(detectFileType(bytes)).toBeNull();
  });

  it("refuse un contenu vide", () => {
    expect(detectFileType(new Uint8Array())).toBeNull();
  });

  it("ne confond pas un GIF avec un WEBP (tous deux commencent différemment)", () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(detectFileType(gif)?.mime).toBe("image/gif");
  });
});
