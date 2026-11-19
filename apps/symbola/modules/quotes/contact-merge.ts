// Lot 45 (CRM-07 ; D5 ; ADR 0090) — à réception de hub.contact.merged, le module quotes repointe ses
// références de la fiche absorbée vers la fiche gardée : signataires (le nom et l'adresse signés
// restent une copie figée, DAT-04) et acheteur entreprise d'un devis. Idempotent ; les devis à la
// corbeille suivent aussi. Exposé seulement par service.ts (ADR 0011).
import { count, eq, max } from "drizzle-orm";
import { includingDeleted } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { quoteSigners, quotes } from "@symbola/db/schema/quotes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function repointQuotesMergedContact(organizationId: string, absorbedContactId: string, keptContactId: string): Promise<number> {
  if (!UUID.test(absorbedContactId) || !UUID.test(keptContactId) || absorbedContactId === keptContactId) return 0;
  return includingDeleted(() =>
    withOrganization(appDatabase(), organizationId, async (tx) => {
      const signers = await tx.update(quoteSigners).set({ contactId: keptContactId }).where(eq(quoteSigners.contactId, absorbedContactId)).returning({ id: quoteSigners.id });
      const buyers = await tx.update(quotes).set({ buyerContactId: keptContactId }).where(eq(quotes.buyerContactId, absorbedContactId)).returning({ id: quotes.id });
      return signers.length + buyers.length;
    }),
  );
}

// L'écran de confirmation d'une fusion : les signatures demandées à ce contact.
export async function countContactSignatures(organizationId: string, contactId: string): Promise<number> {
  if (!UUID.test(contactId)) return 0;
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ value: count() }).from(quoteSigners).where(eq(quoteSigners.contactId, contactId)));
  return row?.value ?? 0;
}

// Lot 45 (CRM-06, D3) : la dernière signature d'un de ces contacts (une action du prospect, qui arrête
// ses relances).
export async function latestContactSignature(organizationId: string, contactIds: string[]): Promise<Date | null> {
  let latest: Date | null = null;
  for (const contactId of contactIds.filter((id) => UUID.test(id))) {
    const [row] = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ at: max(quoteSigners.signedAt) }).from(quoteSigners).where(eq(quoteSigners.contactId, contactId)));
    if (row?.at && (!latest || row.at > latest)) latest = row.at;
  }
  return latest;
}
