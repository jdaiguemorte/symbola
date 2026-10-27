// Implémentation du contrat privacy/v1 pour le module events (SOC-07).
// Recherche par prénom/nom (event_clients) — les seuls champs
// personnels du module à ce lot (EVT-01/02/07).
import { eq, ilike, or } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { eventClients } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { PersonQuery, PrivacyContractV1 } from "@symbola/privacy";

function fullName(firstName: string, lastName: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName;
}

async function find(query: PersonQuery) {
  const { sql, db } = createAppConnection();
  try {
    const term = `%${query.term}%`;
    const rows = await withOrganization(db, query.organizationId, (tx) =>
      tx
        .select()
        .from(eventClients)
        .where(or(ilike(eventClients.firstName, term), ilike(eventClients.lastName, term))),
    );
    return rows.map((row) => ({ recordId: row.id, summary: fullName(row.firstName, row.lastName) }));
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
        const matches = await tx
          .select({ id: eventClients.id })
          .from(eventClients)
          .where(or(ilike(eventClients.firstName, term), ilike(eventClients.lastName, term)));

        for (const row of matches) {
          await tx
            .update(eventClients)
            .set({ firstName: "[anonymisé]", lastName: null })
            .where(eq(eventClients.id, row.id));
        }
        return matches.length;
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
      const deleted = await withOrganization(db, query.organizationId, (tx) =>
        tx
          .delete(eventClients)
          .where(or(ilike(eventClients.firstName, term), ilike(eventClients.lastName, term)))
          .returning(),
      );
      return { affected: deleted.length };
    } finally {
      await sql.end();
    }
  },
};
