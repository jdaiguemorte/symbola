// Implémentation du contrat privacy/v1 pour le module events (SOC-07).
// Champs personnels du module : prénom/nom des clients (event_clients,
// EVT-01/02/07) et nom du prestataire d'un poste (event_vendor_slots,
// EVT-03 : un prestataire indépendant est une personne).
import { ilike, or } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { eventClients, eventVendorSlots } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { PersonQuery, PrivacyContractV1 } from "@symbola/privacy";


function fullName(firstName: string, lastName: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName;
}

function clientMatch(term: string) {
  return or(ilike(eventClients.firstName, term), ilike(eventClients.lastName, term));
}

function vendorMatch(term: string) {
  return ilike(eventVendorSlots.vendorName, term);
}

async function find(query: PersonQuery) {
  const { sql, db } = createAppConnection();
  try {
    const term = `%${query.term}%`;
    return await withOrganization(db, query.organizationId, async (tx) => {
      const clients = await tx.select().from(eventClients).where(clientMatch(term));
      const vendors = await tx.select().from(eventVendorSlots).where(vendorMatch(term));
      return [
        ...clients.map((row) => ({ recordId: row.id, summary: fullName(row.firstName, row.lastName) })),
        ...vendors.map((row) => ({ recordId: row.id, summary: `${row.vendorName ?? ""} (${row.label})` })),
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
        return clients.length + vendors.length;
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
        return clients.length + vendors.length;
      });
      return { affected };
    } finally {
      await sql.end();
    }
  },
};
