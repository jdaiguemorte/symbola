// Lot 54 (DOC-06 ; ADR 0101) — un dépôt refusé parce que le quota de stockage de l'offre est plein et
// que son préavis de sept jours est passé. La lecture et l'export restent possibles ; le message dit
// quoi faire (libérer de la place, ou ajouter du stockage dans « Mon abonnement »). Un tiers (lien
// personnel) lit seulement que le dépôt n'est pas possible pour le moment.
import { getTranslations } from "next-intl/server";

export function isStorageFullError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ((error as { name?: unknown }).name === "QuoteFileStorageFullError") return true;
  return (error as { reason?: unknown }).reason === "storage_full";
}

export async function storageFullMessage(audience: "team" | "link" = "team"): Promise<string> {
  const t = await getTranslations("StorageQuota");
  return t(audience === "team" ? "uploadRefused" : "uploadRefusedLink");
}
