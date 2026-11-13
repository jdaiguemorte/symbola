// Contrat privacy/v1 du module quotes (lot 6, ADR 0023). Champs personnels
// (privacy.registry.yaml) : signataires d'un devis (nom, e-mail, adresse de
// facturation), lot 31b : texte des contrats et actes des signataires,
// acheteurs copiés sur les factures et avoirs, descriptions
// libres des lignes de devis, champs libres importés du catalogue. Les
// coordonnées de la planner (copie vendeur) ne sont pas cherchées : elles
// sont celles de l'organisation. Jamais de document d'essai (ADR 0008).
import { and, asc, eq, inArray } from "drizzle-orm";
import type { InvoiceBuyer } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { catalogItems, contracts, contractSignerActs, creditNotes, earnestReceipts, invoices, quoteLines, quotes, quoteSigners, quoteVersions, signatureRequests } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import { hasTerms, prepareTerms, recordMatches, type PrivacyContractV1, type PrivacyRecord } from "@symbola/privacy";
import { eraseQuotesData, planQuotesErasure } from "./privacy-erasure";

const MODULE = "quotes";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

function buyersOf(snapshot: unknown): InvoiceBuyer[] {
  return Array.isArray(snapshot) ? (snapshot as InvoiceBuyer[]) : [];
}

function buyerFields(buyers: InvoiceBuyer[]): Record<string, string> {
  return Object.fromEntries(
    buyers.flatMap((buyer, index) => [
      [`buyer${index + 1}Name`, buyer.name],
      [`buyer${index + 1}BillingAddress`, buyer.billingAddress],
    ]),
  );
}

// Devis réels de l'organisation, avec l'événement de chacun.
async function realQuotes(tx: Tx, eventIds?: string[]) {
  const condition = eventIds ? and(eq(quotes.isDemo, false), inArray(quotes.eventId, eventIds)) : eq(quotes.isDemo, false);
  return tx.select().from(quotes).where(condition).orderBy(asc(quotes.createdAt));
}

export const quotesPrivacy: PrivacyContractV1 = {
  module: MODULE,

  // RGPD-03 — oubli (privacy-erasure.ts).
  planErasure: planQuotesErasure,
  erase: eraseQuotesData,

  async find({ organizationId, terms: rawTerms }) {
    const terms = prepareTerms(rawTerms);
    if (!hasTerms(terms)) return [];
    return inOrganization(organizationId, async (tx) => {
      const records: PrivacyRecord[] = [];
      const quoteRows = await realQuotes(tx);
      const quoteById = new Map(quoteRows.map((quote) => [quote.id, quote]));
      const versions = quoteRows.length > 0 ? await tx.select().from(quoteVersions).where(inArray(quoteVersions.quoteId, [...quoteById.keys()])) : [];
      const versionQuote = new Map(versions.map((version) => [version.id, quoteById.get(version.quoteId)]));

      if (versions.length > 0) {
        const requests = await tx.select().from(signatureRequests).where(inArray(signatureRequests.versionId, [...versionQuote.keys()]));
        const requestQuote = new Map(requests.map((request) => [request.id, versionQuote.get(request.versionId)]));
        if (requests.length > 0) {
          for (const signer of await tx.select().from(quoteSigners).where(inArray(quoteSigners.requestId, [...requestQuote.keys()]))) {
            if (!recordMatches([signer.name, signer.email, signer.billingAddress], terms)) continue;
            const quote = requestQuote.get(signer.requestId);
            records.push({
              module: MODULE,
              kind: "quote_signer",
              recordId: signer.id,
              label: `${quote?.number ?? ""} — ${signer.name}`,
              fields: { name: signer.name, email: signer.email, billingAddress: signer.billingAddress },
              eventId: quote?.eventId ?? null,
            });
          }
        }
        // Lot 31a (FAC-01, D2) : qui a choisi les options (le client, nommé).
        for (const version of versions) {
          if (!version.optionsChosenBy || !recordMatches([version.optionsChosenBy], terms)) continue;
          const quote = versionQuote.get(version.id);
          records.push({
            module: MODULE,
            kind: "quote_options_choice",
            recordId: version.id,
            label: `${quote?.number ?? ""} V${version.version} — ${version.optionsChosenBy}`,
            fields: { chosenBy: version.optionsChosenBy },
            eventId: quote?.eventId ?? null,
          });
        }
        // Lot 31b : contrats (leur texte nomme les clients) et actes des signataires.
        const contractRows = await tx.select().from(contracts).where(inArray(contracts.quoteVersionId, [...versionQuote.keys()]));
        for (const contract of contractRows) {
          if (!recordMatches(contract.clauses.map((clause) => clause.body), terms)) continue;
          const quote = versionQuote.get(contract.quoteVersionId);
          records.push({
            module: MODULE,
            kind: "contract",
            recordId: contract.id,
            label: `${quote?.number ?? ""} — ${contract.title} V${contract.version}`,
            fields: Object.fromEntries(contract.clauses.map((clause, index) => [`clause${index + 1}`, `${clause.title} : ${clause.body}`])),
            eventId: quote?.eventId ?? null,
          });
        }
        if (contractRows.length > 0) {
          const contractQuote = new Map(contractRows.map((contract) => [contract.id, versionQuote.get(contract.quoteVersionId)]));
          for (const act of await tx.select().from(contractSignerActs).where(inArray(contractSignerActs.contractId, [...contractQuote.keys()]))) {
            if (!recordMatches([act.signerName], terms)) continue;
            const quote = contractQuote.get(act.contractId);
            records.push({
              module: MODULE,
              kind: "contract_signer_act",
              recordId: act.id,
              label: `${quote?.number ?? ""} — ${act.signerName}`,
              fields: { signerName: act.signerName, kind: act.kind, actedAt: act.actedAt.toISOString() },
              eventId: quote?.eventId ?? null,
            });
          }
        }
        for (const line of await tx.select().from(quoteLines).where(inArray(quoteLines.versionId, [...versionQuote.keys()]))) {
          if (!recordMatches([line.description], terms)) continue;
          const quote = versionQuote.get(line.versionId);
          records.push({
            module: MODULE,
            kind: "quote_line",
            recordId: line.id,
            label: `${quote?.number ?? ""} — ${line.label}`,
            fields: { description: line.description ?? "" },
            eventId: quote?.eventId ?? null,
          });
        }
      }

      const invoiceRows = await tx.select().from(invoices).where(eq(invoices.isDemo, false));
      for (const invoice of invoiceRows) {
        const buyers = buyersOf(invoice.buyerSnapshot);
        if (!buyers.some((buyer) => recordMatches([buyer.name, buyer.billingAddress], terms))) continue;
        records.push({
          module: MODULE,
          kind: "invoice",
          recordId: invoice.id,
          label: invoice.number,
          fields: buyerFields(buyers),
          eventId: quoteById.get(invoice.quoteId)?.eventId ?? null,
        });
      }
      const invoiceQuote = new Map(invoiceRows.map((invoice) => [invoice.id, invoice.quoteId]));
      for (const note of await tx.select().from(creditNotes).where(eq(creditNotes.isDemo, false))) {
        const buyers = buyersOf(note.buyerSnapshot);
        if (!buyers.some((buyer) => recordMatches([buyer.name, buyer.billingAddress], terms))) continue;
        records.push({
          module: MODULE,
          kind: "credit_note",
          recordId: note.id,
          label: note.number,
          fields: buyerFields(buyers),
          eventId: quoteById.get(invoiceQuote.get(note.invoiceId) ?? "")?.eventId ?? null,
        });
      }
      // Lot 31c (D21) : reçus d'arrhes, aux noms des clients.
      for (const receipt of await tx.select().from(earnestReceipts).where(eq(earnestReceipts.isDemo, false))) {
        const buyers = buyersOf(receipt.buyerSnapshot);
        if (!buyers.some((buyer) => recordMatches([buyer.name, buyer.billingAddress], terms))) continue;
        records.push({
          module: MODULE,
          kind: "earnest_receipt",
          recordId: receipt.id,
          label: receipt.number,
          fields: buyerFields(buyers),
          eventId: quoteById.get(receipt.quoteId)?.eventId ?? null,
        });
      }

      for (const item of await tx.select().from(catalogItems)) {
        const values = Object.entries(item.importedFields ?? {}).map(([name, value]) => `${name} ${value}`);
        if (!recordMatches(values, terms)) continue;
        records.push({
          module: MODULE,
          kind: "catalog_item",
          recordId: item.id,
          label: item.label,
          fields: Object.fromEntries(Object.entries(item.importedFields ?? {}).map(([name, value]) => [`imported:${name}`, value])),
          eventId: null,
        });
      }
      return records;
    });
  },

  // Devis, factures et avoirs des événements de la personne.
  async related({ organizationId, eventIds }) {
    if (eventIds.length === 0) return [];
    return inOrganization(organizationId, async (tx) => {
      const records: PrivacyRecord[] = [];
      const quoteRows = await realQuotes(tx, eventIds);
      if (quoteRows.length === 0) return [];
      const quoteById = new Map(quoteRows.map((quote) => [quote.id, quote]));
      for (const quote of quoteRows) {
        records.push({ module: MODULE, kind: "quote", recordId: quote.id, label: quote.number, fields: { number: quote.number, status: quote.status }, eventId: quote.eventId });
      }
      // Lot 31b : contrats des devis de ces événements.
      for (const contract of await tx.select().from(contracts).where(inArray(contracts.quoteId, [...quoteById.keys()]))) {
        records.push({
          module: MODULE,
          kind: "contract",
          recordId: contract.id,
          label: `${quoteById.get(contract.quoteId)?.number ?? ""} — ${contract.title} V${contract.version}`,
          fields: { title: contract.title, version: String(contract.version), generatedAt: contract.generatedAt.toISOString() },
          eventId: quoteById.get(contract.quoteId)?.eventId ?? null,
        });
      }
      const invoiceRows = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.isDemo, false), inArray(invoices.quoteId, [...quoteById.keys()])));
      for (const invoice of invoiceRows) {
        records.push({
          module: MODULE,
          kind: "invoice",
          recordId: invoice.id,
          label: invoice.number,
          fields: { number: invoice.number, issuedOn: invoice.issuedOn, amountCents: String(invoice.amountCents), ...buyerFields(buyersOf(invoice.buyerSnapshot)) },
          eventId: quoteById.get(invoice.quoteId)?.eventId ?? null,
        });
      }
      if (invoiceRows.length > 0) {
        const invoiceQuote = new Map(invoiceRows.map((invoice) => [invoice.id, invoice.quoteId]));
        for (const note of await tx.select().from(creditNotes).where(inArray(creditNotes.invoiceId, [...invoiceQuote.keys()]))) {
          if (note.isDemo) continue;
          records.push({
            module: MODULE,
            kind: "credit_note",
            recordId: note.id,
            label: note.number,
            fields: { number: note.number, issuedOn: note.issuedOn, amountCents: String(note.amountCents), reason: note.reason, ...buyerFields(buyersOf(note.buyerSnapshot)) },
            eventId: quoteById.get(invoiceQuote.get(note.invoiceId) ?? "")?.eventId ?? null,
          });
        }
      }
      // Lot 31c (D21) : reçus d'arrhes des devis de ces événements.
      for (const receipt of await tx
        .select()
        .from(earnestReceipts)
        .where(and(eq(earnestReceipts.isDemo, false), inArray(earnestReceipts.quoteId, [...quoteById.keys()])))) {
        records.push({
          module: MODULE,
          kind: "earnest_receipt",
          recordId: receipt.id,
          label: receipt.number,
          fields: { number: receipt.number, issuedOn: receipt.issuedOn, amountCents: String(receipt.amountCents), ...buyerFields(buyersOf(receipt.buyerSnapshot)) },
          eventId: quoteById.get(receipt.quoteId)?.eventId ?? null,
        });
      }
      return records;
    });
  },
};
