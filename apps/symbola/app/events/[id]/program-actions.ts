"use server";

// PRD-EVT-05 — actions du programme du jour J sur la fiche d'un événement. Lot 62c (D1) : les
// séquences s'enregistrent ensemble (saveProgramAction), plus ligne par ligne.
import { offerUndo } from "@/lib/undo";
import { revalidatePath } from "next/cache";
import { pendingPreparedEmailIds, withPreparer } from "@/lib/prepared-emails";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  applyProgramTemplate,
  EventNotFoundError,
  getEventProgram,
  ProgramItemInvalidError,
  KeyMomentNotFoundError,
  importEventProgram,
  completeProgramItem,
  ProgramGapInvalidError,
  ProgramItemNotFoundError,
  ProgramBatchLineError,
  PROGRAM_BATCH_MAX_LINES,
  saveProgramItems,
  EventArchivedError,
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

// Lot 62c (UX-13, décision D1) — « Enregistrer le programme » : les lignes modifiées et les lignes
// ajoutées partent ensemble, dans une seule transaction ; rien n'est écrit si une ligne est
// refusée, et l'écran apprend laquelle pour l'ouvrir. Entrées validées par Zod (SEC-18).
const programLineSchema = z.object({
  startTime: z.string().max(8),
  endTime: z.string().max(8),
  durationMinutes: z.number().int().min(1).max(1440).nullable(),
  label: z.string().max(300),
  location: z.string().max(300),
  internalNote: z.string().max(4000),
  responsible: z.string().max(300),
  vendorSlotIds: z.array(z.string().refine(isValidId)).max(100),
  freeParticipants: z.array(z.string().max(200)).max(50),
  keyMomentId: z.string().refine(isValidId).nullable(),
  // Lot 63b (CHR-08 ; Q44) : cachée des mariés.
  hiddenFromClients: z.boolean().optional(),
});

const saveProgramSchema = z
  .object({
    eventId: z.string().refine(isValidId),
    updates: z.array(z.object({ itemId: z.string().refine(isValidId), item: programLineSchema })).max(PROGRAM_BATCH_MAX_LINES),
    additions: z.array(z.object({ key: z.string().max(64), item: programLineSchema })).max(PROGRAM_BATCH_MAX_LINES),
  })
  .refine((input) => input.updates.length + input.additions.length <= PROGRAM_BATCH_MAX_LINES);

export type ProgramSaveInput = z.input<typeof saveProgramSchema>;
// « line » : la ligne refusée (identifiant d'une séquence, ou clé d'une ligne ajoutée).
// « shift » : une seule séquence a changé d'heure de début (lot 30b, D8), l'écran propose de décaler les suivantes.
export type ProgramSaveState = { ok: true; count: number; shift?: { itemId: string; from: string } } | { ok: false; error: string; line?: string };

export async function saveProgramAction(input: ProgramSaveInput): Promise<ProgramSaveState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { ok: false, error: access.error };
  const parsed = saveProgramSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("programSaveInvalid") };
  const { eventId, updates, additions } = parsed.data;

  // Lot 30b (CHR-06, décision D8) : l'heure de début d'avant, pour proposer de décaler les
  // séquences suivantes quand une seule séquence a changé d'heure.
  const before = await getEventProgram(access.organizationId, eventId).catch(() => null);
  let saved;
  try {
    saved = await saveProgramItems(access.organizationId, eventId, { updates, additions: additions.map((addition) => addition.item) });
  } catch (error) {
    if (error instanceof ProgramBatchLineError) {
      const line = error.line.kind === "update" ? error.line.itemId : additions[error.line.index]?.key;
      return { ok: false, error: programErrorMessage(error.reason, t), ...(line ? { line } : {}) };
    }
    if (error instanceof EventArchivedError) return { ok: false, error: t("programSaveArchived") };
    return { ok: false, error: programErrorMessage(error, t) };
  }
  revalidatePath(`/events/${eventId}`);
  const moved = updates.filter((update) => {
    const oldStart = before?.items.find((line) => line.id === update.itemId)?.startTime;
    const newStart = saved.find((line) => line.id === update.itemId)?.startTime;
    return oldStart !== undefined && newStart !== undefined && oldStart !== newStart;
  });
  if (moved.length === 1 && additions.length === 0) {
    const from = before!.items.find((line) => line.id === moved[0]!.itemId)!.startTime;
    return { ok: true, count: saved.length, shift: { itemId: moved[0]!.itemId, from } };
  }
  return { ok: true, count: saved.length };
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
  let result: Awaited<ReturnType<typeof notifyProgramVersion>>;
  try {
    result = await notifyProgramVersion({
      organizationId,
      eventId,
      confirmedRecipients: String(formData.get("confirmedRecipients") ?? "") || null,
      renderDocument: (document) => renderRecipientProgramPdf(organizationId, document),
    });
    revalidatePath(`/events/${eventId}`);
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
  // Lot 65d (ADR 0110) : préparé pour la messagerie de la planner, la fenêtre s'ouvre aussitôt.
  if (result.prepared) {
    const prepared = await pendingPreparedEmailIds(organizationId, { eventId, kinds: ["program_published"], ref: { version: String(result.version) } });
    if (prepared.length > 0) redirect(withPreparer(`/events/${eventId}?onglet=programme`, prepared));
  }
  return { sent: result.sent, notSent: result.notSent };
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
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Lot 71e (HUB-14) : un PDF de programme passe par l'assistant commun (importEventProgram le refuse).
    const result = await importEventProgram({ organizationId: auth.organizationId, eventId, bytes, apply: apply ? { skipLines } : null });
    if (result.status === "applied") revalidatePath(`/events/${eventId}`);
    return { result };
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
}

// Lot 71e (CHR-06 ; R12) — « Heure de fin » ou « Ponctuel » sur un moment sans fin d'un programme repris.
// Session, organisation et module vérifiés ici ; le moment doit être de ce mariage (SEC-13).
export async function completeProgramItemAction(formData: FormData): Promise<void> {
  const t = await getTranslations("Events");
  const auth = await authorize(t);
  if ("error" in auth) return;
  const eventId = String(formData.get("eventId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!isValidId(eventId) || !isValidId(itemId)) return;
  const endTime = String(formData.get("endTime") ?? "").slice(0, 5);
  const change = formData.get("intent") === "point" ? ({ timing: "point" } as const) : endTime ? { endTime } : null;
  if (!change) return;
  try {
    await completeProgramItem(auth.organizationId, eventId, itemId, change);
  } catch (error) {
    if (!(error instanceof ProgramGapInvalidError)) throw error;
  }
  revalidatePath(`/events/${eventId}`);
}
