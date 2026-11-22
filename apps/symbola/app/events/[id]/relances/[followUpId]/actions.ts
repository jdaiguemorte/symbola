"use server";

// Lot 45 (CRM-06 ; D2, D3 ; ADR 0090) — envoyer une relance relue (et peut-être modifiée) ou la retirer.
// Les faits qui l'arrêtent sont revérifiés juste avant l'envoi (critère CRM-06). Contrôlé côté serveur
// à chaque appel : session, organisation, module Évènements ouvert ; la relance est de l'organisation
// (RLS) et de cet évènement.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { MailQuotaExceededError } from "@symbola/mail";
import { getProspectFollowUp, ProspectMessageInvalidError, withdrawProspectFollowUp } from "@/modules/events/service";
import { EmailVariableMissingError } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { sendFollowUpNow } from "@/lib/prospect-follow-ups";
import { isEventsModuleEnabled, isValidId } from "../../../module-access";

// Lot 65d (ADR 0110) : preparedIds, la relance préparée pour la messagerie de la planner.
export type FollowUpResult = { ok: true; message: string; preparedIds?: string[] } | { ok: false; error: string };

const schema = z.object({ eventId: z.string(), followUpId: z.string(), subject: z.string().max(2000), body: z.string().max(20_000) });

async function access() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

function refresh(eventId: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/");
}

export async function sendFollowUpAction(raw: unknown): Promise<FollowUpResult> {
  const t = await getTranslations("FollowUpReview");
  const who = await access();
  const parsed = schema.safeParse(raw);
  if (!who || !parsed.success || !isValidId(parsed.data.eventId) || !isValidId(parsed.data.followUpId)) return { ok: false, error: t("refused") };
  const followUp = await getProspectFollowUp(who.organizationId, parsed.data.followUpId);
  if (!followUp || followUp.eventId !== parsed.data.eventId) return { ok: false, error: t("refused") };
  try {
    const outcome = await sendFollowUpNow({ organizationId: who.organizationId, eventId: parsed.data.eventId, followUpId: parsed.data.followUpId, userId: who.userId, locale: (await getLocale()) === "en" ? "en" : "fr", subject: parsed.data.subject, body: parsed.data.body });
    refresh(parsed.data.eventId);
    if (outcome.status === "sent" && outcome.preparedIds && outcome.preparedIds.length > 0) return { ok: true, message: t("prepared"), preparedIds: outcome.preparedIds };
    if (outcome.status === "sent") return { ok: true, message: outcome.deferred ? t("sentDeferred") : t("sent") };
    if (outcome.status === "already") return { ok: false, error: t("already") };
    return { ok: false, error: t(`stopped.${outcome.reason}`) };
  } catch (error) {
    if (error instanceof ProspectMessageInvalidError) return { ok: false, error: t(error.reason === "missing" ? "missing" : error.reason === "no_brochure" ? "noBrochure" : error.reason === "empty" ? "empty" : "refused") };
    if (error instanceof EmailVariableMissingError) return { ok: false, error: t("missing") };
    if (error instanceof MailQuotaExceededError) return { ok: false, error: t("quota") };
    throw error;
  }
}

export async function withdrawFollowUpAction(eventId: string, followUpId: string): Promise<FollowUpResult> {
  const t = await getTranslations("FollowUpReview");
  const who = await access();
  if (!who || !isValidId(eventId) || !isValidId(followUpId)) return { ok: false, error: t("refused") };
  const followUp = await getProspectFollowUp(who.organizationId, followUpId);
  if (!followUp || followUp.eventId !== eventId) return { ok: false, error: t("refused") };
  try {
    await withdrawProspectFollowUp(who.organizationId, followUpId);
  } catch (error) {
    if (error instanceof ProspectMessageInvalidError) return { ok: false, error: t("refused") };
    throw error;
  }
  refresh(eventId);
  return { ok: true, message: t("withdrawn") };
}
