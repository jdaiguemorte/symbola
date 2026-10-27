// Comparaison en temps constant d'un secret partagé (ADR 0021) : la durée
// ne dépend pas du nombre de caractères corrects.
import { createHash, timingSafeEqual } from "node:crypto";

export function secretsMatch(received: string, expected: string): boolean {
  // Empreintes de même longueur : timingSafeEqual exige deux tampons égaux
  // en taille, sans révéler la longueur du secret attendu.
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) && expected.length > 0;
}
