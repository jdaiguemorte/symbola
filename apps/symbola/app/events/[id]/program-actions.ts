"use server";

// PRD-EVT-05 — actions du programme du jour J sur la fiche d'un événement.
import { offerUndo } from "@/lib/undo";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  addProgramItem,
  applyProgramTemplate,
  EventNotFoundError,
  getEventProgram,
  ProgramItemInvalidError,
  KeyMomentNotFoundError,
  importEventProgram,
  ProgramItemNotFoundError,
  ProgramShiftOutOfDayError,
  ProgramParticipantNotFoundError,
  DemoEventRestrictionError,
  notifyProgramVersion,
  ProgramNotifyError,
  ProgramPublishError,
  ProgramTemplateNotFoundError,
  publishEventProgram,
  removeProgramItem,
  shiftProgramItems,
  TaskLabelRequiredError,
  updateProgramItem,
  type ProgramItemInput,
} from "@/modules/events/service";
import { MailQuotaExceededError } from "@symbola/mail";
import type { ProgramImportResult, RecipientsReview } from "@symbola/contracts";
import { EmailVariableMissingError, RecipientsNotConfirmedError } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { emailVariableMissingMessage } from "../../email-errors";
import { isEventsModuleEnabled, isValidId } from "../module-access";
import { renderRecipientProgramPdf } from "./programme/render-program-pdf";

export type ProgramFormState = { error?: string; success?: boolean };

type Translator = Awaited<ReturnType<typeof getTranslations>>;

async function authorize(t: Translator) {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") } as const;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") } as const;
  return { organizationId: auth.user.organizationId } as const;
}

// Les intervenants libres se saisissent séparés par des virgules. Lot 30b : la durée
// (minutes) donne l'heure de fin quand celle-ci est vide.
function readProgramItem(formData: FormData): ProgramItemInput | null {
  const vendorSlotIds = formData.getAll("vendorSlotIds").map(String);
  if (!vendorSlotIds.every(isValidId)) return null;
  const duration = String(formData.get("durationMinutes") ?? "").trim();
  return {
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    durationMinutes: duration === "" ? null : /^\d+$/.test(duration) ? Number(duration) : Number.NaN,
    label: String(formData.get("label") ?? ""),
    location: String(formData.get("location") ?? ""),
    internalNote: String(formData.get("internalNote") ?? ""),
    responsible: String(formData.get("responsible") ?? ""),
    vendorSlotIds,
    freeParticipants: String(formData.get("freeParticipants") ?? "").split(","),
    // Lot 51 (EVT-04) : vide, le premier temps fort du jour de l'évènement (ou inchangé).
    keyMomentId: isValidId(String(formData.get("keyMomentId") ?? "")) ? String(formData.get("keyMomentId")) : null,
  };
}

function programErrorMessage(error: unknown, t: Translator): string {
  if (error instanceof EventNotFoundError) return t("eventNotFound");
  if (error instanceof ProgramItemNotFoundError) return t("programItemNotFound");
  if (error instanceof ProgramParticipantNotFoundError) return t("programParticipantNotFound");
  if (error instanceof ProgramTemplateNotFoundError) return t("programTemplateNotFound");
  if (error instanceof TaskLabelRequiredError) return t("missingLabel");
  if (error instanceof ProgramItemInvalidError) return error.reason === "responsible" ? t("programResponsibleTooLong") : error.reason === "moment" ? t("programMomentInvalid") : t("programDurationInvalid");
  if (error instanceof KeyMomentNotFoundError) return t("programMomentInvalid");
  if (error instanceof ProgramShiftOutOfDayError) return t("programShiftOutOfDay");
  if (error instanceof RangeError) return t("invalidTime");
  throw error;
}

export async function addProgramItemAction(_prevState: ProgramFormState, formData: FormData): Promise<ProgramFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const item = readProgramItem(formData);
  if (!item) return { error: t("programParticipantNotFound") };

  try {
    await addProgramItem(access.organizationId, eventId, item);
  } catch (error) {
    return { error: programErrorMessage(error, t) };
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function updateProgramItemAction(_prevState: ProgramFormState, formData: FormData): Promise<ProgramFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = String(formData.get("eventId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!isValidId(eventId) || !isValidId(itemId)) return { error: t("programItemNotFound") };
  const item = readProgramItem(formData);
  if (!item) return { error: t("programParticipantNotFound") };

  // Lot 30b (CHR-06, décision D8) : l'heure de début d'avant, pour proposer de décaler
  // les séquences suivantes d'autant.
  const before = await getEventProgram(access.organizationId, eventId).catch(() => null);
  const oldStart = before?.items.find((line) => line.id === itemId)?.startTime ?? null;
  let saved;
  try {
    saved = await updateProgramItem(access.organizationId, itemId, item);
  } catch (error) {
    return { error: programErrorMessage(error, t) };
  }
  revalidatePath(`/events/${eventId}`);
  if (oldStart && oldStart !== saved.startTime && saved.eventId === eventId) {
    redirect(`/events/${eventId}?${new URLSearchParams({ onglet: "programme", decalage: itemId, depuis: oldStart }).toString()}#program-title`);
  }
  return { success: true };
}

// Lot 30b (CHR-06, décision D8 ; UX-07) : décaler les séquences suivantes, et annuler
// dans les dix secondes par le décalage opposé.
const shiftSchema = z.object({
  eventId: z.string().refine(isValidId),
  itemIds: z.array(z.string().refine(isValidId)).min(1).max(500),
  minutes: z.number().int().min(-720).max(720).refine((value) => value !== 0),
});

export type ProgramShiftState = { ok: true; count: number } | { ok: false; error: string };

export async function shiftProgramItemsAction(input: { eventId: string; itemIds: string[]; minutes: number }): Promise<ProgramShiftState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { ok: false, error: access.error };
  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("programItemNotFound") };
  try {
    const shifted = await shiftProgramItems(access.organizationId, parsed.data.eventId, parsed.data.itemIds, parsed.data.minutes);
    revalidatePath(`/events/${parsed.data.eventId}`);
    return { ok: true, count: shifted.length };
  } catch (error) {
    return { ok: false, error: programErrorMessage(error, t) };
  }
}

export async function applyProgramTemplateAction(_prevState: ProgramFormState, formData: FormData): Promise<ProgramFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = String(formData.get("eventId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  if (!isValidId(templateId)) return { error: t("programTemplateNotFound") };

  try {
    await applyProgramTemplate(access.organizationId, eventId, templateId);
  } catch (error) {
    return { error: programErrorMessage(error, t) };
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function removeProgramItemAction(formData: FormData): Promise<void> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return;
  const eventId = String(formData.get("eventId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!isValidId(eventId) || !isValidId(itemId)) return;
  await removeProgramItem(access.organizationId, itemId);
  await offerUndo({ kind: "programItem", id: itemId });
  revalidatePath(`/events/${eventId}`);
}

// Lot 37b (CHR-07, DAT-14 ; D8, ADR 0071) : « Diffuser le programme » fige une version numérotée que
// les clients et les prestataires liront ; refusée vide ou déjà diffusée telle quelle.
export type ProgramPublishState = { error?: string; published?: number };

export async function publishProgramAction(_prevState: ProgramPublishState, formData: FormData): Promise<ProgramPublishState> {
  const t = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return { error: t("moduleUnavailable") };
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  try {
    const version = await publishEventProgram({ organizationId, eventId, userId: auth.user.id });
    revalidatePath(`/events/${eventId}`);
    return { published: version.number };
  } catch (error) {
    if (error instanceof ProgramPublishError) return { error: error.reason === "empty" ? t("programPublishEmpty") : t("programPublishUnchanged") };
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
}

// Lot 38a (D9 ; MSG-02, D8) — « Prévenir par e-mail » : la dernière version diffusée part à ses
// destinataires, chacun avec son PDF, dans sa langue. À plusieurs, l'écran du garde-fou d'abord.
export type ProgramNotifyState = { error?: string; sent?: number; notSent?: number; confirmRecipients?: RecipientsReview };

export async function notifyProgramAction(_prevState: ProgramNotifyState, formData: FormData): Promise<ProgramNotifyState> {
  const t = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return { error: t("moduleUnavailable") };
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  try {
    const result = await notifyProgramVersion({
      organizationId,
      eventId,
      confirmedRecipients: String(formData.get("confirmedRecipients") ?? "") || null,
      renderDocument: (document) => renderRecipientProgramPdf(organizationId, document),
    });
    revalidatePath(`/events/${eventId}`);
    return { sent: result.sent, notSent: result.notSent };
  } catch (error) {
    if (error instanceof RecipientsNotConfirmedError) return { confirmRecipients: error.review };
    if (error instanceof EmailVariableMissingError) return { error: await emailVariableMissingMessage(error) };
    if (error instanceof ProgramNotifyError) {
      if (error.reason === "already_notified") revalidatePath(`/events/${eventId}`);
      return { error: t(error.reason === "no_version" ? "programNotifyNoVersion" : error.reason === "already_notified" ? "programNotifyAlready" : "programNotifyNoRecipients") };
    }
    if (error instanceof MailQuotaExceededError) return { error: t("mailQuotaReached", { minutes: Math.max(1, Math.ceil(error.retryAfterSeconds / 60)) }) };
    if (error instanceof DemoEventRestrictionError) return { error: t("programNotifyTrial") };
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    // Messagerie injoignable : message clair ; nom de l'erreur seulement au journal (SEC-20).
    console.error("envoi du programme échoué", error instanceof Error ? error.name : "erreur");
    return { error: t("programNotifyFailed") };
  }
}

// Lot 51 (CHR-08 ; ADR 0091) — import d'un chrono depuis un tableur : l'aperçu (écran de contrôle,
// écarts expliqués) d'abord, rien n'est écrit ; puis l'écriture, du même fichier, sans les lignes
// écartées. Le fichier passe par l'action serveur (limite de 1 Mo : un chrono en pèse quelques Ko).
export type ProgramImportState = { error?: string; result?: ProgramImportResult };
const PROGRAM_IMPORT_MAX_BYTES = 1024 * 1024;

export async function importProgramAction(_prev: ProgramImportState, formData: FormData): Promise<ProgramImportState> {
  const t = await getTranslations("Events");
  const auth = await authorize(t);
  if ("error" in auth) return { error: auth.error };
  const eventId = String(formData.get("eventId") ?? "");
  const file = formData.get("file");
  if (!isValidId(eventId) || !(file instanceof File) || file.size === 0) return { error: t("programImportFile") };
  if (file.size > PROGRAM_IMPORT_MAX_BYTES) return { error: t("programImportTooLarge") };
  const apply = formData.get("intent") === "apply";
  const skipLines = formData.getAll("skip").map(Number).filter((line) => Number.isInteger(line) && line > 0);
  try {
    const result = await importEventProgram({ organizationId: auth.organizationId, eventId, bytes: new Uint8Array(await file.arrayBuffer()), apply: apply ? { skipLines } : null });
    if (result.status === "applied") revalidatePath(`/events/${eventId}`);
    return { result };
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
}
