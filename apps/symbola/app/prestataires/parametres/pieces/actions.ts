"use server";

// Lot 48a (PRE-05 ; D3, ADR 0093) — réglages des pièces : délai d'alerte avant la fin de validité,
// natures de pièces de l'organisation. Session, organisation et module vérifiés.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { addVendorDocumentKind, archiveVendorDocumentKind, setVendorDocumentAlertDays } from "@/modules/vendors/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "../../module-access";

export type DocumentSettingsState = { error?: string; success?: boolean };

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
