// Lot 74a (HUB-09, PAR-01 ; C-68 ; critères 1 et 2) — tant que l'assistant de démarrage n'est pas fini, la
// titulaire qui ouvre l'accueil y est menée une fois par session de connexion, à la question où elle s'est
// arrêtée ; ensuite, l'accueil le dit d'une ligne. Le témoin garde l'empreinte de la session (jamais le jeton,
// aucune donnée personnelle) : une nouvelle connexion ramène à l'assistant une fois de plus.
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";

export const ONBOARDING_RESUMED_COOKIE = "symbola_assistant_repris";

export function sessionMark(token: string): string {
  return createHash("sha256").update(`assistant:${token}`).digest("hex").slice(0, 32);
}

// Vrai si la titulaire a déjà été menée à l'assistant pendant cette session.
export async function resumedThisSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return Boolean(token) && store.get(ONBOARDING_RESUMED_COOKIE)?.value === sessionMark(token!);
}
