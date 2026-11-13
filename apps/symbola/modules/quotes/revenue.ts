// Lot 32a (FAC-12 ; décision D8) — lecture des trois chiffres d'une période, sous RLS, sans les
// essais : devis signés (TTC de la version signée, à la date de fin de la signature), factures et
// avoirs (à leur date d'émission), encaissements et annulations (à la date du paiement : une
// annulation retire l'encaissement de sa période). Jamais importé hors de modules/quotes/.
import { and, between, eq, inArray, ne } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { creditNotes, invoices, paymentEntries, quotes, quoteVersions, signatureRequests } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";

export type RevenueTotals = { signedCents: number; invoicedCents: number; collectedCents: number };

// Jour (AAAA-MM-JJ) d'un instant, à Paris.
function parisDay(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

export async function findRevenue(organizationId: string, from: string, to: string): Promise<RevenueTotals> {
  return await withOrganization(appDatabase(), organizationId, async (tx) => {
    const signed = await tx
      .select({ totals: quoteVersions.totalsSnapshot, completedAt: signatureRequests.completedAt })
      .from(quotes)
      .innerJoin(quoteVersions, and(eq(quoteVersions.quoteId, quotes.id), eq(quoteVersions.version, quotes.currentVersion)))
      .innerJoin(signatureRequests, and(eq(signatureRequests.versionId, quoteVersions.id), ne(signatureRequests.kind, "contract"), eq(signatureRequests.status, "completed")))
      .where(and(eq(quotes.status, "signed"), eq(quotes.isDemo, false)));
    const signedCents = signed
      .filter((row) => row.completedAt !== null && parisDay(row.completedAt) >= from && parisDay(row.completedAt) <= to)
      .reduce((sum, row) => sum + ((row.totals as { totalTtcCents?: number } | null)?.totalTtcCents ?? 0), 0);

    const issued = await tx
      .select({ amountCents: invoices.amountCents })
      .from(invoices)
      .where(and(eq(invoices.isDemo, false), between(invoices.issuedOn, from, to)));
    const credited = await tx
      .select({ amountCents: creditNotes.amountCents })
      .from(creditNotes)
      .where(and(eq(creditNotes.isDemo, false), between(creditNotes.issuedOn, from, to)));
    const invoicedCents = issued.reduce((sum, row) => sum + row.amountCents, 0) - credited.reduce((sum, row) => sum + row.amountCents, 0);

    const received = await tx
      .select({ id: paymentEntries.id, amountCents: paymentEntries.amountCents })
      .from(paymentEntries)
      .where(and(eq(paymentEntries.isDemo, false), eq(paymentEntries.kind, "received"), between(paymentEntries.paidOn, from, to)));
    const reversed =
      received.length > 0
        ? await tx
            .select({ amountCents: paymentEntries.amountCents })
            .from(paymentEntries)
            .where(and(eq(paymentEntries.kind, "reversal"), inArray(paymentEntries.reversesEntryId, received.map((row) => row.id))))
        : [];
    const collectedCents = received.reduce((sum, row) => sum + row.amountCents, 0) - reversed.reduce((sum, row) => sum + row.amountCents, 0);

    return { signedCents, invoicedCents, collectedCents };
  });
}
