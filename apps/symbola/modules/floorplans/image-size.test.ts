// Lot 60 (D4, ADR 0027) — un fond de plan n'est accepté qu'en PNG, JPEG ou WebP, reconnu par son contenu.
import { describe, expect, it } from "vitest";
import { readImageSize } from "./image-size";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function jpeg(width: number, height: number): Uint8Array {
  // SOI, APP0 de 16 octets, puis SOF0.
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof]);
}

function webpVp8x(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([...("RIFF".split("").map((c) => c.charCodeAt(0))), 0, 0, 0, 0, ..."WEBPVP8X".split("").map((c) => c.charCodeAt(0))]);
  const w = width - 1;
  const h = height - 1;
  bytes.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 24);
  return bytes;
}

describe("L60-PLA-01 — Fond de plan : image PNG, JPEG ou WebP seulement (D4)", () => {
  it("lit la taille d'un PNG, d'un JPEG et d'un WebP", () => {
    expect(readImageSize(png(1200, 800))).toEqual({ mime: "image/png", widthPx: 1200, heightPx: 800 });
    expect(readImageSize(jpeg(640, 480))).toEqual({ mime: "image/jpeg", widthPx: 640, heightPx: 480 });
    expect(readImageSize(webpVp8x(3000, 2000))).toEqual({ mime: "image/webp", widthPx: 3000, heightPx: 2000 });
  });

  it("refuse un PDF, un GIF, un fichier tronqué ou une image démesurée", () => {
    expect(readImageSize(new TextEncoder().encode("%PDF-1.7 plan du lieu"))).toBeNull();
    expect(readImageSize(new TextEncoder().encode("GIF89a\x10\x00\x10\x00"))).toBeNull();
    expect(readImageSize(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    expect(readImageSize(png(0, 800))).toBeNull();
    expect(readImageSize(png(50000, 800))).toBeNull();
  });
});
