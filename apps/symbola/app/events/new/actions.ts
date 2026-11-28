"use server";

import { unexpectedActionError } from "@/lib/action-errors";
import { discardMyFormDraft } from "@/lib/form-drafts";
import { getLocale, getTranslations } from "next-intl/server";
import type { EventClientInput } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { ContactNotFoundError, isModuleEnabled } from "@/modules/hub/service";
import { makeCreatorLead, changeEventStatus, countOrganizationRealEvents, createProspect, getActiveEventsTrial, listEventTypes, listTaskTemplates, createTypedDocumentFolders, TaskTemplateNotFoundError, TemplatePastDueInvalidError } from "@/modules/events/service";
import { templateDueDate, type PastDueAnswers } from "@symbola/contracts";
import { readPastDueAnswers } from "./past-due-form";
import { parisToday } from "@symbola/i18n";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";
import { fieldErrors, formValues, translatedFieldErrors } from "@/lib/forms/field-validation";
import { newEventFieldsSchema } from "@/lib/forms/new-event-fields";
import { parseStanding, statusForStanding } from "./new-event-standing";

// Lot 70b (UX-10) : `fieldErrors`, les erreurs de saisie traduites, sous les champs. Lot 70e : `created`,
// l'évènement créé, que l'écran ouvre en disant ce qu'il contient (le message de retour).
// Lot 74b (B7) : `pastDue`, ce que l'étape des échéances passées a donné (faites, redatées, à dater).
export type NewEventFormState = { error?: string; fieldErrors?: Record<string, string>; created?: { id: string; href: string; tasks: number; budget: boolean; pastDue?: { done: number; todo: number; undated: number } } };


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function pastDueSummary(items: { id: string; offsetDays: number }[], eventDate: string, pastDue: PastDueAnswers): { done: number; todo: number; undated: number } | undefined {
  const today = parisToday();
  const past = items.filter((item) => templateDueDate(eventDate, item.offsetDays) < today);
  if (past.length === 0) return undefined;
  const done = past.filter((item) => pastDue.answers[item.id] === "done").length;
  const todo = pastDue.spread === "undated" ? 0 : past.filter((item) => pastDue.answers[item.id] === "todo").length;
  return { done, todo, undated: past.length - done - todo };
}

// Lot 70e (EVT-01, EVT-05, PAR-01 ; D8, M13, A10, A13, A14) — « Nouvel évènement », une seule forme :
// la réponse à « Où en est-il ? » donne le statut (Option ou Confirmé), le nom est demandé, le reste est
// facultatif. Un évènement signé reçoit la liste de tâches de son type, si l'organisation en a une et si
// la date est fixée (comme l'ancien « Évènement confirmé », case cochée d'office).
export async function createEventAction(_prevState: NewEventFormState, formData: FormData): Promise<NewEventFormState> {
  const t = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return { error: t("moduleUnavailable") };

  // Lot 70b (UX-10) : le même schéma qu'à l'écran ; les erreurs vont sous les champs.
  const invalid = fieldErrors(newEventFieldsSchema, formValues(formData));
  if (invalid.length > 0) {
    const tValidation = await getTranslations("Validation");
    return { fieldErrors: translatedFieldErrors(invalid, (key) => tValidation(key)) };
  }
  const standing = parseStanding(String(formData.get("standing") ?? ""))!;
  const confirmed = statusForStanding(standing) === "confirmed";
  const name = String(formData.get("name") ?? "").trim().slice(0, 200);
  const eventDate = String(formData.get("eventDate") ?? "").trim();
  if (eventDate && !DATE.test(eventDate)) return { error: t("invalidDate") };

  // Lot 16 (ADR 0045) : un type de l'organisation ; il dit aussi comment parler des clients. Sans choix
  // (un seul type, pas de liste), le premier est pris (A13).
  const eventTypes = await listEventTypes(organizationId);
  const eventTypeId = String(formData.get("eventTypeId") ?? "").trim();
  const eventType = eventTypes.find((type) => type.id === eventTypeId) ?? (eventTypeId === "" && eventTypes.length === 1 ? eventTypes[0] : undefined);
  if (!eventType) return { error: t("missingEventType") };

  // Lot 36a (UX-02) : un contact existant choisi, ou un nom saisi (un nouveau contact) ; facultatif.
  const contactIdRaw = String(formData.get("contactId1") ?? "").trim();
  const contactId1 = UUID.test(contactIdRaw) ? contactIdRaw : null;
  const firstName1 = String(formData.get("firstName1") ?? "").trim();
  const lastName1 = String(formData.get("lastName1") ?? "").trim();
  const clients: EventClientInput[] = [];
  if (contactId1) clients.push({ contactId: contactId1, firstName: "" });
  else if (firstName1) clients.push({ firstName: firstName1, lastName: lastName1 || null });

  // Lot 63c (ADR 0106) : le modèle du type, posé d'emblée pour un évènement signé, daté. Lot 74b (C-67) :
  // « Changer » en choisit un autre (`template`, un modèle de l'organisation) ou aucun (« none »).
  const templateChoice = String(formData.get("template") ?? "").trim();
  const templates = confirmed && eventDate ? await listTaskTemplates(organizationId) : [];
  const template = templateChoice === "none" ? undefined : templateChoice ? templates.find((candidate) => candidate.id === templateChoice) : templates.find((candidate) => candidate.eventTypeId === eventType.id);
  if (confirmed && eventDate && templateChoice && templateChoice !== "none" && !template) return { error: t("taskTemplateUnavailable") };
  // Lot 74b (B7) : chaque réponse porte sur une tâche de ce modèle ; sinon rien n'est créé (une tâche d'un
  // autre modèle ou d'une autre organisation n'est pas lue).
  const pastDue = readPastDueAnswers(formData);
  if (!pastDue) return { error: (await getTranslations("PastDue"))("invalid") };
  if (template && Object.keys(pastDue.answers).some((id) => !template.items.some((item) => item.id === id))) return { error: (await getTranslations("PastDue"))("invalid") };
  if (!template && Object.keys(pastDue.answers).length > 0) return { error: (await getTranslations("PastDue"))("invalid") };

  let result: { id: string };
  try {
    result = await createProspect({
      organizationId,
      createdByUserId: auth.user.id,
      clients,
      name,
      prospectSourceId: null,
      eventTypeId: eventType.id,
      eventDate: eventDate || null,
      venueName: null,
      venueCity: null,
      taskTemplateId: template?.id ?? null,
      pastDue: { tasks: pastDue.answers, spread: pastDue.spread },
    });
  } catch (error) {
    if (error instanceof TaskTemplateNotFoundError) return { error: t("taskTemplateUnavailable") };
    if (error instanceof TemplatePastDueInvalidError) return { error: (await getTranslations("PastDue"))("invalid") };
    // Un contact choisi qui n'existe pas (ou plus) dans l'organisation.
    if (error instanceof ContactNotFoundError) return { error: (await getTranslations("Contacts"))("notFound") };
    return { error: await unexpectedActionError(error) };
  }

  // Lot 52 (EVT-06, D2) : la personne qui crée l'évènement en est le planner principal.
  await makeCreatorLead(organizationId, result.id, auth.user.id);
  // Lot 63c (DOC-01, M8) : les dossiers proposés à chaque évènement, tirés du fichier de données.
  await createTypedDocumentFolders(organizationId, result.id, (await getLocale()) === "en" ? "en" : "fr");
  // « Signé, en préparation » : Confirmé (A10) ; « Une demande en cours » reste Option.
  if (confirmed) await changeEventStatus({ organizationId, eventId: result.id, changedByUserId: auth.user.id, toStatus: "confirmed" });

  // Lot 33b (HUB-10, D10) : au premier évènement réel, la suppression de l'exemple est proposée.
  const example = await getActiveEventsTrial(organizationId);
  const first = example ? (await countOrganizationRealEvents(organizationId)) === 1 : false;
  // Lot 39b (UX-09) : l'évènement est créé, le brouillon de la saisie n'a plus lieu d'être.
  await discardMyFormDraft("event-new");
  const summary = template && eventDate ? pastDueSummary(template.items, eventDate, pastDue) : undefined;
  return {
    created: {
      id: result.id,
      href: `/events/${result.id}${first ? "?exemple=proposer" : ""}`,
      tasks: template && eventDate ? template.items.length : 0,
      budget: await isModuleEnabled(appDatabase(), organizationId, "budget"),
      ...(summary ? { pastDue: summary } : {}),
    },
  };
}
