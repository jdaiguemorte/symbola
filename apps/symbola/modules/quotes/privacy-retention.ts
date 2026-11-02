// RGPD-05 — ce que la purge mensuelle (lib/privacy/purge.ts) doit savoir du
// module quotes : dernier encaissement de chaque événement (fin de la
// relation client) et documents arrivés au terme de leur conservation
// (factures et avoirs, devis signés), pas encore anonymisés. Jamais un
// document d'essai (ADR 0008).
import { and, eq, inArray, isNotNull, max } from "drizzle-orm";
import type { InvoiceBuyer } from "@symbola/contracts";
import { createAppConnection } from "@symbola/db/client";
import { creditNotes, invoices, paymentScheduleItems, quotes, quoteSigners, quoteVersions, signatureRequests } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import { addMonths, ANONYMIZED, isExpired, parisDate } from "@symbola/privacy";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, fn);
  } finally {
    await sql.end();
  }
}

// Dernier paiement enregistré sur les devis de chaque événement.
export async function lastPaymentDates(organizationId: string, eventIds: string[]): Promise<Map<string, string>> {
  if (eventIds.length === 0) return new Map();
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ eventId: quotes.eventId, paidOn: max(paymentScheduleItems.paidOn) })
      .from(paymentScheduleItems)
      .innerJoin(quoteVersions, eq(quoteVersions.id, paymentScheduleItems.versionId))
      .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
      .where(and(inArray(quotes.eventId, eventIds), eq(quotes.isDemo, false), isNotNull(paymentScheduleItems.paidOn)))
      .groupBy(quotes.eventId),
  );
  return new Map(rows.filter((row) => row.paidOn !== null).map((row) => [row.eventId, row.paidOn!]));
}

export type ExpiredDocument = { kind: "invoice" | "credit_note" | "quote"; id: string; number: string; dueOn: string };

function buyersAnonymized(snapshot: unknown): boolean {
  const buyers = Array.isArray(snapshot) ? (snapshot as InvoiceBuyer[]) : [];
  return buyers.every((buyer) => buyer.name === ANONYMIZED);
}

export async function listExpiredDocuments(
  organizationId: string,
  input: { accountingRetentionMonths: number; signedQuoteRetentionMonths: number; today: string },
): Promise<ExpiredDocument[]> {
  return inOrganization(organizationId, async (tx) => {
    const documents: ExpiredDocument[] = [];
    for (const invoice of await tx.select().from(invoices).where(eq(invoices.isDemo, false))) {
      const dueOn = addMonths(invoice.issuedOn, input.accountingRetentionMonths);
      if (isExpired(input.today, dueOn) && !buyersAnonymized(invoice.buyerSnapshot)) documents.push({ kind: "invoice", id: invoice.id, number: invoice.number, dueOn });
    }
    for (const note of await tx.select().from(creditNotes).where(eq(creditNotes.isDemo, false))) {
      const dueOn = addMonths(note.issuedOn, input.accountingRetentionMonths);
      if (isExpired(input.today, dueOn) && !buyersAnonymized(note.buyerSnapshot)) documents.push({ kind: "credit_note", id: note.id, number: note.number, dueOn });
    }
    const signed = await tx
      .select({ request: signatureRequests, quoteId: quotes.id, number: quotes.number })
      .from(signatureRequests)
      .innerJoin(quoteVersions, eq(quoteVersions.id, signatureRequests.versionId))
      .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
      .where(and(eq(signatureRequests.status, "completed"), eq(quotes.isDemo, false)));
    const requestIds = signed.map((row) => row.request.id);
    const signers = requestIds.length > 0 ? await tx.select().from(quoteSigners).where(inArray(quoteSigners.requestId, requestIds)) : [];
    for (const row of signed) {
      const dueOn = addMonths(parisDate(row.request.completedAt ?? row.request.createdAt), input.signedQuoteRetentionMonths);
      if (!isExpired(input.today, dueOn)) continue;
      const own = signers.filter((signer) => signer.requestId === row.request.id);
      const pending = own.some((signer) => signer.name !== ANONYMIZED) || row.request.signedDocumentKey !== null || row.request.auditCertificateKey !== null;
      if (pending && !documents.some((document) => document.kind === "quote" && document.id === row.quoteId)) documents.push({ kind: "quote", id: row.quoteId, number: row.number, dueOn });
    }
    return documents;
  });
}
