// Implémentation du contrat privacy/v1 pour le module events (SOC-07).
// Champs personnels du module : prénom/nom des clients (event_clients,
// EVT-01/02/07) et nom du prestataire d'un poste (event_vendor_slots,
// EVT-03 : un prestataire indépendant est une personne), intervenants
// libres et notes internes du programme du jour J (EVT-05 : un officiant,
// un témoin y sont nommés), e-mail d'invitation des mariés (EVT-06).
import { and, ilike, or, sql as raw, type SQL, type SQLWrapper } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import {
  eventClientAccesses,
  eventClients,
  events,
  eventVendorSlots,
  programItemParticipants,
  programItems,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { PersonQuery, PrivacyContractV1 } from "@symbola/privacy";


function fullName(firstName: string, lastName: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName;
}

// AIDE-02, ADR 0008 : les données d'un essai guidé (événement is_demo) sont
// fictives et n'entrent jamais dans une recherche RGPD.
function notDemo(eventId: SQLWrapper): SQL {
  return raw`${eventId} not in (select ${events.id} from ${events} where ${events.isDemo})`;
}

function clientMatch(term: string) {
  return and(or(ilike(eventClients.firstName, term), ilike(eventClients.lastName, term)), notDemo(eventClients.eventId));
}

function vendorMatch(term: string) {
  return and(ilike(eventVendorSlots.vendorName, term), notDemo(eventVendorSlots.eventId));
}

function participantMatch(term: string) {
  return and(
    ilike(programItemParticipants.freeLabel, term),
    raw`${programItemParticipants.programItemId} in (select ${programItems.id} from ${programItems} where ${notDemo(programItems.eventId)})`,
  );
}

function accessMatch(term: string) {
  return and(ilike(eventClientAccesses.email, term), notDemo(eventClientAccesses.eventId));
}

function noteMatch(term: string) {
  return and(ilike(programItems.internalNote, term), notDemo(programItems.eventId));
}

async function find(query: PersonQuery) {
  const { sql, db } = createAppConnection();
  try {
    const term = `%${query.term}%`;
    return await withOrganization(db, query.organizationId, async (tx) => {
      const clients = await tx.select().from(eventClients).where(clientMatch(term));
      const vendors = await tx.select().from(eventVendorSlots).where(vendorMatch(term));
      const participants = await tx.select().from(programItemParticipants).where(participantMatch(term));
      const notes = await tx.select().from(programItems).where(noteMatch(term));
      const accesses = await tx.select().from(eventClientAccesses).where(accessMatch(term));
      return [
        ...clients.map((row) => ({ recordId: row.id, summary: fullName(row.firstName, row.lastName) })),
        ...vendors.map((row) => ({ recordId: row.id, summary: `${row.vendorName ?? ""} (${row.label})` })),
        ...participants.map((row) => ({ recordId: row.id, summary: row.freeLabel ?? "" })),
        ...notes.map((row) => ({ recordId: row.id, summary: `${row.label} : ${row.internalNote ?? ""}` })),
        ...accesses.map((row) => ({ recordId: row.id, summary: row.email })),
      ];
    });
  } finally {
    await sql.end();
  }
}

export const eventsPrivacy: PrivacyContractV1 = {
  find,

  async export(query) {
    return { module: "events", records: await find(query) };
  },

  async anonymize(query) {
    const { sql, db } = createAppConnection();
    try {
      const term = `%${query.term}%`;
      const affected = await withOrganization(db, query.organizationId, async (tx) => {
        const clients = await tx
          .update(eventClients)
          .set({ firstName: "[anonymisé]", lastName: null })
          .where(clientMatch(term))
          .returning({ id: eventClients.id });
        const vendors = await tx
          .update(eventVendorSlots)
          .set({ vendorName: "[anonymisé]" })
          .where(vendorMatch(term))
          .returning({ id: eventVendorSlots.id });
        const participants = await tx
          .update(programItemParticipants)
          .set({ freeLabel: "[anonymisé]" })
          .where(participantMatch(term))
          .returning({ id: programItemParticipants.id });
        const notes = await tx
          .update(programItems)
          .set({ internalNote: "[anonymisé]" })
          .where(noteMatch(term))
          .returning({ id: programItems.id });
        // Un accès anonymisé est aussi retiré : l'e-mail ne permet plus d'inviter ni d'entrer.
        const accesses = await tx
          .update(eventClientAccesses)
          .set({ email: "[anonymisé]", tokenHash: null, revokedAt: new Date() })
          .where(accessMatch(term))
          .returning({ id: eventClientAccesses.id });
        return clients.length + vendors.length + participants.length + notes.length + accesses.length;
      });
      return { affected };
    } finally {
      await sql.end();
    }
  },

  async erase(query) {
    const { sql, db } = createAppConnection();
    try {
      const term = `%${query.term}%`;
      const affected = await withOrganization(db, query.organizationId, async (tx) => {
        const clients = await tx.delete(eventClients).where(clientMatch(term)).returning({ id: eventClients.id });
        // Le poste appartient à l'événement : seul le nom du prestataire est effacé.
        const vendors = await tx
          .update(eventVendorSlots)
          .set({ vendorName: null })
          .where(vendorMatch(term))
          .returning({ id: eventVendorSlots.id });
        // La ligne du programme reste : seuls l'intervenant libre et la note sont effacés.
        const participants = await tx
          .delete(programItemParticipants)
          .where(participantMatch(term))
          .returning({ id: programItemParticipants.id });
        const notes = await tx
          .update(programItems)
          .set({ internalNote: null })
          .where(noteMatch(term))
          .returning({ id: programItems.id });
        const accesses = await tx
          .delete(eventClientAccesses)
          .where(accessMatch(term))
          .returning({ id: eventClientAccesses.id });
        return clients.length + vendors.length + participants.length + notes.length + accesses.length;
      });
      return { affected };
    } finally {
      await sql.end();
    }
  },
};
