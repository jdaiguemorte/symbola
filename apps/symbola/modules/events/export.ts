// Lot 35a (HUB-13, DAT-13, ADR 0068) — entités du module Événements dans l'export complet de
// l'organisation (contrat export/v1), dans l'ordre de leurs dépendances : réglages et modèles,
// puis chaque événement et ce qui s'y rattache. Les événements d'essai et tout ce qui en dépend
// sont exclus. Exposé par service.ts.
import { and, eq } from "drizzle-orm";
import type { ExportEntitySchema, ModuleExport, ModuleExportContext } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import {
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
  { table: events, demoField: "isDemo" },
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
  { table: eventVendorCandidates, ...ofEvent, files: ["quoteFileKey"] },
  { table: eventVendorCandidateNotes, parents: { candidateId: "event_vendor_candidates" } },
  { table: eventTasks, ...ofEvent },
  { table: eventTaskComments, ...ofEvent },
  { table: eventTaskAttachments, ...ofEvent, files: ["fileKey"] },
  { table: programItems, ...ofEvent },
  { table: programItemParticipants, parents: { programItemId: "program_items" } },
  // Lot 37b (DAT-14) : versions diffusées du programme.
  { table: programVersions, ...ofEvent },
  // Liens personnels des tiers, pour mémoire : jamais leur jeton (haché) ; ils se recréent.
  { table: eventLinks, ...ofEvent, omit: ["tokenHash"] },
  { table: eventLinkSharedSlots, parents: { linkId: "event_links" } },
  // Lot 37a (D7) : liens de partage d'un document, pour mémoire, sans leur jeton (haché).
  { table: eventDocumentLinks, ...ofEvent, omit: ["tokenHash"] },
  { table: eventDecisions, ...ofEvent },
  { table: eventActivities, ...ofEvent },
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
