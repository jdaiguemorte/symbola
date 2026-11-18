"use server";

// Lot 47 (PRE-03, BUD-05, PRE-09, PAR-05 ; D1, D4, D6, D10 ; ADR 0085) — actions de l'écran « Demander
// des devis » d'un poste : brief, destinataires (écran de contrôle, MSG-02), envoi, partage au client,
// annulation d'un choix engagé. Chaque action vérifie la session, l'organisation et le module ; les
// identifiants sont validés avant toute requête ; le service revérifie tout (évènement, poste).
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { parseAmountToCents } from "@symbola/i18n";
import {
  addVendorCandidate,
  DecisionInvalidError,
  DemoEventRestrictionError,
  EngagementUndoError,
  listVendorCandidates,
  requestDecision,
  saveVendorBrief,
  sendVendorBrief,
  undoDecisionEngagement,
  updateVendorCandidate,
  VendorBriefInvalidError,
} from "@/modules/events/service";
import { RecipientsNotConfirmedError, reviewRecipients } from "@/modules/hub/service";
import { MailQuotaExceededError } from "@symbola/mail";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

export type BriefFormState = { error?: string; success?: boolean };
export type RecipientsState = {
  error?: string;
  // Écran de contrôle : la liste exacte qui recevra le brief, et son empreinte.
  review?: { candidateId: string; name: string; email: string }[];
  digest?: string;
  sent?: number;
};
export type ShareState = { error?: string; success?: boolean };

async function authorize() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { userId: auth.user.id, organizationId: auth.user.organizationId };
}

function pathOf(eventId: string, slotId: string): string {
  return `/events/${eventId}/consultation/${slotId}`;
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function saveBriefAction(_prev: BriefFormState, formData: FormData): Promise<BriefFormState> {
  const t = await getTranslations("VendorCoordination");
  const user = await authorize();
  const eventId = text(formData, "eventId");
  const slotId = text(formData, "vendorSlotId");
  if (!user || !isValidId(eventId) || !isValidId(slotId)) return { error: t("errors.unauthorized") };
  const guests = text(formData, "guestCount");
  const budget = text(formData, "indicativeBudget");
  const budgetCents = parseAmountToCents(budget);
  if (budgetCents === undefined) return { error: t("errors.budget") };
  try {
    await saveVendorBrief({
      organizationId: user.organizationId,
      eventId,
      vendorSlotId: slotId,
      need: text(formData, "need"),
      guestCount: guests ? Number(guests) : null,
      indicativeBudgetCents: budgetCents,
      showBudget: formData.get("showBudget") === "on",
      deadline: text(formData, "deadline"),
      documentIds: formData.getAll("documentIds").map(String).filter(isValidId),
    });
  } catch (error) {
    if (error instanceof VendorBriefInvalidError) return { error: t(`errors.${error.reason}`) };
    throw error;
  }
  revalidatePath(pathOf(eventId, slotId));
  return { success: true };
}

// Deux temps (MSG-02) : « Vérifier les destinataires » montre la liste exacte ; « Envoyer » ne part
// que pour cette liste (son empreinte), un e-mail et un lien par prestataire.
export async function recipientsAction(_prev: RecipientsState, formData: FormData): Promise<RecipientsState> {
  const t = await getTranslations("VendorCoordination");
  const user = await authorize();
  const eventId = text(formData, "eventId");
  const slotId = text(formData, "vendorSlotId");
  if (!user || !isValidId(eventId) || !isValidId(slotId)) return { error: t("errors.unauthorized") };
  const chosen = formData.getAll("candidateIds").map(String).filter(isValidId);
  const recipients = chosen.map((candidateId) => ({ candidateId, name: text(formData, `name-${candidateId}`), email: text(formData, `email-${candidateId}`) }));
  if (recipients.length === 0) return { error: t("errors.recipients") };
  if (recipients.some((recipient) => !recipient.name || !recipient.email)) return { error: t("errors.email") };
  const digest = text(formData, "digest");
  if (formData.get("step") !== "send") {
    const review = reviewRecipients(recipients.map((recipient) => ({ name: recipient.name, email: recipient.email })));
    return { review: recipients, digest: review.digest };
  }
  try {
    const delivery = await sendVendorBrief({
      organizationId: user.organizationId,
      eventId,
      vendorSlotId: slotId,
      sentByUserId: user.userId,
      recipients,
      confirmedDigest: digest || null,
      locale: (await getLocale()) === "en" ? "en" : "fr",
    });
    revalidatePath(pathOf(eventId, slotId));
    return { sent: delivery.sent };
  } catch (error) {
    if (error instanceof RecipientsNotConfirmedError) return { review: recipients, digest: error.review.digest, error: t("errors.changed") };
    if (error instanceof VendorBriefInvalidError) return { error: t(`errors.${error.reason}`) };
    if (error instanceof DemoEventRestrictionError) return { error: t("errors.demo") };
    if (error instanceof MailQuotaExceededError) return { error: t("errors.quota") };
    throw error;
  }
}

// Ajouter un prestataire consulté au poste, par son nom (sans le module Prestataires : ARC-07).
export async function addConsultedAction(_prev: BriefFormState, formData: FormData): Promise<BriefFormState> {
  const t = await getTranslations("VendorCoordination");
  const user = await authorize();
  const eventId = text(formData, "eventId");
  const slotId = text(formData, "vendorSlotId");
  const name = text(formData, "vendorName");
  if (!user || !isValidId(eventId) || !isValidId(slotId)) return { error: t("errors.unauthorized") };
  if (!name) return { error: t("errors.name") };
  try {
    await addVendorCandidate({ organizationId: user.organizationId, eventId, vendorSlotId: slotId, vendorName: name });
  } catch (error) {
    if (error instanceof RangeError) return { error: t("errors.name") };
    return { error: t("errors.unauthorized") };
  }
  revalidatePath(pathOf(eventId, slotId));
  return { success: true };
}

// PRE-09 : la planner coche les prestataires à montrer et demande un choix ; la sélection est
// figée à la demande (décision « options » existante).
export async function shareSelectionAction(_prev: ShareState, formData: FormData): Promise<ShareState> {
  const t = await getTranslations("VendorCoordination");
  const user = await authorize();
  const eventId = text(formData, "eventId");
  const slotId = text(formData, "vendorSlotId");
  if (!user || !isValidId(eventId) || !isValidId(slotId)) return { error: t("errors.unauthorized") };
  const shown = new Set(formData.getAll("shownIds").map(String).filter(isValidId));
  if (shown.size < 2) return { error: t("errors.shareTwo") };
  const candidates = (await listVendorCandidates(user.organizationId, eventId)).filter((candidate) => candidate.vendorSlotId === slotId);
  for (const candidate of candidates) {
    const wanted = shown.has(candidate.id);
    if (candidate.shownToClients !== wanted) await updateVendorCandidate({ organizationId: user.organizationId, candidateId: candidate.id, shownToClients: wanted });
  }
  const dueOn = text(formData, "dueOn");
  try {
    await requestDecision({ organizationId: user.organizationId, eventId, requestedByUserId: user.userId, kind: "option", slotId, note: text(formData, "note") || null, dueOn: dueOn || null });
  } catch (error) {
    if (error instanceof DecisionInvalidError) return { error: t(error.reason === "pending" ? "errors.sharePending" : "errors.shareTwo") };
    if (error instanceof DemoEventRestrictionError) return { error: t("errors.demo") };
    throw error;
  }
  revalidatePath(pathOf(eventId, slotId));
  return { success: true };
}

// D6 : annuler d'un geste, pendant 7 jours, le choix engagé par le client.
export async function undoEngagementAction(formData: FormData): Promise<void> {
  const user = await authorize();
  const eventId = text(formData, "eventId");
  const slotId = text(formData, "vendorSlotId");
  const decisionId = text(formData, "decisionId");
  if (!user || !isValidId(eventId) || !isValidId(slotId) || !isValidId(decisionId)) return;
  try {
    await undoDecisionEngagement({ organizationId: user.organizationId, decisionId, userId: user.userId });
  } catch (error) {
    if (!(error instanceof EngagementUndoError)) throw error;
  }
  revalidatePath(pathOf(eventId, slotId));
}
