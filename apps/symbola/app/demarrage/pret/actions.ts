"use server";

// Lot 33b (HUB-10, PAR-01 ; D10) — les deux chemins de « Votre espace est prêt » :
// - « Créer mon premier évènement » : prénoms des clients, date, type ; l'évènement est confirmé,
//   son rétroplanning et ses postes de budget naissent avec lui (lot 34a, EVT-01) ;
// - « Explorer avec un exemple » : le mariage de référence en données fictives (30 jours).
// Contrôles côté serveur : session de l'équipe, organisation, module Évènements.
import { redirect } from "next/navigation";
import { discardMyFormDraft } from "@/lib/form-drafts";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import {
  changeEventStatus,
  countOrganizationRealEvents,
  createProspect,
  getActiveEventsTrial,
  listEventTypes,
  listProspectSources,
  startExampleEvent, createTypedDocumentFolders, listTaskTemplates } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { eventsMessageFor } from "@/lib/vocabulary";
import { isEventsModuleEnabled } from "@/app/events/module-access";

export type FirstEventFormState = { error?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

async function team() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

export async function createFirstEventAction(_prev: FirstEventFormState, formData: FormData): Promise<FirstEventFormState> {
  const t = await getTranslations("Onboarding");
  const tEvents = await getTranslations("Events");
  const access = await team();
  if (!access) return { error: tEvents("moduleUnavailable") };
  const eventType = (await listEventTypes(access.organizationId)).find((type) => type.id === text(formData, "eventTypeId"));
  if (!eventType) return { error: tEvents("missingEventType") };
  const firstName1 = text(formData, "firstName1").slice(0, 120);
  const firstName2 = text(formData, "firstName2").slice(0, 120);
  if (!firstName1) return { error: eventsMessageFor((await getLocale()) as Locale, eventType.audience, "missingFirstName") };
  const eventDate = text(formData, "eventDate");
  if (!DATE.test(eventDate)) return { error: t("ready.dateRequired") };
  // La source est demandée à chaque prospect : au démarrage, la première de la liste de départ.
  const [source] = await listProspectSources(access.organizationId);
  if (!source) return { error: t("ready.noSource") };

  // Lot 63c (ADR 0106) : le rétroplanning choisi (case cochée), seulement s'il est celui du type.
  const chosen = formData.get("applyTaskTemplate") === "1" ? text(formData, "taskTemplateId") : "";
  const taskTemplateId = chosen && (await listTaskTemplates(access.organizationId)).some((template) => template.id === chosen && template.eventTypeId === eventType.id) ? chosen : null;
  const clients = [{ firstName: firstName1, lastName: null }, ...(firstName2 ? [{ firstName: firstName2, lastName: null }] : [])];
  const created = await createProspect({
    organizationId: access.organizationId,
    createdByUserId: access.userId,
    clients,
    prospectSourceId: source.id,
    eventTypeId: eventType.id,
    eventDate,
    venueName: null,
    venueCity: null,
    taskTemplateId,
  });
  // Lot 63c (DOC-01) : les dossiers proposés à chaque évènement.
  await createTypedDocumentFolders(access.organizationId, created.id, (await getLocale()) === "en" ? "en" : "fr");
  await changeEventStatus({ organizationId: access.organizationId, eventId: created.id, changedByUserId: access.userId, toStatus: "confirmed" });

  // HUB-10 : au premier évènement réel, la suppression de l'exemple est proposée.
  const example = await getActiveEventsTrial(access.organizationId);
  const first = (await countOrganizationRealEvents(access.organizationId)) === 1;
  // Lot 39b (UX-09) : l'évènement est créé, le brouillon de la saisie n'a plus lieu d'être.
  await discardMyFormDraft("event-first");
  redirect(`/events/${created.id}${example && first ? "?exemple=proposer" : ""}`);
}

export async function exploreExampleAction(): Promise<void> {
  const access = await team();
  if (!access) redirect("/");
  const example = await startExampleEvent({
    organizationId: access.organizationId,
    userId: access.userId,
    locale: (await getLocale()) === "en" ? "en" : "fr",
  });
  redirect(`/events/${example.eventId}`);
}
