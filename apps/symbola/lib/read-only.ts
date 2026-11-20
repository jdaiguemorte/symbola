// Lot 54 (HUB-27, D2 ; ADR 0101) — à la fin de l'essai sans offre choisie, l'espace est en lecture
// seule : rien n'est effacé, tout se lit et s'exporte. Une écriture (toute requête autre que GET ou
// HEAD : action serveur, envoi de fichier) y est refusée comme « forbidden », sauf là où elle reste
// permise (abonnement, export, fermeture : allowReadOnly). La méthode vient de l'en-tête posé par le
// middleware à chaque requête.
import type { AuthResult } from "@symbola/auth";

export const READ_ONLY_ROLE = "read_only";
export type PlannerAuthOptions = { allowReadOnly?: boolean };
type PlannerResult = AuthResult | { status: "forbidden"; role: string };

export function isWriteMethod(method: string | null | undefined): boolean {
  return Boolean(method) && method !== "GET" && method !== "HEAD";
}

export async function applyReadOnly<T extends PlannerResult>(
  result: T,
  options: PlannerAuthOptions,
  method: string | null,
  isReadOnly: (organizationId: string) => Promise<boolean>,
): Promise<T | { status: "forbidden"; role: typeof READ_ONLY_ROLE }> {
  if (options.allowReadOnly || result.status !== "authenticated" || !result.user.organizationId || !isWriteMethod(method)) return result;
  if (await isReadOnly(result.user.organizationId)) return { status: "forbidden", role: READ_ONLY_ROLE };
  return result;
}
