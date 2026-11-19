"use server";

// Lot 48a (PRE-05, PRE-10, SEC-27, DAT-08 ; ADR 0093) — actions de la fiche : IBAN (changé, puis
// « J'ai vérifié par téléphone »), pièces (demandée, vérifiée, retirée, fin de validité), note
// confidentielle. Chaque action vérifie session, organisation et module ; la fiche vient du formulaire,
// les droits de la base (RLS) ; aucune valeur bancaire n'est écrite dans un journal ni une erreur.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  ConfidentialNoteForbiddenError,
  InvalidBankDetailsError,
  removeVendorDocument,
  requestVendorDocument,
  saveVendorNote,
  setVendorBankDetails,
  setVendorDocumentValidity,
  VendorDocumentNotFoundError,
  verifyVendorBankDetails,
  verifyVendorDocument,
} from "@/modules/vendors/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "../module-access";

export type RecordFormState = { error?: string; success?: boolean };

async function authorize() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isVendorsModuleEnabled(auth.user.organizationId))) return null;
  return { userId: auth.user.id, organizationId: auth.user.organizationId, role: auth.user.role };
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

export async function setVendorBankAction(_previous: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const t = await getTranslations("VendorRecords");
  const access = await authorize();
  const vendorId = text(formData, "vendorId");
  if (!access || !isValidId(vendorId)) return { error: t("unauthorized") };
  try {
    await setVendorBankDetails(access.organizationId, vendorId, { iban: text(formData, "iban"), bic: text(formData, "bic") }, { kind: "user", userId: access.userId });
  } catch (error) {
    if (error instanceof InvalidBankDetailsError) return { error: t(error.field === "iban" ? "ibanInvalid" : "bicInvalid") };
    return { error: t("notFound") };
  }
  revalidatePath(`/prestataires/${vendorId}`);
  return { success: true };
}

export async function verifyVendorBankAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const vendorId = text(formData, "vendorId");
  if (!access || !isValidId(vendorId)) return;
  await verifyVendorBankDetails(access.organizationId, vendorId, access.userId);
  revalidatePath(`/prestataires/${vendorId}`);
  revalidatePath("/");
}

export async function requestVendorDocumentAction(_previous: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const t = await getTranslations("VendorRecords");
  const access = await authorize();
  const vendorId = text(formData, "vendorId");
  const kindId = text(formData, "kindId");
  if (!access || !isValidId(vendorId) || !isValidId(kindId)) return { error: t("unauthorized") };
  try {
    await requestVendorDocument({ organizationId: access.organizationId, vendorId, kindId });
  } catch (error) {
    if (error instanceof VendorDocumentNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(`/prestataires/${vendorId}`);
  return { success: true };
}

export async function verifyVendorDocumentAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const vendorId = text(formData, "vendorId");
  const documentId = text(formData, "documentId");
  if (!access || !isValidId(vendorId) || !isValidId(documentId)) return;
  try {
    await verifyVendorDocument(access.organizationId, documentId, access.userId);
  } catch (error) {
    if (!(error instanceof VendorDocumentNotFoundError)) throw error;
  }
  revalidatePath(`/prestataires/${vendorId}`);
}

export async function removeVendorDocumentAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const vendorId = text(formData, "vendorId");
  const documentId = text(formData, "documentId");
  if (!access || !isValidId(vendorId) || !isValidId(documentId)) return;
  await removeVendorDocument(access.organizationId, documentId);
  revalidatePath(`/prestataires/${vendorId}`);
}

export async function setVendorDocumentValidityAction(_previous: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const t = await getTranslations("VendorRecords");
  const access = await authorize();
  const vendorId = text(formData, "vendorId");
  const documentId = text(formData, "documentId");
  if (!access || !isValidId(vendorId) || !isValidId(documentId)) return { error: t("unauthorized") };
  try {
    await setVendorDocumentValidity(access.organizationId, documentId, text(formData, "validUntil") || null);
  } catch (error) {
    if (error instanceof RangeError) return { error: t("validUntilInvalid") };
    if (error instanceof VendorDocumentNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(`/prestataires/${vendorId}`);
  return { success: true };
}

export async function saveVendorNoteAction(_previous: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const t = await getTranslations("VendorRecords");
  const access = await authorize();
  const vendorId = text(formData, "vendorId");
  if (!access || !isValidId(vendorId)) return { error: t("unauthorized") };
  try {
    await saveVendorNote(access.organizationId, vendorId, { note: text(formData, "note"), confidential: formData.get("confidential") === "on" }, { userId: access.userId, role: access.role });
  } catch (error) {
    if (error instanceof ConfidentialNoteForbiddenError) return { error: t("noteForbidden") };
    return { error: t("notFound") };
  }
  revalidatePath(`/prestataires/${vendorId}`);
  return { success: true };
}
