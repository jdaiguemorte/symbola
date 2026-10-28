// Détection de l'encodage d'un fichier texte (IMP-01) : BOM d'abord, puis
// UTF-8 strict, sinon Windows-1252 (exports Excel « CSV » sous Windows).
// Un contenu binaire (caractère nul, caractères de contrôle en nombre) est
// refusé : Windows-1252 décode n'importe quels octets, il ne doit pas servir
// à faire passer un fichier binaire pour du texte.
import { ReadError, type TextEncoding } from "./types";

export function decodeText(bytes: Uint8Array): { text: string; encoding: TextEncoding } {
  const decoded = decodeWithoutCheck(bytes);
  if (looksBinary(decoded.text)) throw new ReadError("unsupported_format", "binary");
  return decoded;
}

function decodeWithoutCheck(bytes: Uint8Array): { text: string; encoding: TextEncoding } {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: strictDecode("utf-8", bytes.subarray(3)), encoding: "utf-8" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: strictDecode("utf-16le", bytes.subarray(2)), encoding: "utf-16le" };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: strictDecode("utf-16be", bytes.subarray(2)), encoding: "utf-16be" };
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: decodeWindows1252(bytes), encoding: "windows-1252" };
  }
}

// Le TextDecoder de Node traite « windows-1252 » comme Latin-1 : les octets
// 0x80 à 0x9F (€, Œ, guillemets typographiques…) deviendraient des caractères
// de contrôle. Table explicite pour cette plage ; 0x81, 0x8D, 0x8F, 0x90 et
// 0x9D sont non attribués et gardent leur valeur.
const WINDOWS_1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d, 0x017d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x9d, 0x017e, 0x0178,
];

export function decodeWindows1252(bytes: Uint8Array): string {
  let text = "";
  for (let start = 0; start < bytes.length; start += 8192) {
    const chunk = bytes.subarray(start, start + 8192);
    text += String.fromCharCode(...Array.from(chunk, (byte) => (byte >= 0x80 && byte <= 0x9f ? (WINDOWS_1252_HIGH[byte - 0x80] as number) : byte)));
  }
  return text;
}

// Un BOM annonce l'encodage : un contenu qui ne le respecte pas est corrompu.
function strictDecode(encoding: TextEncoding, bytes: Uint8Array): string {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new ReadError("malformed");
  }
}

function looksBinary(text: string): boolean {
  const sample = text.slice(0, 8192);
  let control = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code === 0) return true;
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d && code !== 0x0c) control += 1;
  }
  return sample.length > 0 && control / sample.length > 0.01;
}
