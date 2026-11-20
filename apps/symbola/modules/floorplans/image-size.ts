// Lot 60 (D4) — dimensions en pixels d'un fond de plan PNG, JPEG ou WebP, lues dans l'en-tête du
// fichier, sans dépendance. Le type est d'abord vérifié par le contenu (ADR 0027) ; un fichier
// illisible ou d'un autre format renvoie null et le dépôt est refusé.
export type ImageSize = { mime: "image/png" | "image/jpeg" | "image/webp"; widthPx: number; heightPx: number };

const MAX_SIDE_PX = 20000;

function valid(size: ImageSize): ImageSize | null {
  return size.widthPx > 0 && size.heightPx > 0 && size.widthPx <= MAX_SIDE_PX && size.heightPx <= MAX_SIDE_PX ? size : null;
}

function ascii(buffer: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...buffer.subarray(offset, offset + length));
}

export function readImageSize(buffer: Uint8Array): ImageSize | null {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  // PNG : signature, puis le bloc IHDR (largeur et hauteur sur 4 octets).
  if (buffer.length >= 24 && buffer[0] === 0x89 && ascii(buffer, 1, 3) === "PNG" && ascii(buffer, 12, 4) === "IHDR") {
    return valid({ mime: "image/png", widthPx: view.getUint32(16), heightPx: view.getUint32(20) });
  }
  // JPEG : premier marqueur SOFn (hors DHT, JPG et DAC).
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1]!;
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) {
        offset += marker === 0xff ? 1 : 2;
        continue;
      }
      const length = view.getUint16(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return valid({ mime: "image/jpeg", heightPx: view.getUint16(offset + 5), widthPx: view.getUint16(offset + 7) });
      }
      if (length < 2) return null;
      offset += 2 + length;
    }
    return null;
  }
  // WebP : RIFF, puis un bloc VP8 (avec perte), VP8L (sans perte) ou VP8X (étendu).
  if (buffer.length >= 30 && ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 4) === "WEBP") {
    const chunk = ascii(buffer, 12, 4);
    if (chunk === "VP8 ") return valid({ mime: "image/webp", widthPx: view.getUint16(26, true) & 0x3fff, heightPx: view.getUint16(28, true) & 0x3fff });
    if (chunk === "VP8L") {
      const b = buffer.subarray(21, 25);
      return valid({ mime: "image/webp", widthPx: 1 + (b[0]! | ((b[1]! & 0x3f) << 8)), heightPx: 1 + ((b[1]! >> 6) | (b[2]! << 2) | ((b[3]! & 0x0f) << 10)) });
    }
    if (chunk === "VP8X") {
      const width = 1 + (buffer[24]! | (buffer[25]! << 8) | (buffer[26]! << 16));
      const height = 1 + (buffer[27]! | (buffer[28]! << 8) | (buffer[29]! << 16));
      return valid({ mime: "image/webp", widthPx: width, heightPx: height });
    }
  }
  return null;
}
