// Lot 35a (HUB-13, DAT-13, ADR 0068) — entités du module Événements dans l'export complet de
// l'organisation (contrat export/v1), dans l'ordre de leurs dépendances : réglages et modèles,
// puis chaque événement et ce qui s'y rattache. Les événements d'essai et tout ce qui en dépend
// sont exclus. Exposé par service.ts.
import { and, eq } from "drizzle-orm";
import type { ExportEntitySchema, ModuleExport, ModuleExportContext, ModuleImportContext, ModuleImportResult, ModuleImportRows } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import { clearModuleImportTargets, importModuleEntities, registerModuleImportIds } from "@symbola/db/import";
import type { OrganizationTransaction } from "@symbola/db/with-organization";
import {
  dayChecklistItems,
  dayChecklists,
  dayChecklistTemplates,
  dayCheckpoints,
  eventTeamMembers,
  dayIncidents,
  dayPhotos,
  dayReports,
  dayShifts,
  defaultVendorSlots,
  eventActivities,
  eventClients,
  eventDayContacts,
  eventDayDocuments,
  eventDecisions,
  eventDocumentFolders,
  eventDocumentLinks,
  eventDocuments,
  eventDocumentVersions,
  eventLinks,
  eventLinkSharedSlots,
  eventPlaces,
  keyMoments,
  events,
  contactForms,
  pipelineStages,
  prospectRequests,
  eventStatusHistory,
  eventTaskAttachments,
  eventTaskComments,
  eventTasks,
  eventTypes,
  eventVendorCandidateNotes,
  eventVendorCandidates,
  eventVendorSlots,
  lossReasons,
  programItemParticipants,
  programItems,
  programVersions,
  programTemplateItems,
  programTemplates,
  prospectSources,
  taskTemplateItems,
  taskTemplates,
  eventDecisionOptionFeedback,
  vendorBriefDocuments,
  vendorBriefs,
  vendorCoordinationSettings,
  vendorRoadmaps,
  vendorScenarioChoices,
  vendorScenarios,
  eventMessages,
  eventQuestionnaires,
  prospectFollowUps,
  prospectFollowUpSettings,
  eventTypeVocabulary,
  planningHealthSettings,
  questionnaireAnswers,
  questionnaireTemplateItems,
  questionnaireTemplates,
  closingSettings,
  eventClosings,
  eventTemplates,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";

const ofEvent = { eventField: "eventId" } as const;

export const EVENTS_EXPORT_ENTITIES: readonly ExportEntitySpec[] = [
  { table: defaultVendorSlots },
  { table: eventTypes },
  { table: prospectSources },
  { table: lossReasons },
  // Lot 44 (CRM-01, CRM-02) : étapes du pipeline (avant les évènements qui s'y rangent), formulaire de
  // contact.
  { table: pipelineStages },
  { table: contactForms },
  { table: taskTemplates },
  { table: taskTemplateItems, parents: { templateId: "task_templates" } },
  { table: programTemplates },
  { table: programTemplateItems, parents: { templateId: "program_templates" } },
  // Lot 51 (JRJ-06) : modèles des listes de contrôle du jour J.
  { table: dayChecklistTemplates },
  // Lot 47 (partie F) : réglages des prestataires par lien.
  { table: vendorCoordinationSettings, idField: "organizationId" },
  // Lot 45 (CRM-06, POR-07, HUB-21) : réglage des relances (avec la brochure), modèles de questionnaires
  // et leurs versions.
  { table: prospectFollowUpSettings, files: ["brochureStorageKey"] },
  // Lot 53 (HUB-24, CHR-05) : le terme des clients de chaque type, les seuils de la santé du planning.
  { table: eventTypeVocabulary, parents: { eventTypeId: "event_types" } },
  { table: planningHealthSettings },
  { table: questionnaireTemplates },
  { table: questionnaireTemplateItems, parents: { templateId: "questionnaire_templates" } },
  // Lot 48a (DAT-08) : des notes confidentielles ne sortent pas (chiffrées, elles restent dans Symbola).
  { table: events, demoField: "isDemo", omit: ["notesSealed"] },
  { table: eventClients, ...ofEvent },
  { table: eventStatusHistory, ...ofEvent },
  { table: eventPlaces, ...ofEvent },
  // Lot 44 (CRM-01) : demandes du formulaire de contact (une demande « à vérifier » n'a pas d'évènement).
  { table: prospectRequests, ...ofEvent },
  // Lot 49 (D2) : temps forts de l'évènement.
  { table: keyMoments, ...ofEvent },
  { table: eventDayContacts, ...ofEvent },
  // Lot 37a (D3, D4) : dossiers d'abord, puis les documents et toutes leurs versions.
  { table: eventDocumentFolders, ...ofEvent },
  { table: eventDocuments, ...ofEvent, files: ["fileKey"] },
  { table: eventDocumentVersions, parents: { documentId: "event_documents" }, files: ["fileKey"] },
  { table: eventDayDocuments, ...ofEvent },
  { table: eventVendorSlots, ...ofEvent },
  // Lot 47 (D1) : le brief d'un poste et ses inspirations, avant les prestataires qui le reçoivent.
  { table: vendorBriefs, ...ofEvent },
  { table: vendorBriefDocuments, parents: { briefId: "vendor_briefs" } },
  { table: eventVendorCandidates, ...ofEvent, files: ["quoteFileKey"] },
  // Lot 47 (D5, D8) : scénarios d'options et feuilles de route.
  { table: vendorScenarios, ...ofEvent },
  { table: vendorScenarioChoices, parents: { scenarioId: "vendor_scenarios" } },
  { table: vendorRoadmaps, parents: { candidateId: "event_vendor_candidates" } },
  { table: eventVendorCandidateNotes, parents: { candidateId: "event_vendor_candidates" } },
  { table: eventTasks, ...ofEvent },
  { table: eventTaskComments, ...ofEvent },
  { table: eventTaskAttachments, ...ofEvent, files: ["fileKey"] },
  { table: programItems, ...ofEvent },
  { table: programItemParticipants, parents: { programItemId: "program_items" } },
  // Lot 37b (DAT-14) : versions diffusées du programme.
  { table: programVersions, ...ofEvent },
  // Lot 51 (JRJ-05 à JRJ-08, PAR-08) : le jour J de terrain — pointages, décalages validés, main
  // courante, listes et cases, photos (fichiers compris ; une photo refusée n'en a pas), bilan.
  { table: dayCheckpoints, ...ofEvent },
  { table: dayShifts, ...ofEvent },
  { table: dayIncidents, ...ofEvent },
  { table: dayChecklists, ...ofEvent },
  { table: dayChecklistItems, parents: { checklistId: "day_checklists" } },
  { table: dayPhotos, ...ofEvent, files: ["storageKey"] },
  { table: dayReports, ...ofEvent },
  // Liens personnels des tiers, pour mémoire : jamais leur jeton (haché) ; ils se recréent (lot 35b :
  // la reprise ne les écrit pas, le bilan invite à les recréer).
  { table: eventLinks, ...ofEvent, omit: ["tokenHash"], importSkip: "links" },
  { table: eventLinkSharedSlots, parents: { linkId: "event_links" }, importSkip: "links" },
  // Lot 37a (D7) : liens de partage d'un document, pour mémoire, sans leur jeton (haché).
  { table: eventDocumentLinks, ...ofEvent, omit: ["tokenHash"], importSkip: "links" },
  { table: eventDecisions, ...ofEvent },
  // Lot 47 (D7) : avis des clients sur les options d'une décision.
  { table: eventDecisionOptionFeedback, parents: { decisionId: "event_decisions" } },
  { table: eventActivities, ...ofEvent },
  // Lot 45 (CRM-05, CRM-06, POR-07) : messages au contact (sans le jeton haché de la brochure),
  // relances, questionnaires envoyés et leurs réponses.
  { table: eventMessages, ...ofEvent, omit: ["brochureTokenHash"] },
  { table: prospectFollowUps, ...ofEvent },
  { table: eventQuestionnaires, ...ofEvent },
  { table: questionnaireAnswers, parents: { questionnaireId: "event_questionnaires" } },
  // Lot 52 (EVT-06, D2) : l'équipe de chaque évènement (planner principal, assistants).
  { table: eventTeamMembers, ...ofEvent },
  // Lot 58 (PAR-09, EVT-08 ; ADR 0097) : clôtures (leçons, temps passé, frais propres, budget figé), réglage
  // du lien d'avis et modèles d'évènement (des structures, sans donnée personnelle).
  { table: eventClosings, ...ofEvent },
  { table: closingSettings },
  { table: eventTemplates },
];

// Tables du module qui ne sont pas exportées, et pourquoi (docs/export/format-v1.md).
export const EVENTS_EXPORT_EXCLUSIONS: Readonly<Record<string, string>> = {
  event_link_codes: "secret : codes à usage unique des liens personnels (hachés)",
  event_link_sessions: "secret : sessions ouvertes par les liens personnels (jetons hachés)",
  event_task_reminders: "technique : rappels déjà envoyés par les liens, qui ne sont pas repris",
};

export function exportEventsData(organizationId: string, context: ModuleExportContext): Promise<ModuleExport> {
  return exportModuleEntities(appDatabase(), { organizationId, module: "events", context, specs: EVENTS_EXPORT_ENTITIES });
}

export function describeEventsExport(): ExportEntitySchema[] {
  return describeModuleEntities("events", EVENTS_EXPORT_ENTITIES);
}

// Événements d'essai (is_demo) : aucun module n'exporte ce qui s'y rattache.
export async function listDemoEventIds(organizationId: string): Promise<string[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.organizationId, organizationId), eq(events.isDemo, true))),
  );
  return rows.map((row) => row.id);
}

// Lot 35b (HUB-13, ADR 0098) : reprise d'une archive dans une organisation vide (transaction de la
// reprise) ; les réglages de départ et les essais de l'organisation sont remplacés par ceux de l'archive.
export function registerEventsImportIds(rows: ModuleImportRows, context: ModuleImportContext): void {
  registerModuleImportIds(EVENTS_EXPORT_ENTITIES, rows, context);
}

export async function importEventsData(tx: OrganizationTransaction, rows: ModuleImportRows, context: ModuleImportContext): Promise<ModuleImportResult> {
  await clearModuleImportTargets(tx, { organizationId: context.organizationId, specs: EVENTS_EXPORT_ENTITIES });
  return { module: "events", entities: await importModuleEntities(tx, { specs: EVENTS_EXPORT_ENTITIES, rows, context }) };
}
