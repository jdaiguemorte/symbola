"use server";

// Lot 26a (UX-11, POR-01, POR-10, SEC-14, SEC-15 ; ADR 0053) — liens personnels
// des tiers, depuis la fiche de l'événement : créer (profil de départ), modifier
// les droits, renouveler, retirer. Le lien n'est montré qu'une fois (D10).
// Lot 26b : lien d'un prestataire retenu (D9), code demandé à l'ouverture (D6).
import { MailQuotaExceededError } from "@symbola/mail";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import {
  createEventLink,
  DemoEventRestrictionError,
  EventLinkInvalidError,
  EventLinkNotFoundError,
  EventNotFoundError,
  listLinkProfiles,
  renewEventLink,
  revokeEventLink,
  updateEventLink,
  type EventLinkRights,
  type LinkRubric,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { requestAudience } from "@/lib/vocabulary";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type LinkFormState = { error?: string; success?: boolean; url?: string; email?: string; name?: string; renewed?: boolean };

type Translate = Awaited<ReturnType<typeof getTranslations>>;

async function authorize(t: Translate) {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") } as const;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") } as const;
  return { userId: auth.user.id, organizationId: auth.user.organizationId } as const;
}

async function locale(): Promise<"fr" | "en"> {
  return (await getLocale()) === "en" ? "en" : "fr";
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function ids(formData: FormData, name: string): string[] {
  return formData.getAll(name).map(String).filter(isValidId);
}

function errorMessage(error: unknown, t: Translate): string | null {
  if (error instanceof EventNotFoundError) return t("eventNotFound");
  if (error instanceof EventLinkNotFoundError) return t("linkNotFound");
  if (error instanceof DemoEventRestrictionError) return t("trialNoInvite");
  // Lot 24b (SEC-22) : plafond d'envois de l'heure atteint.
  if (error instanceof MailQuotaExceededError) return t("mailQuotaReached", { minutes: Math.max(1, Math.ceil(error.retryAfterSeconds / 60)) });
  if (error instanceof EventLinkInvalidError) {
    if (error.reason === "name") return t("linkInvalidName");
    if (error.reason === "email") return t("invalidEmail");
    if (error.reason === "expiry") return t("linkInvalidExpiry");
    return t("linkInvalidChoice");
  }
  return null;
}

export async function createLinkAction(_prev: LinkFormState, formData: FormData): Promise<LinkFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = text(formData, "eventId");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const vocabulary = await requestAudience(access.organizationId);
  const vendor = text(formData, "audience") === "vendor";
  const vendorCandidateId = text(formData, "vendorCandidateId");
  if (vendor && !isValidId(vendorCandidateId)) return { error: t("linkInvalidChoice") };
  // Le profil ne fait que pré-cocher les rubriques (décision D3) ; un lien de
  // prestataire n'en a pas (son espace est fixe, D9).
  const profile = vendor ? null : listLinkProfiles(await locale(), vocabulary).find((candidate) => candidate.key === text(formData, "profile"));
  if (!vendor && !profile) return { error: t("linkInvalidChoice") };
  const eventClientId = text(formData, "eventClientId");
  try {
    const delivery = await createEventLink({
      organizationId: access.organizationId,
      eventId,
      createdByUserId: access.userId,
      audience: vendor ? "vendor" : "client",
      vendorCandidateId: vendor ? vendorCandidateId : null,
      locale: await locale(),
      vocabulary,
      link: {
        personName: text(formData, "personName"),
        email: text(formData, "email"),
        eventClientId: !vendor && isValidId(eventClientId) ? eventClientId : null,
        rights: profile ? { rubrics: profile.rubrics, budgetScope: profile.budgetScope, sharedSlotIds: ids(formData, "sharedSlotIds") } : { rubrics: [], budgetScope: "all", sharedSlotIds: [] },
        customExpiresOn: text(formData, "customExpiresOn") || null,
        otpRequired: formData.get("otpRequired") === "on",
        // Lot 27a (CHR-04, D7) : rappels des tâches, pour un lien de client.
        taskReminders: !vendor && formData.get("taskReminders") === "on",
      },
    });
    revalidatePath(`/events/${eventId}`);
    return { success: true, url: delivery.url, email: delivery.link.email, name: delivery.link.personName };
  } catch (error) {
    const message = errorMessage(error, t);
    if (message) return { error: message };
    throw error;
  }
}

export async function updateLinkAction(_prev: LinkFormState, formData: FormData): Promise<LinkFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = text(formData, "eventId");
  const linkId = text(formData, "linkId");
  if (!isValidId(eventId) || !isValidId(linkId)) return { error: t("linkNotFound") };
  const eventClientId = text(formData, "eventClientId");
  const rights: EventLinkRights = {
    rubrics: formData.getAll("rubrics").map(String) as LinkRubric[],
    budgetScope: text(formData, "budgetScope") === "selected" ? "selected" : "all",
    sharedSlotIds: ids(formData, "sharedSlotIds"),
  };
  try {
    await updateEventLink(access.organizationId, linkId, {
      personName: text(formData, "personName"),
      email: text(formData, "email"),
      eventClientId: isValidId(eventClientId) ? eventClientId : null,
      rights,
      customExpiresOn: text(formData, "customExpiresOn") || null,
      otpRequired: formData.get("otpRequired") === "on",
      taskReminders: formData.get("taskReminders") === "on",
    });
    revalidatePath(`/events/${eventId}`);
    return { success: true };
  } catch (error) {
    const message = errorMessage(error, t);
    if (message) return { error: message };
    throw error;
  }
}

export async function renewLinkAction(_prev: LinkFormState, formData: FormData): Promise<LinkFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = text(formData, "eventId");
  const linkId = text(formData, "linkId");
  if (!isValidId(eventId) || !isValidId(linkId)) return { error: t("linkNotFound") };
  try {
    const delivery = await renewEventLink({
      organizationId: access.organizationId,
      linkId,
      renewedByUserId: access.userId,
      locale: await locale(),
      vocabulary: await requestAudience(access.organizationId),
    });
    revalidatePath(`/events/${eventId}`);
    return { success: true, renewed: true, url: delivery.url, email: delivery.link.email, name: delivery.link.personName };
  } catch (error) {
    const message = errorMessage(error, t);
    if (message) return { error: message };
    throw error;
  }
}

export async function revokeLinkAction(formData: FormData): Promise<void> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return;
  const eventId = text(formData, "eventId");
  const linkId = text(formData, "linkId");
  if (!isValidId(eventId) || !isValidId(linkId)) return;
  await revokeEventLink(access.organizationId, linkId);
  revalidatePath(`/events/${eventId}`);
}
