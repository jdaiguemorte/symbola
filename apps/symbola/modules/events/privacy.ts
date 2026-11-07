// Implémentation du contrat privacy/v1 du module events (SOC-07, révisé au
// lot 6 : ADR 0023). Champs personnels du module (privacy.registry.yaml) :
// prénom/nom des clients, e-mail d'accès des mariés, nom du prestataire d'un
// poste (un indépendant est une personne), intervenants libres et notes
// internes du programme, adresse des lieux de l'événement (lot 12 :
// celle des préparatifs peut être le domicile des mariés), motif de perte en texte libre, champs libres
// importés (événement, tâche, poste). Les données d'un essai guidé (ADR 0008)
// ne sont jamais trouvées.
import { asc, eq, inArray } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import {
  eventClientAccesses,
  eventClients,
  eventPlaces,
  events,
  eventStatusHistory,
  eventTasks,
  eventVendorCandidateNotes,
  eventVendorCandidates,
  eventVendorSlots,
  programItemParticipants,
  programItems,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { hasTerms, prepareTerms, recordMatches, type PrivacyContractV1, type PrivacyRecord } from "@symbola/privacy";
import { eraseEventsData, planEventsErasure } from "./privacy-erasure";

const MODULE = "events";

function fullName(firstName: string, lastName: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName;
}

function importedValues(fields: Record<string, string> | null): string[] {
  return Object.entries(fields ?? {}).map(([name, value]) => `${name} ${value}`);
}

function importedFieldsOf(fields: Record<string, string> | null): Record<string, string> {
  return Object.fromEntries(Object.entries(fields ?? {}).map(([name, value]) => [`imported:${name}`, value]));
}

function compact(fields: Record<string, string | null | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""));
}

async function inOrganization<T>(organizationId: string, fn: (tx: Parameters<Parameters<typeof withOrganization>[2]>[0]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, fn);
  } finally {
    await sql.end();
  }
}

// Lot 11 (EVT-10/11) : prestataires consultés et leurs notes.
type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
async function candidateRecords(tx: Tx, eventIds: string[], matches: ((values: (string | null)[]) => boolean) | null): Promise<PrivacyRecord[]> {
  const candidates = await tx.select().from(eventVendorCandidates).where(inArray(eventVendorCandidates.eventId, eventIds)).orderBy(asc(eventVendorCandidates.position));
  if (candidates.length === 0) return [];
  const notes = await tx.select().from(eventVendorCandidateNotes).where(inArray(eventVendorCandidateNotes.candidateId, candidates.map((candidate) => candidate.id)));
  const records: PrivacyRecord[] = [];
  for (const candidate of candidates) {
    const bodies = notes.filter((note) => note.candidateId === candidate.id).map((note) => note.body);
    if (matches && !matches([candidate.vendorName, ...bodies])) continue;
    records.push({
      module: MODULE,
      kind: "vendor_candidate",
      recordId: candidate.id,
      label: candidate.vendorName,
      fields: compact({ vendorName: candidate.vendorName, notes: bodies.join(" · ") || null }),
      eventId: candidate.eventId,
    });
  }
  return records;
}

// Volumes d'une organisation (une planner : quelques centaines d'événements)
// : les champs personnels sont lus puis comparés ici, sans tenir compte des
// accents — ce que ILIKE ne sait pas faire sans extension.
export const eventsPrivacy: PrivacyContractV1 = {
  module: MODULE,

  // RGPD-03 — oubli (privacy-erasure.ts).
  planErasure: planEventsErasure,
  erase: eraseEventsData,

  async find({ organizationId, terms: rawTerms }) {
    const terms = prepareTerms(rawTerms);
    if (!hasTerms(terms)) return [];
    return inOrganization(organizationId, async (tx) => {
      const realEvents = await tx.select().from(events).where(eq(events.isDemo, false));
      const eventIds = realEvents.map((event) => event.id);
      if (eventIds.length === 0) return [];
      const records: PrivacyRecord[] = [];

      for (const event of realEvents) {
        if (recordMatches([event.lossReasonNote, ...importedValues(event.importedFields)], terms)) {
          records.push({
            module: MODULE,
            kind: "event",
            recordId: event.id,
            label: event.eventDate ?? "",
            fields: compact({ lossReasonNote: event.lossReasonNote, ...importedFieldsOf(event.importedFields) }),
            eventId: event.id,
          });
        }
      }
      for (const client of await tx.select().from(eventClients).where(inArray(eventClients.eventId, eventIds))) {
        if (recordMatches([client.firstName, client.lastName, client.email, client.phone], terms)) {
          records.push({
            module: MODULE,
            kind: "event_client",
            recordId: client.id,
            label: fullName(client.firstName, client.lastName),
            fields: compact({
              firstName: client.firstName,
              lastName: client.lastName,
              email: client.email,
              phone: client.phone,
              address: [client.addressLine, client.postalCode, client.city].filter(Boolean).join(" ") || null,
            }),
            eventId: client.eventId,
          });
        }
      }
      for (const access of await tx.select().from(eventClientAccesses).where(inArray(eventClientAccesses.eventId, eventIds))) {
        if (recordMatches([access.email], terms)) {
          records.push({ module: MODULE, kind: "client_access", recordId: access.id, label: access.email, fields: { email: access.email }, eventId: access.eventId });
        }
      }
      for (const slot of await tx.select().from(eventVendorSlots).where(inArray(eventVendorSlots.eventId, eventIds))) {
        if (recordMatches([slot.vendorName, ...importedValues(slot.importedFields)], terms)) {
          records.push({
            module: MODULE,
            kind: "event_vendor_slot",
            recordId: slot.id,
            label: slot.vendorName ? `${slot.label} — ${slot.vendorName}` : slot.label,
            fields: compact({ vendorName: slot.vendorName, ...importedFieldsOf(slot.importedFields) }),
            eventId: slot.eventId,
          });
        }
      }
      records.push(...(await candidateRecords(tx, eventIds, (values) => recordMatches(values, terms))));
      for (const task of await tx.select().from(eventTasks).where(inArray(eventTasks.eventId, eventIds))) {
        if (recordMatches(importedValues(task.importedFields), terms)) {
          records.push({ module: MODULE, kind: "task", recordId: task.id, label: task.label, fields: importedFieldsOf(task.importedFields), eventId: task.eventId });
        }
      }
      const items = await tx.select().from(programItems).where(inArray(programItems.eventId, eventIds));
      for (const item of items) {
        if (recordMatches([item.internalNote], terms)) {
          records.push({ module: MODULE, kind: "program_item", recordId: item.id, label: item.label, fields: compact({ internalNote: item.internalNote }), eventId: item.eventId });
        }
      }
      // Lot 12 (EVT-15) : lieux de l'événement.
      for (const place of await tx.select().from(eventPlaces).where(inArray(eventPlaces.eventId, eventIds))) {
        if (recordMatches([place.label, place.address], terms)) {
          records.push({ module: MODULE, kind: "event_place", recordId: place.id, label: place.label, fields: compact({ address: place.address }), eventId: place.eventId });
        }
      }
      const itemEvent = new Map(items.map((item) => [item.id, item]));
      if (items.length > 0) {
        for (const participant of await tx.select().from(programItemParticipants).where(inArray(programItemParticipants.programItemId, [...itemEvent.keys()]))) {
          if (recordMatches([participant.freeLabel], terms)) {
            const item = itemEvent.get(participant.programItemId);
            records.push({
              module: MODULE,
              kind: "program_participant",
              recordId: participant.id,
              label: `${item?.label ?? ""} — ${participant.freeLabel ?? ""}`,
              fields: compact({ freeLabel: participant.freeLabel }),
              eventId: item?.eventId ?? null,
            });
          }
        }
      }
      return records;
    });
  },

  // Données d'un événement de la personne : la fiche, ses tâches, postes,
  // programme, accès et historique de statut.
  async related({ organizationId, eventIds }) {
    if (eventIds.length === 0) return [];
    return inOrganization(organizationId, async (tx) => {
      const realEvents = await tx.select().from(events).where(inArray(events.id, eventIds));
      const ids = realEvents.filter((event) => !event.isDemo).map((event) => event.id);
      if (ids.length === 0) return [];
      const records: PrivacyRecord[] = [];
      const clientsByEvent = new Map<string, string[]>();
      for (const client of await tx.select().from(eventClients).where(inArray(eventClients.eventId, ids)).orderBy(asc(eventClients.position))) {
        clientsByEvent.set(client.eventId, [...(clientsByEvent.get(client.eventId) ?? []), fullName(client.firstName, client.lastName)]);
      }
      for (const event of realEvents.filter((candidate) => ids.includes(candidate.id))) {
        records.push({
          module: MODULE,
          kind: "event",
          recordId: event.id,
          label: [(clientsByEvent.get(event.id) ?? []).join(" & "), event.eventDate].filter(Boolean).join(", "),
          fields: compact({
            status: event.status,
            eventDate: event.eventDate,
            venueName: event.venueName,
            venueCity: event.venueCity,
            lossReasonNote: event.lossReasonNote,
            ...importedFieldsOf(event.importedFields),
          }),
          eventId: event.id,
        });
      }
      for (const task of await tx.select().from(eventTasks).where(inArray(eventTasks.eventId, ids)).orderBy(asc(eventTasks.dueDate))) {
        records.push({
          module: MODULE,
          kind: "task",
          recordId: task.id,
          label: task.label,
          fields: compact({ dueDate: task.dueDate, responsible: task.responsible, done: task.doneAt ? "true" : "false", ...importedFieldsOf(task.importedFields) }),
          eventId: task.eventId,
        });
      }
      for (const slot of await tx.select().from(eventVendorSlots).where(inArray(eventVendorSlots.eventId, ids)).orderBy(asc(eventVendorSlots.position))) {
        records.push({
          module: MODULE,
          kind: "event_vendor_slot",
          recordId: slot.id,
          label: slot.label,
          fields: compact({ status: slot.status, vendorName: slot.vendorName, ...importedFieldsOf(slot.importedFields) }),
          eventId: slot.eventId,
        });
      }
      records.push(...(await candidateRecords(tx, ids, null)));
      for (const item of await tx.select().from(programItems).where(inArray(programItems.eventId, ids))) {
        records.push({ module: MODULE, kind: "program_item", recordId: item.id, label: item.label, fields: compact({ location: item.location, internalNote: item.internalNote }), eventId: item.eventId });
      }
      for (const place of await tx.select().from(eventPlaces).where(inArray(eventPlaces.eventId, ids)).orderBy(asc(eventPlaces.position))) {
        records.push({ module: MODULE, kind: "event_place", recordId: place.id, label: place.label, fields: compact({ address: place.address }), eventId: place.eventId });
      }
      for (const access of await tx.select().from(eventClientAccesses).where(inArray(eventClientAccesses.eventId, ids))) {
        records.push({ module: MODULE, kind: "client_access", recordId: access.id, label: access.email, fields: { email: access.email }, eventId: access.eventId });
      }
      for (const change of await tx.select().from(eventStatusHistory).where(inArray(eventStatusHistory.eventId, ids)).orderBy(asc(eventStatusHistory.changedAt))) {
        records.push({
          module: MODULE,
          kind: "status_change",
          recordId: change.id,
          label: change.toStatus,
          fields: compact({ fromStatus: change.fromStatus, toStatus: change.toStatus, changedAt: change.changedAt.toISOString() }),
          eventId: change.eventId,
        });
      }
      return records;
    });
  },
};
