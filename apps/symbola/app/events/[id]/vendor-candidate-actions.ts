"use server";

// Lot 11 (EVT-08 / EVT-09) — actions des prestataires consultés d'un poste.
// Chaque action vérifie la session, l'organisation et le module ; les
// identifiants sont validés avant toute requête.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { parseAmountToCents } from "@symbola/i18n";
import {
  addVendorCandidate,
  addVendorCandidateNote,
  attachVendorCandidateQuote,
  CandidateQuoteRejectedError,
  linkVendorCandidate,
  removeVendorCandidate,
  removeVendorCandidateNote,
  selectVendorCandidate,
  setVendorCandidateNoteVisibility,
  setVendorSlotBrief,
  updateVendorCandidate,
  VendorCandidateNotFoundError,
  type VendorCandidateResponse,
} from "@/modules/events/service";
import { createVendor, getVendor } from "@/modules/vendors/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type CandidateFormState = { error?: string; success?: boolean };

const RESPONSES: VendorCandidateResponse[] = ["contacted", "quote_received", "declined"];

async function authorize() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { userId: auth.user.id, organizationId: auth.user.organizationId };
}

function ids(formData: FormData, ...names: string[]): string[] | null {
  const values = names.map((name) => String(formData.get(name) ?? ""));
  return values.every(isValidId) ? values : null;
}

function refresh(eventId: string) {
  revalidatePath(`/events/${eventId}`);
}

// Ajout d'un consulté : depuis le carnet (fiche choisie), en créant une
// fiche, ou en saisie libre quand le module Prestataires n'est pas souscrit.
export async function addCandidateAction(_prev: CandidateFormState, formData: FormData): Promise<CandidateFormState> {
  const t = await getTranslations("VendorCandidates");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  const found = ids(formData, "eventId", "vendorSlotId");
  if (!found) return { error: t("notFound") };
  const [eventId, vendorSlotId] = found as [string, string];
  let vendorName = String(formData.get("vendorName") ?? "").trim();
  let vendorId: string | null = null;
  const vendorsAvailable = await isVendorsModuleEnabled(access.organizationId);
  const chosen = String(formData.get("vendorId") ?? "");
  if (vendorsAvailable && isValidId(chosen)) {
    const vendor = await getVendor(access.organizationId, chosen);
    if (!vendor) return { error: t("notFound") };
    vendorId = vendor.id;
    vendorName = vendor.name;
  }
  if (!vendorName) return { error: t("nameRequired") };
  if (vendorsAvailable && !vendorId && formData.get("addToBook") === "on") {
    vendorId = (await createVendor(access.organizationId, { name: vendorName, typeId: null })).vendor.id;
  }
  try {
    await addVendorCandidate({ organizationId: access.organizationId, eventId, vendorSlotId, vendorName, vendorId });
  } catch (error) {
    if (error instanceof VendorCandidateNotFoundError) return { error: t("notFound") };
    throw error;
  }
  refresh(eventId);
  return { success: true };
}

export async function updateCandidateAction(_prev: CandidateFormState, formData: FormData): Promise<CandidateFormState> {
  const t = await getTranslations("VendorCandidates");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  const found = ids(formData, "eventId", "candidateId");
  if (!found) return { error: t("notFound") };
  const [eventId, candidateId] = found as [string, string];
  const response = String(formData.get("response") ?? "");
  if (!RESPONSES.includes(response as VendorCandidateResponse)) return { error: t("invalidResponse") };
  const quoteAmountCents = parseAmountToCents(String(formData.get("quoteAmount") ?? ""));
  if (quoteAmountCents === undefined) return { error: t("invalidAmount") };
  const contactedOn = String(formData.get("contactedOn") ?? "").trim() || null;
  try {
    await updateVendorCandidate({
      organizationId: access.organizationId,
      candidateId,
      response: response as VendorCandidateResponse,
      quoteAmountCents,
      contactedOn,
      shownToClients: formData.get("shownToClients") === "on",
    });
  } catch (error) {
    if (error instanceof VendorCandidateNotFoundError) return { error: t("notFound") };
    if (error instanceof RangeError) return { error: t("invalidDate") };
    throw error;
  }
  refresh(eventId);
  return { success: true };
}

export async function attachCandidateQuoteAction(_prev: CandidateFormState, formData: FormData): Promise<CandidateFormState> {
  const t = await getTranslations("VendorCandidates");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  const found = ids(formData, "eventId", "candidateId");
  if (!found) return { error: t("notFound") };
  const [eventId, candidateId] = found as [string, string];
  const file = formData.get("quote");
  if (!(file instanceof File) || file.size === 0) return { error: t("quoteMissing") };
  try {
    await attachVendorCandidateQuote({ organizationId: access.organizationId, candidateId, content: new Uint8Array(await file.arrayBuffer()) });
  } catch (error) {
    if (error instanceof CandidateQuoteRejectedError) {
      return { error: t(error.reason === "too_large" ? "quoteTooLarge" : error.reason === "infected" ? "quoteInfected" : "quoteUnsupported") };
    }
    if (error instanceof VendorCandidateNotFoundError) return { error: t("notFound") };
    throw error;
  }
  refresh(eventId);
  return { success: true };
}

export async function addCandidateNoteAction(_prev: CandidateFormState, formData: FormData): Promise<CandidateFormState> {
  const t = await getTranslations("VendorCandidates");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  const found = ids(formData, "eventId", "candidateId");
  if (!found) return { error: t("notFound") };
  const [eventId, candidateId] = found as [string, string];
  const body = String(formData.get("body") ?? "");
  if (!body.trim()) return { error: t("noteRequired") };
  try {
    await addVendorCandidateNote({
      organizationId: access.organizationId,
      candidateId,
      body,
      visibleToClients: formData.get("visibleToClients") === "on",
      createdByUserId: access.userId,
    });
  } catch (error) {
    if (error instanceof VendorCandidateNotFoundError) return { error: t("notFound") };
    if (error instanceof RangeError) return { error: t("noteTooLong") };
    throw error;
  }
  refresh(eventId);
  return { success: true };
}

export async function toggleCandidateNoteAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const found = ids(formData, "eventId", "noteId");
  if (!access || !found) return;
  const [eventId, noteId] = found as [string, string];
  await setVendorCandidateNoteVisibility(access.organizationId, noteId, formData.get("visibleToClients") === "true");
  refresh(eventId);
}

export async function removeCandidateNoteAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const found = ids(formData, "eventId", "noteId");
  if (!access || !found) return;
  const [eventId, noteId] = found as [string, string];
  await removeVendorCandidateNote(access.organizationId, noteId);
  refresh(eventId);
}

export async function selectCandidateAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const found = ids(formData, "eventId", "candidateId");
  if (!access || !found) return;
  const [eventId, candidateId] = found as [string, string];
  await selectVendorCandidate({ organizationId: access.organizationId, candidateId, changedByUserId: access.userId }).catch((error: unknown) => {
    if (!(error instanceof VendorCandidateNotFoundError)) throw error;
  });
  refresh(eventId);
}

export async function removeCandidateAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const found = ids(formData, "eventId", "candidateId");
  if (!access || !found) return;
  const [eventId, candidateId] = found as [string, string];
  await removeVendorCandidate(access.organizationId, candidateId);
  refresh(eventId);
}

// Un consulté saisi en texte libre entre dans le carnet (une seule fiche).
export async function addCandidateToBookAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const found = ids(formData, "eventId", "candidateId");
  if (!access || !found || !(await isVendorsModuleEnabled(access.organizationId))) return;
  const [eventId, candidateId] = found as [string, string];
  const name = String(formData.get("vendorName") ?? "").trim();
  if (!name) return;
  const { vendor } = await createVendor(access.organizationId, { name, typeId: null });
  await linkVendorCandidate(access.organizationId, candidateId, vendor.id);
  refresh(eventId);
}

export async function saveSlotBriefAction(_prev: CandidateFormState, formData: FormData): Promise<CandidateFormState> {
  const t = await getTranslations("VendorCandidates");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  const found = ids(formData, "eventId", "vendorSlotId");
  if (!found) return { error: t("notFound") };
  const [eventId, vendorSlotId] = found as [string, string];
  await setVendorSlotBrief(access.organizationId, vendorSlotId, String(formData.get("brief") ?? ""));
  refresh(eventId);
  return { success: true };
}
