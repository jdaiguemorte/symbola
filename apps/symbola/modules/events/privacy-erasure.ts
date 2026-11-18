// RGPD-03 — oubli dans le module events (ADR 0023, registre de données) :
// les statistiques restent justes (source, statut, motif de perte en
// catégorie, types de postes, historique des statuts) ; noms, e-mails, notes
// libres et champs importés disparaissent. Date du mariage ramenée au 1er du
// mois, lieu effacé (décision de Julien, 02/11/2026). Jamais un élément d'essai.
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { createStorageClient, deletePrivateObject } from "@symbola/files";
import {
  dayChecklists,
  dayIncidents,
  dayPhotos,
  dayReports,
  eventActivities,
  eventDecisions,
  eventDecisionOptionFeedback,
  vendorBriefs,
  eventLinks,
  eventClients,
  eventDayContacts,
  eventDayDocuments,
  eventDocumentFolders,
  eventDocuments,
  eventDocumentVersions,
  eventPlaces,
  eventTaskAttachments,
  eventTaskComments,
  events,
  eventStatusHistory,
  eventTasks,
  eventVendorCandidateNotes,
  eventVendorCandidates,
  eventVendorSlots,
  programItemParticipants,
  programItems,
  programVersions,
  prospectRequests,
  eventMessages,
  eventQuestionnaires,
  prospectFollowUps,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { ANONYMIZED, idsOfKind, monthStart, type ErasureFate, type ErasureInput, type ErasurePlanItem } from "@symbola/privacy";
import { anonymizeContacts } from "@/modules/hub/service";
import { findLinkedContactIds } from "./repository";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

// Sort de chaque nature de fiche du module.
const FATES: Record<string, ErasureFate> = {
  event: "anonymized",
  event_client: "anonymized",
  event_vendor_slot: "anonymized",
  vendor_candidate: "anonymized",
  status_change: "anonymized",
  link: "deleted",
  task: "deleted",
  program_item: "deleted",
  program_participant: "deleted",
  // Lot 37b (CHR-07, DAT-14) : une version diffusée recopie responsables et intervenants libres :
  // supprimée (pas d'anonymisation partielle d'une version figée).
  program_version: "deleted",
  event_place: "deleted",
  // Lot 29b : un document peut nommer la personne (plan de table) : supprimé,
  // fichier compris (pas d'anonymisation partielle d'un fichier).
  event_document: "deleted",
  // Lot 37a (D3) : un nom de dossier peut nommer la personne : supprimé, ses documents vont dans
  // « Divers ».
  event_document_folder: "deleted",
  // Lot 30a : contact du jour J (nom, téléphone d'une personne) : supprimé.
  event_day_contact: "deleted",
  // Lot 34b (CHR-02) : un commentaire ou une pièce jointe de tâche peut nommer la personne :
  // supprimés, fichier compris.
  task_comment: "deleted",
  task_attachment: "deleted",
  // Lot 44 (CRM-01) : une demande du formulaire de contact (message libre, champs reçus) : supprimée.
  prospect_request: "deleted",
  // Lot 51 (JRJ-07, DPO-9) : un incident de la main courante peut nommer la personne : supprimé, ses
  // photos (fichiers compris) avec lui.
  day_incident: "deleted",
  // Lot 45 (CRM-05, CRM-06, POR-07) : un message ou une relance (texte libre), un questionnaire et ses
  // réponses : supprimés.
  event_message: "deleted",
  follow_up: "deleted",
  questionnaire: "deleted",
};

type Found = { kind: string; ids: string[] };

// Fiches désignées qui existent, rattachées à un événement réel de l'organisation.
async function existing(tx: Tx, input: ErasureInput): Promise<Found[]> {
  const realEventIds = new Set((await tx.select({ id: events.id }).from(events).where(eq(events.isDemo, false))).map((row) => row.id));
  const keep = (rows: { id: string; eventId: string | null }[]) => rows.filter((row) => row.eventId !== null && realEventIds.has(row.eventId)).map((row) => row.id);
  const ids = (kind: string) => idsOfKind(input.records, kind);
  const found: Found[] = [];
  const add = (kind: string, list: string[]) => {
    if (list.length > 0) found.push({ kind, ids: list });
  };

  add("event", ids("event").filter((id) => realEventIds.has(id)));
  if (ids("event_client").length > 0)
    add("event_client", keep(await tx.select({ id: eventClients.id, eventId: eventClients.eventId }).from(eventClients).where(inArray(eventClients.id, ids("event_client")))));
  if (ids("link").length > 0)
    add(
      "link",
      keep(await tx.select({ id: eventLinks.id, eventId: eventLinks.eventId }).from(eventLinks).where(inArray(eventLinks.id, ids("link")))),
    );
  if (ids("event_vendor_slot").length > 0)
    add(
      "event_vendor_slot",
      keep(await tx.select({ id: eventVendorSlots.id, eventId: eventVendorSlots.eventId }).from(eventVendorSlots).where(inArray(eventVendorSlots.id, ids("event_vendor_slot")))),
    );
  if (ids("vendor_candidate").length > 0)
    add(
      "vendor_candidate",
      keep(await tx.select({ id: eventVendorCandidates.id, eventId: eventVendorCandidates.eventId }).from(eventVendorCandidates).where(inArray(eventVendorCandidates.id, ids("vendor_candidate")))),
    );
  if (ids("task").length > 0) add("task", keep(await tx.select({ id: eventTasks.id, eventId: eventTasks.eventId }).from(eventTasks).where(inArray(eventTasks.id, ids("task")))));
  if (ids("program_item").length > 0)
    add("program_item", keep(await tx.select({ id: programItems.id, eventId: programItems.eventId }).from(programItems).where(inArray(programItems.id, ids("program_item")))));
  if (ids("program_version").length > 0)
    add("program_version", keep(await tx.select({ id: programVersions.id, eventId: programVersions.eventId }).from(programVersions).where(inArray(programVersions.id, ids("program_version")))));
  if (ids("event_place").length > 0)
    add("event_place", keep(await tx.select({ id: eventPlaces.id, eventId: eventPlaces.eventId }).from(eventPlaces).where(inArray(eventPlaces.id, ids("event_place")))));
  if (ids("program_participant").length > 0)
    add(
      "program_participant",
      keep(
        await tx
          .select({ id: programItemParticipants.id, eventId: programItems.eventId })
          .from(programItemParticipants)
          .innerJoin(programItems, eq(programItems.id, programItemParticipants.programItemId))
          .where(inArray(programItemParticipants.id, ids("program_participant"))),
      ),
    );
  if (ids("event_day_contact").length > 0)
    add("event_day_contact", keep(await tx.select({ id: eventDayContacts.id, eventId: eventDayContacts.eventId }).from(eventDayContacts).where(inArray(eventDayContacts.id, ids("event_day_contact")))));
  if (ids("event_document").length > 0)
    add("event_document", keep(await tx.select({ id: eventDocuments.id, eventId: eventDocuments.eventId }).from(eventDocuments).where(inArray(eventDocuments.id, ids("event_document")))));
  if (ids("event_document_folder").length > 0)
    add(
      "event_document_folder",
      keep(await tx.select({ id: eventDocumentFolders.id, eventId: eventDocumentFolders.eventId }).from(eventDocumentFolders).where(inArray(eventDocumentFolders.id, ids("event_document_folder")))),
    );
  if (ids("task_comment").length > 0)
    add("task_comment", keep(await tx.select({ id: eventTaskComments.id, eventId: eventTaskComments.eventId }).from(eventTaskComments).where(inArray(eventTaskComments.id, ids("task_comment")))));
  if (ids("task_attachment").length > 0)
    add("task_attachment", keep(await tx.select({ id: eventTaskAttachments.id, eventId: eventTaskAttachments.eventId }).from(eventTaskAttachments).where(inArray(eventTaskAttachments.id, ids("task_attachment")))));
  // Lot 44 : une demande « à vérifier » n'a pas encore d'évènement ; elle est de l'organisation (RLS).
  if (ids("day_incident").length > 0)
    add("day_incident", keep(await tx.select({ id: dayIncidents.id, eventId: dayIncidents.eventId }).from(dayIncidents).where(inArray(dayIncidents.id, ids("day_incident")))));
  if (ids("prospect_request").length > 0)
    add(
      "prospect_request",
      (await tx.select({ id: prospectRequests.id, eventId: prospectRequests.eventId }).from(prospectRequests).where(inArray(prospectRequests.id, ids("prospect_request"))))
        .filter((row) => row.eventId === null || realEventIds.has(row.eventId))
        .map((row) => row.id),
    );
  // Lot 45 : messages, relances et questionnaires d'un évènement réel.
  if (ids("event_message").length > 0)
    add("event_message", keep(await tx.select({ id: eventMessages.id, eventId: eventMessages.eventId }).from(eventMessages).where(inArray(eventMessages.id, ids("event_message")))));
  if (ids("follow_up").length > 0)
    add("follow_up", keep(await tx.select({ id: prospectFollowUps.id, eventId: prospectFollowUps.eventId }).from(prospectFollowUps).where(inArray(prospectFollowUps.id, ids("follow_up")))));
  if (ids("questionnaire").length > 0)
    add("questionnaire", keep(await tx.select({ id: eventQuestionnaires.id, eventId: eventQuestionnaires.eventId }).from(eventQuestionnaires).where(inArray(eventQuestionnaires.id, ids("questionnaire")))));
  if (ids("status_change").length > 0)
    add(
      "status_change",
      keep(await tx.select({ id: eventStatusHistory.id, eventId: eventStatusHistory.eventId }).from(eventStatusHistory).where(inArray(eventStatusHistory.id, ids("status_change")))),
    );
  return found;
}

function toPlan(found: Found[]): ErasurePlanItem[] {
  return found.flatMap(({ kind, ids }) => ids.map((recordId) => ({ kind, recordId, fate: FATES[kind]!, legalBasis: null, keptUntil: null })));
}

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

export async function planEventsErasure(input: ErasureInput): Promise<ErasurePlanItem[]> {
  return inOrganization(input.organizationId, async (tx) => toPlan(await existing(tx, input)));
}

// Exécution dans une seule transaction : tout ou rien pour le module.
export async function eraseEventsData(input: ErasureInput): Promise<ErasurePlanItem[]> {
  const fileKeys: string[] = [];
  // Lot 36a (ADR 0069) : contacts retirés d'un évènement, anonymisés chez le hub s'ils ne sont plus
  // clients d'aucun autre.
  const unlinkedContacts: string[] = [];
  const plan = await inOrganization(input.organizationId, async (tx) => {
    const found = await existing(tx, input);
    const idsFor = (kind: string) => found.find((entry) => entry.kind === kind)?.ids ?? [];
    const now = new Date();

    const eventIds = idsFor("event");
    if (eventIds.length > 0) {
      for (const event of await tx.select({ id: events.id, eventDate: events.eventDate }).from(events).where(inArray(events.id, eventIds))) {
        await tx
          .update(events)
          .set({
            eventDate: event.eventDate ? monthStart(event.eventDate) : null,
            lossReasonNote: null,
            // Lot 34b (EVT-03) : style et notes libres effacés ; les nombres d'invités restent.
            style: null,
            notes: null,
            importedFields: null,
            updatedAt: now,
          })
          .where(eq(events.id, event.id));
      }
      // Fil d'activité des mariés (qui a coché quelle tâche) : données sur eux.
      await tx.delete(eventActivities).where(inArray(eventActivities.eventId, eventIds));
      // Lot 44 (CRM-01) : la demande du formulaire de contact (message libre de la personne).
      await tx.delete(prospectRequests).where(inArray(prospectRequests.eventId, eventIds));
      // Lot 51 (JRJ-07, DPO-9) : la main courante, ses photos (fichiers compris), les listes et le bilan
      // du jour J (qui recopie les incidents) ; les pointages et décalages (heures, identifiants) restent.
      await tx.delete(dayIncidents).where(inArray(dayIncidents.eventId, eventIds));
      const photos = await tx.delete(dayPhotos).where(inArray(dayPhotos.eventId, eventIds)).returning({ key: dayPhotos.storageKey });
      fileKeys.push(...photos.map((photo) => photo.key).filter((key): key is string => key !== null));
      await tx.delete(dayChecklists).where(inArray(dayChecklists.eventId, eventIds));
      await tx.delete(dayReports).where(inArray(dayReports.eventId, eventIds));
      // Lot 45 (CRM-05, CRM-06, POR-07) : messages, relances, questionnaires et réponses (texte libre).
      await tx.delete(prospectFollowUps).where(inArray(prospectFollowUps.eventId, eventIds));
      await tx.delete(eventMessages).where(inArray(eventMessages.eventId, eventIds));
      await tx.delete(eventQuestionnaires).where(inArray(eventQuestionnaires.eventId, eventIds));
      // Lot 12 : lieux de l'événement (adresse possiblement privée), réception comprise (lot 34b).
      await tx.delete(eventPlaces).where(inArray(eventPlaces.eventId, eventIds));
      // Lot 34b (CHR-02) : commentaires et pièces jointes des tâches de l'événement.
      await tx.delete(eventTaskComments).where(inArray(eventTaskComments.eventId, eventIds));
      const attachments = await tx.delete(eventTaskAttachments).where(inArray(eventTaskAttachments.eventId, eventIds)).returning({ key: eventTaskAttachments.fileKey });
      fileKeys.push(...attachments.map((attachment) => attachment.key));
    }
    if (idsFor("event_client").length > 0) {
      // Lot 36a : la personne est retirée de l'évènement (lien vidé) ; la ligne reste, pour les
      // statistiques. Son contact est anonymisé plus bas s'il n'est plus client d'aucun évènement.
      // Les contacts se lisent avant : RETURNING rendrait le lien déjà vidé.
      const linked = await tx
        .select({ contactId: eventClients.contactId })
        .from(eventClients)
        .where(and(inArray(eventClients.id, idsFor("event_client")), isNotNull(eventClients.contactId)));
      await tx.update(eventClients).set({ contactId: null }).where(inArray(eventClients.id, idsFor("event_client")));
      // Lot 45 : les messages, relances et questionnaires adressés à la personne partent avec elle.
      const erasedContacts = linked.map((row) => row.contactId).filter((id): id is string => id !== null);
      if (erasedContacts.length > 0) {
        await tx.delete(prospectFollowUps).where(inArray(prospectFollowUps.contactId, erasedContacts));
        await tx.delete(eventMessages).where(inArray(eventMessages.contactId, erasedContacts));
        await tx.delete(eventQuestionnaires).where(inArray(eventQuestionnaires.contactId, erasedContacts));
      }
      unlinkedContacts.push(...linked.map((row) => row.contactId).filter((id): id is string => id !== null));
    }
    if (idsFor("event_vendor_slot").length > 0) {
      const slotIds = idsFor("event_vendor_slot");
      // Le poste reste (statistiques) ; lot 28b : le nom de ses prestataires est
      // porté par les prestataires rattachés, anonymisés plus bas.
      await tx.update(eventVendorSlots).set({ importedFields: null, brief: null }).where(inArray(eventVendorSlots.id, slotIds));
      // Lot 47 (D1) : le besoin du brief du poste.
      await tx.update(vendorBriefs).set({ need: ANONYMIZED, updatedAt: now }).where(inArray(vendorBriefs.vendorSlotId, slotIds));
    }
    // Lot 11 : le consulté reste (statistiques, retenu ou non) sans nom ni
    // notes ; son devis, qui le nomme, est supprimé (fichier compris).
    if (idsFor("vendor_candidate").length > 0) {
      const candidateIds = idsFor("vendor_candidate");
      await tx.delete(eventVendorCandidateNotes).where(inArray(eventVendorCandidateNotes.candidateId, candidateIds));
      const withFiles = await tx
        .select({ key: eventVendorCandidates.quoteFileKey })
        .from(eventVendorCandidates)
        .where(and(inArray(eventVendorCandidates.id, candidateIds), isNotNull(eventVendorCandidates.quoteFileKey)));
      fileKeys.push(...withFiles.map((row) => row.key).filter((key): key is string => key !== null));
      await tx
        .update(eventVendorCandidates)
        .set({ vendorName: ANONYMIZED, vendorId: null, quoteFileKey: null, quoteMime: null, quoteSizeBytes: null, answerMessage: null, updatedAt: now })
        .where(inArray(eventVendorCandidates.id, candidateIds));
    }
    if (idsFor("link").length > 0) {
      // Lot 27b (EVT-09) : la décision reste, sans le nom ni le commentaire de la personne.
      await tx.update(eventDecisions).set({ decidedByName: ANONYMIZED, comment: sql`case when ${eventDecisions.comment} is null then null else ${ANONYMIZED} end` }).where(inArray(eventDecisions.decidedByLinkId, idsFor("link")));
      // Lot 47 (D7) : ses avis sur les options partent avec lui.
      await tx.delete(eventDecisionOptionFeedback).where(inArray(eventDecisionOptionFeedback.linkId, idsFor("link")));
      await tx.delete(eventLinks).where(inArray(eventLinks.id, idsFor("link")));
    }
    if (idsFor("event_day_contact").length > 0) await tx.delete(eventDayContacts).where(inArray(eventDayContacts.id, idsFor("event_day_contact")));
    if (idsFor("event_document").length > 0) {
      const documentIds = idsFor("event_document");
      // Lot 37a (D4, D7) : les fichiers de toutes les versions, et les ouvertures de ses liens de
      // partage au fil d'activité (elles portent son intitulé) ; versions et liens partent avec la
      // ligne (clé étrangère).
      const versions = await tx.select({ key: eventDocumentVersions.fileKey }).from(eventDocumentVersions).where(inArray(eventDocumentVersions.documentId, documentIds));
      const documents = await tx.delete(eventDocuments).where(inArray(eventDocuments.id, documentIds)).returning({ key: eventDocuments.fileKey, eventId: eventDocuments.eventId, label: eventDocuments.label });
      fileKeys.push(...new Set([...documents.map((document) => document.key), ...versions.map((version) => version.key)]));
      for (const document of documents) {
        await tx
          .delete(eventActivities)
          .where(and(eq(eventActivities.eventId, document.eventId), eq(eventActivities.kind, "document_link_opened"), eq(eventActivities.taskLabel, document.label)));
      }
      await tx.delete(eventDayDocuments).where(and(eq(eventDayDocuments.source, "event_document"), inArray(eventDayDocuments.sourceId, documentIds)));
    }
    if (idsFor("prospect_request").length > 0) await tx.delete(prospectRequests).where(inArray(prospectRequests.id, idsFor("prospect_request")));
    if (idsFor("follow_up").length > 0) await tx.delete(prospectFollowUps).where(inArray(prospectFollowUps.id, idsFor("follow_up")));
    if (idsFor("event_message").length > 0) await tx.delete(eventMessages).where(inArray(eventMessages.id, idsFor("event_message")));
    if (idsFor("questionnaire").length > 0) await tx.delete(eventQuestionnaires).where(inArray(eventQuestionnaires.id, idsFor("questionnaire")));
    if (idsFor("event_document_folder").length > 0) await tx.delete(eventDocumentFolders).where(inArray(eventDocumentFolders.id, idsFor("event_document_folder")));
    if (idsFor("day_incident").length > 0) {
      const photos = await tx.delete(dayPhotos).where(and(eq(dayPhotos.subject, "incident"), inArray(dayPhotos.subjectId, idsFor("day_incident")))).returning({ key: dayPhotos.storageKey });
      fileKeys.push(...photos.map((photo) => photo.key).filter((key): key is string => key !== null));
      await tx.delete(dayIncidents).where(inArray(dayIncidents.id, idsFor("day_incident")));
    }
    if (idsFor("task_comment").length > 0) await tx.delete(eventTaskComments).where(inArray(eventTaskComments.id, idsFor("task_comment")));
    if (idsFor("task_attachment").length > 0) {
      const removed = await tx.delete(eventTaskAttachments).where(inArray(eventTaskAttachments.id, idsFor("task_attachment"))).returning({ key: eventTaskAttachments.fileKey });
      fileKeys.push(...removed.map((attachment) => attachment.key));
    }
    if (idsFor("task").length > 0) {
      // Les pièces jointes partent avec leur tâche (clé étrangère) : leurs fichiers aussi.
      const removed = await tx.delete(eventTaskAttachments).where(inArray(eventTaskAttachments.taskId, idsFor("task"))).returning({ key: eventTaskAttachments.fileKey });
      fileKeys.push(...removed.map((attachment) => attachment.key));
      await tx.delete(eventTasks).where(inArray(eventTasks.id, idsFor("task")));
    }
    if (idsFor("program_participant").length > 0) await tx.delete(programItemParticipants).where(inArray(programItemParticipants.id, idsFor("program_participant")));
    if (idsFor("program_version").length > 0) await tx.delete(programVersions).where(inArray(programVersions.id, idsFor("program_version")));
    if (idsFor("event_place").length > 0) await tx.delete(eventPlaces).where(inArray(eventPlaces.id, idsFor("event_place")));
    if (idsFor("program_item").length > 0) {
      await tx.delete(programItemParticipants).where(inArray(programItemParticipants.programItemId, idsFor("program_item")));
      await tx.delete(programItems).where(inArray(programItems.id, idsFor("program_item")));
    }
    return toPlan(found);
  });
  if (unlinkedContacts.length > 0) {
    const stillLinked = await findLinkedContactIds(input.organizationId, unlinkedContacts);
    await anonymizeContacts(input.organizationId, unlinkedContacts.filter((id) => !stillLinked.has(id)));
  }
  const storage = fileKeys.length > 0 ? createStorageClient() : null;
  for (const key of fileKeys) await deletePrivateObject(storage!, key).catch(() => undefined);
  return plan;
}
