// Implémentation du contrat privacy/v1 pour le module hello (SOC-07).
// hello.greetings n'a pas de champ réellement personnel au sens RGPD ;
// "message" est traité ici comme du texte libre pouvant mentionner une
// personne, pour exercer le contrat de bout en bout (recherche, export,
// anonymisation, suppression, sous RLS). Les modules métier (events,
// budget, quotes) implémenteront une recherche par e-mail/téléphone réelle
// à leur lot respectif.
import { eq, ilike } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { greetings } from "@symbola/db/schema/hello";
import { withOrganization } from "@symbola/db/with-organization";
import type { PersonQuery, PrivacyContractV1 } from "@symbola/privacy";

async function find(query: PersonQuery) {
  const { sql, db } = createAppConnection();
  try {
    const rows = await withOrganization(db, query.organizationId, (tx) =>
      tx
        .select()
        .from(greetings)
        .where(ilike(greetings.message, `%${query.term}%`)),
    );
    return rows.map((row) => ({ recordId: row.id, summary: row.message }));
  } finally {
    await sql.end();
  }
}

export const helloPrivacy: PrivacyContractV1 = {
  find,

  async export(query) {
    return { module: "hello", records: await find(query) };
  },

  async anonymize(query) {
    const { sql, db } = createAppConnection();
    try {
      const affected = await withOrganization(db, query.organizationId, async (tx) => {
        const matches = await tx
          .select({ id: greetings.id })
          .from(greetings)
          .where(ilike(greetings.message, `%${query.term}%`));

        for (const row of matches) {
          await tx.update(greetings).set({ message: "[anonymisé]" }).where(eq(greetings.id, row.id));
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
      const deleted = await withOrganization(db, query.organizationId, (tx) =>
        tx
          .delete(greetings)
          .where(ilike(greetings.message, `%${query.term}%`))
          .returning(),
      );
      return { affected: deleted.length };
    } finally {
      await sql.end();
    }
  },
};
