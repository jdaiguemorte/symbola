"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
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
    result = await confirmImport({ organizationId: auth.user.organizationId, userId: auth.user.id, importId, defaultProspectSourceId });
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

// Lot 14c (décision J) — statut de chaque événement à créer depuis une fiche.
export async function saveSheetStatusesAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return;
  const statuses = formData
    .getAll("rowIndex")
    .map((value) => Number(value))
    .filter((rowIndex) => Number.isInteger(rowIndex) && rowIndex >= 0)
    .slice(0, 500)
    .map((rowIndex) => ({ rowIndex, status: String(formData.get(`status-${rowIndex}`) ?? "") }));
  if (statuses.length > 0) await setEventSheetStatuses(auth.user.organizationId, importId, statuses);
  revalidatePath(`/import/${importId}/confirmation`);
}
