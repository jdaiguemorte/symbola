// Lot 49 (INV-02 ; D5, D12) — exécution d'un import d'invités, partagée par l'onglet de la fiche et
// le portail du client. Jamais une action serveur : l'appelant a déjà vérifié la session (équipe) ou
// le lien (client) et donne l'organisation et l'évènement de cet accès, jamais ceux du formulaire.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import type { GuestImportResult } from "@symbola/contracts";
import { importGuests } from "@/modules/guests/service";
import { isValidId } from "../../module-access";
import { guestErrorKey } from "./form-schemas";

export type ImportState = { error?: string; success?: boolean; result?: GuestImportResult };

// Limite des actions serveur de l'app (next.config.ts, 1 Mo) : une liste d'invités en CSV ou XLSX
// en fait quelques dizaines de kilo-octets.
export const IMPORT_MAX_BYTES = 1024 * 1024;

export async function runImport(organizationId: string, eventId: string, formData: FormData, channel: "planner" | "client"): Promise<ImportState> {
  const t = await getTranslations("Guests.errors");
  const file = formData.get("file");
  if (!isValidId(eventId) || !(file instanceof File)) return { error: t("importFile") };
  if (file.size > IMPORT_MAX_BYTES) return { error: t("importTooLarge") };
  const apply = formData.get("intent") === "apply";
  const skipLines = formData.getAll("skip").map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
  try {
    const result = await importGuests({ organizationId, eventId, bytes: new Uint8Array(await file.arrayBuffer()), channel, apply: apply ? { skipLines } : null });
    if (result.status === "applied") revalidatePath(channel === "client" ? "/portail/invites" : `/events/${eventId}`);
    return { result };
  } catch (error) {
    const key = guestErrorKey(error);
    if (!key) throw error;
    return { error: t.has(key) ? t(key) : t("generic") };
  }
}
