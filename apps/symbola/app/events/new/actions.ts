"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { unexpectedActionError } from "@/lib/action-errors";
import { discardMyFormDraft } from "@/lib/form-drafts";
import { getLocale, getTranslations } from "next-intl/server";
import type { EventClientInput } from "@symbola/contracts";
import type { Locale } from "@symbola/i18n";
import { ContactNotFoundError } from "@/modules/hub/service";
import { makeCreatorLead, changeEventStatus, countOrganizationRealEvents, createProspect, getActiveEventsTrial, listEventTypes, listProspectSources, listTaskTemplates, createTaskTemplate, createTypedDocumentFolders, TaskTemplateNotFoundError } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { eventsMessageFor } from "@/lib/vocabulary";
import { isEventsModuleEnabled } from "../module-access";
import { isConfirmedChoice, NEW_EVENT_MODES, newEventRules, type NewEventMode } from "./new-event-mode";

export type NewProspectFormState = { error?: string };

export async function createProspectAction(
  _prevState: NewProspectFormState,
  formData: FormData,
): Promise<NewProspectFormState> {
  const t = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return { error: t("moduleUnavailable") };

  // Lot 36a (UX-02) : un contact existant choisi, ou un nom saisi (un nouveau contact).
  const contactIdOf = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
  };
  const contactId1 = contactIdOf("contactId1");
  const contactId2 = contactIdOf("contactId2");
  const firstName1 = String(formData.get("firstName1") ?? "").trim();
  const lastName1 = String(formData.get("lastName1") ?? "").trim();
  const firstName2 = String(formData.get("firstName2") ?? "").trim();
  const lastName2 = String(formData.get("lastName2") ?? "").trim();
  const prospectSourceId = String(formData.get("prospectSourceId") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "").trim();
  const venueName = String(formData.get("venueName") ?? "").trim();
  const venueCity = String(formData.get("venueCity") ?? "").trim();
  // Lot 16 (ADR 0045) : un type de l'organisation ; il dit aussi comment parler des clients.
  const eventTypeId = String(formData.get("eventTypeId") ?? "").trim();
  const eventType = (await listEventTypes(organizationId)).find((type) => type.id === eventTypeId);
  if (!eventType) return { error: t("missingEventType") };

  // Lot 63c (EVT-01, M7) : le choix du bouton « Nouveau » dit ce qui est obligatoire.
  const rawMode = String(formData.get("mode") ?? "");
  const mode: NewEventMode = (NEW_EVENT_MODES as readonly string[]).includes(rawMode) ? (rawMode as NewEventMode) : formData.get("confirmed") === "1" ? "confirmed" : "prospect";
  const confirmed = isConfirmedChoice(mode, String(formData.get("status") ?? ""));
  const rules = newEventRules(mode, confirmed);
  if (rules.existingContactOnly && !contactId1) return { error: t("missingExistingContact") };
  if (rules.clientRequired && !firstName1 && !contactId1) return { error: eventsMessageFor((await getLocale()) as Locale, eventType.audience, "missingFirstName") };
  if (rules.sourceRequired && !prospectSourceId) return { error: t("missingSource") };

  const sources = await listProspectSources(organizationId);
  if (prospectSourceId && !sources.some((source) => source.id === prospectSourceId)) return { error: t("missingSource") };

  // Lot 63c (ADR 0106) : le rétroplanning choisi (case cochée), seulement s'il est celui du type.
  const taskTemplateId = formData.get("applyTaskTemplate") === "1" ? String(formData.get("taskTemplateId") ?? "").trim() : "";
  if (taskTemplateId && !(await listTaskTemplates(organizationId)).some((template) => template.id === taskTemplateId && template.eventTypeId === eventType.id)) {
    return { error: t("taskTemplateUnavailable") };
  }

  const clients: EventClientInput[] = [];
  if (contactId1) clients.push({ contactId: contactId1, firstName: "" });
  else if (firstName1) clients.push({ firstName: firstName1, lastName: lastName1 || null });
  if (contactId2) clients.push({ contactId: contactId2, firstName: "" });
  else if (firstName2) clients.push({ firstName: firstName2, lastName: lastName2 || null });

  let result: { id: string };
  try {
    result = await createProspect({
      organizationId,
      createdByUserId: auth.user.id,
      clients,
      prospectSourceId: prospectSourceId || null,
      eventTypeId: eventType.id,
      eventDate: eventDate || null,
      venueName: venueName || null,
      venueCity: venueCity || null,
      taskTemplateId: taskTemplateId && eventDate ? taskTemplateId : null,
    });
  } catch (error) {
    if (error instanceof TaskTemplateNotFoundError) return { error: t("taskTemplateUnavailable") };
    // Un contact choisi qui n'existe pas (ou plus) dans l'organisation.
    if (error instanceof ContactNotFoundError) return { error: (await getTranslations("Contacts"))("notFound") };
    return { error: await unexpectedActionError(error) };
  }

  // Lot 52 (EVT-06, D2) : la personne qui crée l'évènement en est le planner principal.
  await makeCreatorLead(organizationId, result.id, auth.user.id);
  // Lot 63c (DOC-01, M8) : les dossiers proposés à chaque évènement, tirés du fichier de données.
  await createTypedDocumentFolders(organizationId, result.id, (await getLocale()) === "en" ? "en" : "fr");

  // L12-HUB-13 : « Créer un événement » depuis l'agenda = confirmé d'emblée ; lot 63c : aussi
  // « Évènement confirmé » du bouton « Nouveau », et un client existant dont c'est le choix.
  if (confirmed) {
    await changeEventStatus({ organizationId, eventId: result.id, changedByUserId: auth.user.id, toStatus: "confirmed" });
  }

  // Lot 33b (HUB-10, D10) : au premier évènement réel, la suppression de l'exemple est proposée.
  const example = await getActiveEventsTrial(organizationId);
  const first = example ? (await countOrganizationRealEvents(organizationId)) === 1 : false;
  // Lot 39b (UX-09) : l'évènement est créé, le brouillon de la saisie n'a plus lieu d'être.
  await discardMyFormDraft("event-new");
  redirect(`/events/${result.id}${first ? "?exemple=proposer" : ""}`);
}

// Lot 63c (EVT-01, HUB-21 ; ADR 0106, M7) — « Créer un modèle pour « <type> » », dans un panneau, sans
// quitter le formulaire : un modèle rattaché au type, ses tâches comptées en jours avant la date.
const quickTemplateSchema = z.object({
  eventTypeId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  items: z
    .array(z.object({ label: z.string().trim().min(1).max(200), daysBefore: z.number().int().min(-1095).max(1095) }))
    .min(1)
    .max(60),
});

export type QuickTemplateResult = { ok: true; template: { id: string; name: string; eventTypeId: string; items: { label: string; offsetDays: number }[] } } | { ok: false; error: string };

export async function createTypedTaskTemplateAction(input: unknown): Promise<QuickTemplateResult> {
  const t = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { ok: false, error: t("unauthenticated") };
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return { ok: false, error: t("moduleUnavailable") };
  const parsed = quickTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("quickTemplateInvalid") };
  // Le type est celui de l'organisation (sinon refus, sans dire s'il existe ailleurs).
  if (!(await listEventTypes(organizationId)).some((type) => type.id === parsed.data.eventTypeId)) return { ok: false, error: t("missingEventType") };
  try {
    const template = await createTaskTemplate(
      organizationId,
      parsed.data.name,
      parsed.data.items.map((item) => ({ label: item.label, offsetDays: -item.daysBefore, responsible: "planner" as const })),
      parsed.data.eventTypeId,
    );
    return { ok: true, template: { id: template.id, name: template.name, eventTypeId: parsed.data.eventTypeId, items: template.items.map((item) => ({ label: item.label, offsetDays: item.offsetDays })) } };
  } catch (error) {
    return { ok: false, error: await unexpectedActionError(error) };
  }
}
