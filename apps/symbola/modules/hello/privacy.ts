// Contrat privacy/v1 du module hello (SOC-07, révisé au lot 6 : ADR 0023).
// hello.greetings n'a pas de champ réellement personnel ; "message" est
// traité comme du texte libre pouvant mentionner une personne, pour exercer
// le contrat de bout en bout, sous RLS.
import { inArray } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { greetings } from "@symbola/db/schema/hello";
import { withOrganization } from "@symbola/db/with-organization";
import { hasTerms, idsOfKind, prepareTerms, recordMatches, type ErasureInput, type ErasurePlanItem, type PrivacyContractV1 } from "@symbola/privacy";

// RGPD-03 : un message est supprimé (texte libre, aucune statistique à garder).
async function greetingsPlan(input: ErasureInput, execute: boolean): Promise<ErasurePlanItem[]> {
  const ids = idsOfKind(input.records, "greeting");
  if (ids.length === 0) return [];
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, input.organizationId, async (tx) => {
      const rows = await tx.select({ id: greetings.id }).from(greetings).where(inArray(greetings.id, ids));
      if (execute && rows.length > 0) await tx.delete(greetings).where(inArray(greetings.id, rows.map((row) => row.id)));
      return rows.map((row) => ({ kind: "greeting", recordId: row.id, fate: "deleted" as const, legalBasis: null, keptUntil: null }));
    });
  } finally {
    await sql.end();
  }
}

export const helloPrivacy: PrivacyContractV1 = {
  module: "hello",

  planErasure: (input) => greetingsPlan(input, false),
  erase: (input) => greetingsPlan(input, true),

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
