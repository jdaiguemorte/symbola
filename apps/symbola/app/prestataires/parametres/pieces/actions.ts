"use server";

// Lot 48a (PRE-05 ; D3, ADR 0093) — réglages des pièces : délai d'alerte avant la fin de validité,
// natures de pièces de l'organisation. Session, organisation et module vérifiés.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { addVendorDocumentKind, archiveVendorDocumentKind, setVendorDocumentAlertDays, setVendorDocumentKindUsage, VendorDocumentNotFoundError } from "@/modules/vendors/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "../../module-access";

export type DocumentSettingsState = { error?: string; success?: boolean; at?: number };

async function authorize(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  return (await isVendorsModuleEnabled(auth.user.organizationId)) ? auth.user.organizationId : null;
}

export async function saveDocumentAlertDaysAction(_previous: DocumentSettingsState, formData: FormData): Promise<DocumentSettingsState> {
  const t = await getTranslations("VendorDocumentSettings");
  const organizationId = await authorize();
  if (!organizationId) return { error: t("unauthorized") };
  try {
    await setVendorDocumentAlertDays(organizationId, Number(String(formData.get("days") ?? "")));
  } catch (error) {
    if (error instanceof RangeError) return { error: t("daysInvalid") };
    throw error;
  }
  revalidatePath("/prestataires/parametres/pieces");
  return { success: true };
}

export async function addDocumentKindAction(_previous: DocumentSettingsState, formData: FormData): Promise<DocumentSettingsState> {
  const t = await getTranslations("VendorDocumentSettings");
  const organizationId = await authorize();
  if (!organizationId) return { error: t("unauthorized") };
  try {
    await addVendorDocumentKind(organizationId, { label: String(formData.get("label") ?? ""), expires: formData.get("expires") === "on" });
  } catch (error) {
    if (error instanceof RangeError) return { error: t("labelInvalid") };
    throw error;
  }
  revalidatePath("/prestataires/parametres/pieces");
  return { success: true };
}

export async function archiveDocumentKindAction(formData: FormData): Promise<void> {
  const organizationId = await authorize();
  const kindId = String(formData.get("kindId") ?? "");
  if (!organizationId || !isValidId(kindId)) return;
  await archiveVendorDocumentKind(organizationId, kindId);
  revalidatePath("/prestataires/parametres/pieces");
}

// Lot 73d (PRE-05 ; spécification du lot 73, § 5.4 ; P3, P4, D7) — les deux réglages d'une nature, enregistrés
// seuls : son nom court (« Assurance » ; vide, le libellé complet s'affiche ; aucun genre grammatical) et
// « Demandée d'habitude » (proposée en un bouton sur une fiche neuve).
export async function saveDocumentKindUsageAction(_previous: DocumentSettingsState, formData: FormData): Promise<DocumentSettingsState> {
  const t = await getTranslations("VendorDocumentSettings");
  const organizationId = await authorize();
  if (!organizationId) return { error: t("unauthorized") };
  const kindId = String(formData.get("kindId") ?? "");
  if (!isValidId(kindId)) return { error: t("kindNotFound") };
  try {
    await setVendorDocumentKindUsage(organizationId, kindId, { shortLabel: String(formData.get("shortLabel") ?? ""), requestedByDefault: formData.get("requestedByDefault") === "on" });
  } catch (error) {
    if (error instanceof RangeError) return { error: t("shortLabelInvalid") };
    if (error instanceof VendorDocumentNotFoundError) return { error: t("kindNotFound") };
    throw error;
  }
  revalidatePath("/prestataires/parametres/pieces");
  return { success: true, at: Date.now() };
}
