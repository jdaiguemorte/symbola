"use server";

// Lot 45 (CRM-05, CRM-06 ; D1 à D3 ; ADR 0090) — « Écrire au client » : envoyer depuis Symbola le
// message relu et modifié, ou le préparer pour la messagerie de la planner (« préparé », mailto) ;
// noter « a répondu » ou « ne plus relancer ». Contrôlé côté serveur à chaque appel : session,
// organisation, module Évènements ouvert ; l'évènement est de l'organisation (RLS) et les
// destinataires sont des clients de l'évènement avec une adresse.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { EmailVariableMissingError } from "@/modules/hub/service";
import { MailQuotaExceededError } from "@symbola/mail";
import { noteProspectAnswered, ProspectMessageInvalidError, prospectMessageContext, sendProspectMessage, stopProspectFollowUps } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { bookingPageUrl } from "@/lib/prospect-follow-ups";
import { isEventsModuleEnabled, isValidId } from "../../module-access";

type Access = { organizationId: string; userId: string };

async function plannerAccess(): Promise<Access | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

const draftSchema = z.object({
  eventId: z.string(),
  templateId: z.string().optional().nullable(),
  contactIds: z.array(z.string()).max(20),
  subject: z.string().max(2000),
  body: z.string().max(20_000),
  locale: z.enum(["fr", "en"]),
});

// Lot 65d (ADR 0110) : preparedIds, les messages préparés quand la planner envoie de sa messagerie ; la
// fenêtre « Préparer l'e-mail » les ouvre (un par destinataire).
export type WriteResult = { ok: true; message: string; mailto?: string; preparedIds?: string[] } | { ok: false; error: string };

function mailtoHref(emails: string[], subject: string, body: string): string {
  const query = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;
  return `mailto:${emails.map(encodeURIComponent).join(",")}?${query}`;
}

async function deliver(raw: unknown, delivery: "sent" | "prepared"): Promise<WriteResult> {
  const t = await getTranslations("WriteToClient");
  const access = await plannerAccess();
  const parsed = draftSchema.safeParse(raw);
  if (!access || !parsed.success || !isValidId(parsed.data.eventId)) return { ok: false, error: t("refused") };
  const input = parsed.data;
  const context = await prospectMessageContext({ organizationId: access.organizationId, eventId: input.eventId, locale: input.locale, contactIds: input.contactIds.filter(isValidId), bookingUrl: await bookingPageUrl(access.organizationId) });
  if (!context) return { ok: false, error: t("refused") };
  if (context.recipients.length === 0) return { ok: false, error: t("noRecipient") };
  try {
    const result = await sendProspectMessage({
      organizationId: access.organizationId,
      eventId: input.eventId,
      recipients: context.recipients,
      templateId: input.templateId && isValidId(input.templateId) ? input.templateId : null,
      subject: input.subject,
      body: input.body,
      userId: access.userId,
      locale: input.locale,
      delivery,
      values: context.values,
    });
    revalidatePath(`/events/${input.eventId}`);
    revalidatePath("/events/pipeline");
    revalidatePath("/");
    if (result.preparedIds.length > 0) return { ok: true, message: t("prepared"), preparedIds: result.preparedIds };
    if (delivery === "prepared") return { ok: true, message: t("prepared"), mailto: mailtoHref(context.recipients.map((recipient) => recipient.email), result.subject, result.body) };
    return { ok: true, message: result.deferred ? t("sentDeferred") : t("sent", { count: context.recipients.length }) };
  } catch (error) {
    if (error instanceof ProspectMessageInvalidError) {
      if (error.reason === "missing") return { ok: false, error: t("missing", { tokens: ((error as ProspectMessageInvalidError & { tokens?: string[] }).tokens ?? []).join(", ") }) };
      if (error.reason === "no_brochure") return { ok: false, error: t("noBrochure") };
      if (error.reason === "empty") return { ok: false, error: t("empty") };
      if (error.reason === "too_long") return { ok: false, error: t("tooLong") };
      return { ok: false, error: t("refused") };
    }
    if (error instanceof EmailVariableMissingError) return { ok: false, error: t("missing", { tokens: error.tokens.join(", ") }) };
    if (error instanceof MailQuotaExceededError) return { ok: false, error: t("quota") };
    throw error;
  }
}

export async function sendFromSymbolaAction(raw: unknown): Promise<WriteResult> {
  return deliver(raw, "sent");
}

export async function prepareForMailAction(raw: unknown): Promise<WriteResult> {
  return deliver(raw, "prepared");
}

// D3 — « a répondu » et « ne plus relancer », d'un geste (fiche, pipeline, « Aujourd'hui »).
export async function noteAnsweredAction(eventId: string): Promise<boolean> {
  const access = await plannerAccess();
  if (!access || !isValidId(eventId)) return false;
  try {
    await noteProspectAnswered({ organizationId: access.organizationId, eventId, userId: access.userId });
  } catch (error) {
    if (error instanceof ProspectMessageInvalidError) return false;
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events/pipeline");
  revalidatePath("/");
  return true;
}

export async function stopFollowUpsAction(eventId: string): Promise<boolean> {
  const access = await plannerAccess();
  if (!access || !isValidId(eventId)) return false;
  try {
    await stopProspectFollowUps({ organizationId: access.organizationId, eventId, userId: access.userId });
  } catch (error) {
    if (error instanceof ProspectMessageInvalidError) return false;
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/");
  return true;
}
