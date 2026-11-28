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
import { requestUsualDocuments, undoRequestedDocuments } from "@/lib/vendors/vendor-sheet";
import { z } from "zod";
import { isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "../module-access";

// Lot 73d : notice, le message de retour d'une demande (« Demande déposée : Assurance »).
export type RecordFormState = { error?: string; success?: boolean; notice?: string; at?: number };

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
  let label: string;
  try {
    label = (await requestVendorDocument({ organizationId: access.organizationId, vendorId, kindId })).kindLabel;
  } catch (error) {
    if (error instanceof VendorDocumentNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(`/prestataires/${vendorId}`);
  const tSheet = await getTranslations("VendorSheet");
  return { success: true, notice: tSheet("documents.requestDone", { document: label }), at: Date.now() };
}

// Lot 73d (PRE-05 ; spécification du lot 73, § 5.4, critère 10 ; P4) — « Demander l'assurance et le Kbis » :
// les natures demandées d'habitude, d'un geste, déposées sur le lien du prestataire (lot 47) ; le message
// « 2 pièces demandées à {nom} » et son « Annuler » (les demandes encore en attente sont retirées).
export type UsualRequestResult = { ok: true; message: string; documentIds: string[] } | { ok: false; error: string };

const usualSchema = z.object({ vendorId: z.uuid() });

export async function requestUsualDocumentsAction(input: unknown): Promise<UsualRequestResult> {
  const t = await getTranslations("VendorRecords");
  const tSheet = await getTranslations("VendorSheet");
  const access = await authorize();
  const parsed = usualSchema.safeParse(input);
  if (!access) return { ok: false, error: t("unauthorized") };
  if (!parsed.success) return { ok: false, error: t("notFound") };
  try {
    const requested = await requestUsualDocuments(access.organizationId, parsed.data.vendorId);
    revalidatePath(`/prestataires/${parsed.data.vendorId}`);
    return { ok: true, documentIds: requested.documentIds, message: tSheet("documents.requested", { count: requested.documentIds.length, name: requested.vendorName }) };
  } catch {
    return { ok: false, error: t("notFound") };
  }
}

export async function undoUsualDocumentsAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  const tSheet = await getTranslations("VendorSheet");
  const access = await authorize();
  const parsed = usualSchema.extend({ documentIds: z.array(z.uuid()).min(1).max(20) }).safeParse(input);
  if (!access || !parsed.success) return { ok: false, message: tSheet("documents.undoFailed") };
  const removed = await undoRequestedDocuments(access.organizationId, parsed.data.vendorId, parsed.data.documentIds);
  revalidatePath(`/prestataires/${parsed.data.vendorId}`);
  return { ok: removed > 0, message: tSheet(removed > 0 ? "documents.undone" : "documents.undoFailed") };
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
