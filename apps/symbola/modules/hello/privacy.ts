// Contrat privacy/v1 du module hello (SOC-07, révisé au lot 6 : ADR 0023).
// hello.greetings n'a pas de champ réellement personnel ; "message" est
// traité comme du texte libre pouvant mentionner une personne, pour exercer
// le contrat de bout en bout, sous RLS.
import { createAppConnection } from "@symbola/db/client";
import { greetings } from "@symbola/db/schema/hello";
import { withOrganization } from "@symbola/db/with-organization";
import { hasTerms, prepareTerms, recordMatches, type PrivacyContractV1 } from "@symbola/privacy";

export const helloPrivacy: PrivacyContractV1 = {
  module: "hello",

  async find({ organizationId, terms: rawTerms }) {
    const terms = prepareTerms(rawTerms);
    if (!hasTerms(terms)) return [];
    const { sql, db } = createAppConnection();
    try {
      const rows = await withOrganization(db, organizationId, (tx) => tx.select().from(greetings));
      return rows
        .filter((row) => recordMatches([row.message], terms))
        .map((row) => ({ module: "hello", kind: "greeting", recordId: row.id, label: row.message, fields: { message: row.message }, eventId: null }));
    } finally {
      await sql.end();
    }
  },

  async related() {
    return [];
  },
};
