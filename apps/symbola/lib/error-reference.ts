// Lot 39b (NFR-16 ; D9 ; ADR 0074) — référence courte d'une erreur, lisible et dictable au téléphone :
// huit caractères de l'alphabet de Crockford (ni I, ni L, ni O, ni U), « 7KQ2-M9XD ». Une même graine
// (le condensé que Next.js attache à l'erreur) donne la même référence à l'écran et au journal du
// serveur : le support retrouve l'erreur sans que l'écran montre quoi que ce soit de technique.
// Sans dépendance : servi au navigateur comme au serveur.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function errorReference(seed: string): string {
  // 40 bits : 32 d'un premier condensé, 8 d'un second.
  let value = BigInt(fnv1a(seed, 0x811c9dc5)) * 256n + BigInt(fnv1a(seed, 0x5bd1e995) & 0xff);
  let chars = "";
  for (let index = 0; index < 8; index++) {
    chars = ALPHABET[Number(value & 31n)] + chars;
    value >>= 5n;
  }
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function newErrorReference(): string {
  return errorReference(globalThis.crypto.randomUUID());
}

export const ERROR_REFERENCE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
