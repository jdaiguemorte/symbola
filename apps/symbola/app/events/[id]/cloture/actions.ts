"use server";

// Lot 58 (PAR-09, PRE-08, EVT-08 ; D4, D5 ; ADR 0097) — gestes de la clôture d'un évènement : étapes
// cochées, évaluations, temps passé, leçons, frais propres, clôture, archivage, modèle, duplication,
// lien d'avis et envoi du remerciement relu. Contrôles côté serveur : session de la planner (jamais le
// Comptable ni un lien), organisation, module, objet ; un évènement archivé est en lecture seule.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { MailQuotaExceededError } from "@symbola/mail";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { closeEventNow, EvaluationNotAllowedError, evaluateEventVendor } from "@/lib/closing/load";
import { duplicateEvent, saveEventAsTemplate } from "@/lib/events/event-templates";
import {
  archiveEvent,
  ClosingInputError,
  ClosingSettingsError,
  EventArchivedError,
  EventNotClosableError,
  EventNotFoundError,
  EventTemplateInvalidError,
  getEvent,
  getEventClosing,
  parseHours,
  ReviewRequestError,
  saveClosingNotes,
  saveClosingSettings,
  sendReviewRequest,
  unarchiveEvent,
  type ClosingStep,
  type TemplateFinding,
} from "@/modules/events/service";
import { sendOrganizationEmail } from "@/modules/hub/service";
import { InvalidEvaluationError } from "@/modules/vendors/service";
import { isEventsModuleEnabled, isValidId } from "../../module-access";

export type ClosingFormState = { error?: string; success?: boolean; findings?: TemplateFinding[] };

type T = Awaited<ReturnType<typeof getTranslations>>;
type Access = { organizationId: string; userId: string; t: T };

async function access(): Promise<Access | { error: string }> {
  const t = await getTranslations("Closing");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("errors.unauthenticated") };
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("errors.moduleUnavailable") };
  return { organizationId: auth.user.organizationId, userId: auth.user.id, t };
}

function eventIdOf(formData: FormData): string | null {
  const eventId = String(formData.get("eventId") ?? "");
  return isValidId(eventId) ? eventId : null;
}

function refresh(eventId: string): void {
  revalidatePath(`/events/${eventId}/cloture`);
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/");
}

// Les refus connus deviennent un message ; tout autre échec remonte.
async function guarded(t: T, work: () => Promise<unknown>): Promise<ClosingFormState> {
  try {
    await work();
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("errors.notFound") };
    if (error instanceof EventArchivedError) return { error: t("errors.archived") };
    if (error instanceof EventNotClosableError) return { error: t(error.reason === "not_finished" ? "errors.notFinished" : error.reason === "demo" ? "errors.demo" : "errors.notClosable") };
    if (error instanceof ClosingInputError) return { error: t({ lessons: "errors.lessons", expenses: "errors.expenses", time_spent: "errors.timeSpent", steps: "errors.steps" }[error.field]) };
    if (error instanceof InvalidEvaluationError) return { error: t(error.field === "comment" ? "errors.comment" : "errors.rating") };
    if (error instanceof EvaluationNotAllowedError) return { error: t("errors.notRetained") };
    if (error instanceof EventTemplateInvalidError) {
      if (error.reason === "personal_data") return { findings: error.findings };
      return { error: t(error.reason === "name" ? "errors.templateName" : "errors.templateContent") };
    }
    if (error instanceof ClosingSettingsError) return { error: t(error.field === "url" ? "errors.reviewUrl" : "errors.reviewLabel") };
    if (error instanceof ReviewRequestError) {
      const key = { no_recipient: "errors.reviewNoRecipient", empty: "errors.reviewEmpty", too_long: "errors.reviewTooLong", demo: "errors.demo", placeholder: "errors.reviewPlaceholder" }[error.reason];
      return { error: t(key) };
    }
    if (error instanceof MailQuotaExceededError) return { error: t("errors.mailQuota") };
    throw error;
  }
  return { success: true };
}

export async function toggleClosingStepAction(_state: ClosingFormState, formData: FormData): Promise<ClosingFormState> {
  const allowed = await access();
  if ("error" in allowed) return allowed;
  const eventId = eventIdOf(formData);
  if (!eventId) return { error: allowed.t("errors.notFound") };
  const step = String(formData.get("step") ?? "") as ClosingStep;
  const done = formData.get("done") === "1";
  const result = await guarded(allowed.t, async () => {
    const closing = await getEventClosing(allowed.organizationId, eventId);
    if (!closing) throw new EventNotFoundError();
    const steps = new Set<string>(closing.checkedSteps);
    if (done) steps.add(step);
    else steps.delete(step);
    await saveClosingNotes(allowed.organizationId, eventId, { checkedSteps: [...steps] });
  });
  refresh(eventId);
  return result;
}

export async function saveClosingNotesAction(_state: ClosingFormState, formData: FormData): Promise<ClosingFormState> {
  const allowed = await access();
  if ("error" in allowed) return allowed;
  const eventId = eventIdOf(formData);
  if (!eventId) return { error: allowed.t("errors.notFound") };
  const result = await guarded(allowed.t, async () => {
    const timeSpentMinutes = parseHours(String(formData.get("timeSpent") ?? ""));
    const lessons = formData.getAll("lessons").map((value) => String(value));
    await saveClosingNotes(allowed.organizationId, eventId, { timeSpentMinutes, lessons });
  });
  refresh(eventId);
  return result;
}

// Montant saisi en euros (« 120,50 ») : centimes entiers, jamais de flottant.
function parseEuros(value: string): number {
  const text = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(text)) return Number.NaN;
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export async function addOwnExpenseAction(_state: ClosingFormState, formData: FormData): Promise<ClosingFormState> {
  const allowed = await access();
  if ("error" in allowed) return allowed;
  const eventId = eventIdOf(formData);
  if (!eventId) return { error: allowed.t("errors.notFound") };
  const result = await guarded(allowed.t, async () => {
    const closing = await getEventClosing(allowed.organizationId, eventId);
    if (!closing) throw new EventNotFoundError();
    const expense = { label: String(formData.get("expenseLabel") ?? ""), amountCents: parseEuros(String(formData.get("expenseAmount") ?? "")) };
    await saveClosingNotes(allowed.organizationId, eventId, { ownExpenses: [...closing.ownExpenses, expense] });
  });
  refresh(eventId);
  return result;
}

export async function removeOwnExpenseAction(formData: FormData): Promise<void> {
  const allowed = await access();
  if ("error" in allowed) return;
  const eventId = eventIdOf(formData);
  const index = Number(formData.get("index"));
  if (!eventId || !Number.isInteger(index)) return;
  await guarded(allowed.t, async () => {
    const closing = await getEventClosing(allowed.organizationId, eventId);
    if (!closing) throw new EventNotFoundError();
    await saveClosingNotes(allowed.organizationId, eventId, { ownExpenses: closing.ownExpenses.filter((_, position) => position !== index) });
  });
  refresh(eventId);
}

function score(formData: FormData, name: string): number | null {
  const value = String(formData.get(name) ?? "");
  return value === "" ? null : Number(value);
}

export async function evaluateVendorAction(_state: ClosingFormState, formData: FormData): Promise<ClosingFormState> {
  const allowed = await access();
  if ("error" in allowed) return allowed;
  const eventId = eventIdOf(formData);
  const vendorId = String(formData.get("vendorId") ?? "");
  if (!eventId || !isValidId(vendorId)) return { error: allowed.t("errors.notRetained") };
  const result = await guarded(allowed.t, () =>
    evaluateEventVendor(allowed.organizationId, {
      eventId,
      vendorId,
      userId: allowed.userId,
      rating: score(formData, "rating") ?? 0,
      punctuality: score(formData, "punctuality"),
      quality: score(formData, "quality"),
      value: score(formData, "value"),
      comment: String(formData.get("comment") ?? ""),
    }),
  );
  refresh(eventId);
  revalidatePath(`/prestataires/${vendorId}`);
  return result;
}

export async function closeEventAction(_state: ClosingFormState, formData: FormData): Promise<ClosingFormState> {
  const allowed = await access();
  if ("error" in allowed) return allowed;
  const eventId = eventIdOf(formData);
  if (!eventId) return { error: allowed.t("errors.notFound") };
  const result = await guarded(allowed.t, () => closeEventNow(allowed.organizationId, eventId, allowed.userId));
  refresh(eventId);
  return result;
}

export async function archiveEventAction(_state: ClosingFormState, formData: FormData): Promise<ClosingFormState> {
  const allowed = await access();
  if ("error" in allowed) return allowed;
  const eventId = eventIdOf(formData);
  if (!eventId) return { error: allowed.t("errors.notFound") };
  const unarchive = formData.get("unarchive") === "1";
  const result = await guarded(allowed.t, () => (unarchive ? unarchiveEvent : archiveEvent)({ organizationId: allowed.organizationId, eventId, userId: allowed.userId }));
  refresh(eventId);
  return result;
}

export async function saveTemplateAction(_state: ClosingFormState, formData: FormData): Promise<ClosingFormState> {
  const allowed = await access();
  if ("error" in allowed) return allowed;
  const eventId = eventIdOf(formData);
  if (!eventId) return { error: allowed.t("errors.notFound") };
  const result = await guarded(allowed.t, () => saveEventAsTemplate(allowed.organizationId, eventId, { name: String(formData.get("name") ?? ""), includeVendors: formData.get("includeVendors") === "1" }));
  revalidatePath("/events/modeles-evenement");
  return result;
}

export async function duplicateEventAction(_state: ClosingFormState, formData: FormData): Promise<ClosingFormState> {
  const allowed = await access();
  if ("error" in allowed) return allowed;
  const eventId = eventIdOf(formData);
  if (!eventId) return { error: allowed.t("errors.notFound") };
  const eventDate = String(formData.get("eventDate") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return { error: allowed.t("errors.date") };
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const created: { id: string | null } = { id: null };
  const result = await guarded(allowed.t, async () => {
    created.id = await duplicateEvent(allowed.organizationId, eventId, { eventDate, userId: allowed.userId, locale, includeVendors: formData.get("includeVendors") === "1" });
  });
  if (!created.id) return result;
  revalidatePath("/events");
  redirect(`/events/${created.id}`);
}

export async function saveReviewLinkAction(_state: ClosingFormState, formData: FormData): Promise<ClosingFormState> {
  const allowed = await access();
  if ("error" in allowed) return allowed;
  const eventId = eventIdOf(formData);
  const result = await guarded(allowed.t, () => saveClosingSettings(allowed.organizationId, { reviewUrl: String(formData.get("reviewUrl") ?? ""), reviewLabel: String(formData.get("reviewLabel") ?? "") }));
  if (eventId) revalidatePath(`/events/${eventId}/cloture/avis`);
  return result;
}

// Le texte relu et modifié par la planner part tel quel, de Symbola, à chaque client qui a une adresse ;
// les destinataires sont relus côté serveur (getEvent), jamais pris du formulaire.
export async function sendReviewRequestAction(_state: ClosingFormState, formData: FormData): Promise<ClosingFormState> {
  const allowed = await access();
  if ("error" in allowed) return allowed;
  const eventId = eventIdOf(formData);
  if (!eventId) return { error: allowed.t("errors.notFound") };
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const result = await guarded(allowed.t, async () => {
    const event = await getEvent(allowed.organizationId, eventId);
    if (!event) throw new EventNotFoundError();
    const recipients = event.clients.filter((client) => client.email && client.contactId).map((client) => ({ contactId: client.contactId!, firstName: client.firstName, email: client.email! }));
    await sendReviewRequest({
      organizationId: allowed.organizationId,
      eventId,
      recipients,
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
      withReview: formData.get("withReview") === "1",
      sendMail: async (recipient, text) => {
        await sendOrganizationEmail({ organizationId: allowed.organizationId, to: recipient.email, kind: "prospect_reply", locale, values: {}, template: text });
      },
    });
  });
  refresh(eventId);
  return result;
}
