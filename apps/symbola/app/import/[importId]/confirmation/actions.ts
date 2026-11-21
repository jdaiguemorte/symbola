"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { confirmImport } from "@/lib/import/apply";
import { setEventSheetStatuses } from "@/lib/import/matching";
import { isValidId } from "../../access";

export type ConfirmFormState = { error?: string };

// IMP-05 — confirmation : tout est écrit, ou rien.
export async function confirmImportAction(_prevState: ConfirmFormState, formData: FormData): Promise<ConfirmFormState> {
  const t = await getTranslations("Import");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return { error: t("importNotFound") };
  const defaultProspectSourceId = String(formData.get("defaultProspectSourceId") ?? "") || null;

  let result;
  try {
    result = await confirmImport({
      organizationId: auth.user.organizationId,
      userId: auth.user.id,
      importId,
      defaultProspectSourceId,
      locale: (await getLocale()) === "en" ? "en" : "fr",
    });
  } catch (error) {
    // Rien n'a été écrit (transaction annulée) ; journalisé sans donnée personnelle.
    console.error("confirmation d'import échouée", { organizationId: auth.user.organizationId, importId, error: error instanceof Error ? error.message : "inconnue" });
    return { error: t("confirmFailed") };
  }
  if (result.status === "not_found") return { error: t("importNotFound") };
  if (result.status === "invalid_default_source") return { error: t("defaultSourceRequired") };
  if (result.status === "blocked") return { error: t("confirmBlocked") };
  revalidatePath("/import");
  redirect(`/import/${importId}/journal`);
}

// Lot 14c (décision J) — statut de chaque événement à créer depuis une fiche. Lot 63a (HUB-14,
// recette du 21/11) : enregistré à chaque choix, une ligne à la fois. L'ancien formulaire et son
// bouton « Enregistrer les statuts » étaient remis à zéro par React après l'action : la liste
// réaffichait le statut lu dans le fichier alors que le choix était bien enregistré.
export async function saveSheetStatusAction(importId: string, rowIndex: number, status: string): Promise<boolean> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return false;
  if (!isValidId(importId) || !Number.isInteger(rowIndex) || rowIndex < 0) return false;
  const saved = await setEventSheetStatuses(auth.user.organizationId, importId, [{ rowIndex, status }]);
  if (saved) revalidatePath(`/import/${importId}/confirmation`);
  return saved;
}
