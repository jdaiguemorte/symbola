// Lot 54 (HUB-27, D2 ; ADR 0101) : méthode de la requête en cours, posée par le middleware (un en-tête
// envoyé par le client est écrasé). Hors d'une requête (traitement de fond, test) : aucune méthode.
import { headers } from "next/headers";

export async function requestMethod(): Promise<string | null> {
  try {
    return (await headers()).get("x-symbola-method");
  } catch {
    return null;
  }
}
