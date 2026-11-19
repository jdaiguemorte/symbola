"use server";

// Lot 34b (CHR-02, D12) — le prestataire coche une tâche qui lui est confiée, depuis son espace
// ouvert par son lien personnel. Contrôles côté serveur : session du lien, module Évènements ; le
// service vérifie que la tâche est de son événement et qu'elle lui est confiée.
import { revalidatePath } from "next/cache";
import { answerVendorBrief, confirmVendorRoadmap, LinkAccessDeniedError, linkVendorRecordId, setVendorLinkTaskDone } from "@/modules/events/service";
import { InvalidBankDetailsError, setVendorBankDetails } from "@/modules/vendors/service";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { currentLinkAccess } from "@/lib/link-session";

export async function toggleVendorTaskAction(formData: FormData): Promise<void> {
  const access = await currentLinkAccess();
  if (!access || access.audience !== "vendor" || !(await isEventsModuleEnabled(access.organizationId))) return;
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(taskId)) return;
  try {
    await setVendorLinkTaskDone(access.organizationId, access.linkId, taskId, formData.get("done") === "true");
  } catch (error) {
    if (!(error instanceof LinkAccessDeniedError)) throw error;
  }
  revalidatePath("/prestataire");
}

// Lot 47 (PRE-04 ; D4 ; ADR 0085) — la réponse « disponible » ou non, confirmée d'un toucher sur la
// page (jamais à l'ouverture du lien de l'e-mail). Session du lien prestataire et module vérifiés ;
// le service revérifie que le lien est en consultation et que la planner n'a pas tranché.
export type VendorAnswerState = { error?: string; success?: boolean };

export async function answerAvailabilityAction(_prev: VendorAnswerState, formData: FormData): Promise<VendorAnswerState> {
  const access = await currentLinkAccess();
  if (!access || access.audience !== "vendor" || !(await isEventsModuleEnabled(access.organizationId))) return { error: "closed" };
  const availability = String(formData.get("availability") ?? "");
  if (availability !== "available" && availability !== "unavailable") return { error: "closed" };
  try {
    await answerVendorBrief({ organizationId: access.organizationId, linkId: access.linkId, availability, message: String(formData.get("message") ?? "") });
  } catch (error) {
    if (error instanceof LinkAccessDeniedError) return { error: "closed" };
    throw error;
  }
  revalidatePath("/prestataire");
  return { success: true };
}

// Lot 47 (PAR-05 étape 6 ; D8) — « J'ai bien reçu » la feuille de route : horodaté.
export async function confirmRoadmapAction(): Promise<void> {
  const access = await currentLinkAccess();
  if (!access || access.audience !== "vendor" || !(await isEventsModuleEnabled(access.organizationId))) return;
  try {
    await confirmVendorRoadmap({ organizationId: access.organizationId, linkId: access.linkId });
  } catch (error) {
    if (!(error instanceof LinkAccessDeniedError)) throw error;
  }
  revalidatePath("/prestataire");
}

// Lot 48a (PRE-10, SEC-27 ; D5, ADR 0093) — le prestataire donne ou change son IBAN par son lien. La
// fiche vient du lien, jamais du formulaire : un lien ne change que l'IBAN de son prestataire. Le
// changement est journalisé et reste « à vérifier par un autre canal » chez la planner ; il n'est
// jamais montré au client avant la levée.
export type VendorBankState = { error?: "closed" | "iban" | "bic"; success?: boolean };

export async function setVendorBankByLinkAction(_prev: VendorBankState, formData: FormData): Promise<VendorBankState> {
  const access = await currentLinkAccess();
  if (!access || access.audience !== "vendor" || !(await isVendorsModuleEnabled(access.organizationId))) return { error: "closed" };
  const vendorId = await linkVendorRecordId(access.organizationId, access.linkId);
  if (!vendorId) return { error: "closed" };
  try {
    await setVendorBankDetails(access.organizationId, vendorId, { iban: String(formData.get("iban") ?? ""), bic: String(formData.get("bic") ?? "") }, { kind: "link", linkId: access.linkId });
  } catch (error) {
    if (error instanceof InvalidBankDetailsError) return { error: error.field };
    throw error;
  }
  revalidatePath("/prestataire");
  return { success: true };
}
