// RGPD-03 — oubli dans le module events (ADR 0023, registre de données) :
// les statistiques restent justes (source, statut, motif de perte en
// catégorie, types de postes, historique des statuts) ; noms, e-mails, notes
// libres et champs importés disparaissent. Date du mariage ramenée au 1er du
// mois, lieu effacé (décision de Julien, 02/11/2026). Jamais un élément d'essai.
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import {
  eventActivities,
  eventClientAccesses,
  eventClients,
  events,
  eventStatusHistory,
  eventTasks,
  eventVendorSlots,
  programItemParticipants,
  programItems,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { ANONYMIZED, idsOfKind, monthStart, type ErasureFate, type ErasureInput, type ErasurePlanItem } from "@symbola/privacy";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

// Sort de chaque nature de fiche du module.
const FATES: Record<string, ErasureFate> = {
  event: "anonymized",
  event_client: "anonymized",
  event_vendor_slot: "anonymized",
  status_change: "anonymized",
  client_access: "deleted",
  task: "deleted",
  program_item: "deleted",
  program_participant: "deleted",
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
  if (ids("client_access").length > 0)
    add(
      "client_access",
      keep(await tx.select({ id: eventClientAccesses.id, eventId: eventClientAccesses.eventId }).from(eventClientAccesses).where(inArray(eventClientAccesses.id, ids("client_access")))),
    );
  if (ids("event_vendor_slot").length > 0)
    add(
      "event_vendor_slot",
      keep(await tx.select({ id: eventVendorSlots.id, eventId: eventVendorSlots.eventId }).from(eventVendorSlots).where(inArray(eventVendorSlots.id, ids("event_vendor_slot")))),
    );
  if (ids("task").length > 0) add("task", keep(await tx.select({ id: eventTasks.id, eventId: eventTasks.eventId }).from(eventTasks).where(inArray(eventTasks.id, ids("task")))));
  if (ids("program_item").length > 0)
    add("program_item", keep(await tx.select({ id: programItems.id, eventId: programItems.eventId }).from(programItems).where(inArray(programItems.id, ids("program_item")))));
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
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, fn);
  } finally {
    await sql.end();
  }
}

export async function planEventsErasure(input: ErasureInput): Promise<ErasurePlanItem[]> {
  return inOrganization(input.organizationId, async (tx) => toPlan(await existing(tx, input)));
}

// Exécution dans une seule transaction : tout ou rien pour le module.
export async function eraseEventsData(input: ErasureInput): Promise<ErasurePlanItem[]> {
  return inOrganization(input.organizationId, async (tx) => {
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
            venueName: null,
            venueCity: null,
            lossReasonNote: null,
            importedFields: null,
            updatedAt: now,
          })
          .where(eq(events.id, event.id));
      }
      // Fil d'activité des mariés (qui a coché quelle tâche) : données sur eux.
      await tx.delete(eventActivities).where(inArray(eventActivities.eventId, eventIds));
    }
    if (idsFor("event_client").length > 0) {
      await tx.update(eventClients).set({ firstName: ANONYMIZED, lastName: null }).where(inArray(eventClients.id, idsFor("event_client")));
    }
    if (idsFor("event_vendor_slot").length > 0) {
      const slotIds = idsFor("event_vendor_slot");
      await tx.update(eventVendorSlots).set({ importedFields: null }).where(inArray(eventVendorSlots.id, slotIds));
      // Le type de poste et son statut restent (statistiques) ; le nom du prestataire non.
      await tx
        .update(eventVendorSlots)
        .set({ vendorName: ANONYMIZED })
        .where(and(inArray(eventVendorSlots.id, slotIds), isNotNull(eventVendorSlots.vendorName)));
    }
    if (idsFor("client_access").length > 0) await tx.delete(eventClientAccesses).where(inArray(eventClientAccesses.id, idsFor("client_access")));
    if (idsFor("task").length > 0) await tx.delete(eventTasks).where(inArray(eventTasks.id, idsFor("task")));
    if (idsFor("program_participant").length > 0) await tx.delete(programItemParticipants).where(inArray(programItemParticipants.id, idsFor("program_participant")));
    if (idsFor("program_item").length > 0) {
      await tx.delete(programItemParticipants).where(inArray(programItemParticipants.programItemId, idsFor("program_item")));
      await tx.delete(programItems).where(inArray(programItems.id, idsFor("program_item")));
    }
    return toPlan(found);
  });
}
