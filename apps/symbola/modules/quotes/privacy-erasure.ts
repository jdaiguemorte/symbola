// RGPD-03 — oubli dans le module quotes (ADR 0023, registre de données).
// - Factures et avoirs : conservés (obligation comptable), jamais modifiés
//   (ADR 0010) ; anonymisés au terme par la purge (RGPD-05).
// - Devis signé (demande de signature terminée) : signataires et lignes
//   conservés comme preuve du contrat, le temps réglé par l'organisation
//   (5 ans par défaut, décision de Julien du 02/11/2026, à valider par un
//   juriste).
// - RGPD-05 : à la date de fin, la conservation cesse : acheteurs des
//   factures et avoirs anonymisés (seule exception au verrou d'immuabilité,
//   ADR 0024), devis signé anonymisé et documents signés supprimés du stockage.
// - Devis non signé : signataires et descriptions libres anonymisés ;
//   numéros, intitulés et montants restent (statistiques).
// - Catalogue : champs libres importés effacés.
import { and, eq, inArray, isNotNull, sql as rawSql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { catalogItems, creditNotes, invoices, quoteLines, quotes, quoteSigners, quoteVersions, signatureRequests } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import type { InvoiceBuyer } from "@symbola/contracts";
import { createStorageClient, deletePrivateObject } from "@symbola/files";
import { addMonths, ANONYMIZED, anonymizedEmail, idsOfKind, isExpired, parisDate, type ErasureInput, type ErasurePlanItem } from "@symbola/privacy";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

type Plan = {
  items: ErasurePlanItem[];
  // Ce que l'exécution modifie (fiches anonymisées seulement).
  signerIds: string[];
  lineIds: string[];
  // Lot 31a : versions dont le nom de qui a choisi les options s'efface.
  choiceVersionIds: string[];
  catalogItemIds: string[];
  // RGPD-05 : documents arrivés au terme de leur conservation.
  invoiceIds: string[];
  creditNoteIds: string[];
  expiredRequestIds: string[];
};

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

async function buildPlan(tx: Tx, input: ErasureInput): Promise<Plan> {
  const plan: Plan = { items: [], signerIds: [], lineIds: [], choiceVersionIds: [], catalogItemIds: [], invoiceIds: [], creditNoteIds: [], expiredRequestIds: [] };
  const anonymized = (kind: string, recordId: string) => plan.items.push({ kind, recordId, fate: "anonymized", legalBasis: null, keptUntil: null });

  // Factures et avoirs réels : conservés dix ans (réglage) à compter de l'émission.
  const invoiceIds = idsOfKind(input.records, "invoice");
  if (invoiceIds.length > 0) {
    for (const invoice of await tx.select().from(invoices).where(inArray(invoices.id, invoiceIds))) {
      if (invoice.isDemo) continue;
      const until = addMonths(invoice.issuedOn, input.rules.accountingRetentionMonths);
      if (isExpired(input.today, until)) {
        plan.invoiceIds.push(invoice.id);
        anonymized("invoice", invoice.id);
      } else plan.items.push({ kind: "invoice", recordId: invoice.id, fate: "kept", legalBasis: "accounting", keptUntil: until });
    }
  }
  const creditNoteIds = idsOfKind(input.records, "credit_note");
  if (creditNoteIds.length > 0) {
    for (const note of await tx.select().from(creditNotes).where(inArray(creditNotes.id, creditNoteIds))) {
      if (note.isDemo) continue;
      const until = addMonths(note.issuedOn, input.rules.accountingRetentionMonths);
      if (isExpired(input.today, until)) {
        plan.creditNoteIds.push(note.id);
        anonymized("credit_note", note.id);
      } else plan.items.push({ kind: "credit_note", recordId: note.id, fate: "kept", legalBasis: "accounting", keptUntil: until });
    }
  }

  // Devis réels concernés : désignés directement, ou par leurs signataires et lignes.
  const quoteIds = idsOfKind(input.records, "quote");
  const signerIds = idsOfKind(input.records, "quote_signer");
  const lineIds = idsOfKind(input.records, "quote_line");
  const choiceIds = idsOfKind(input.records, "quote_options_choice");
  if (quoteIds.length + signerIds.length + lineIds.length + choiceIds.length > 0) {
    const realQuotes = await tx.select({ id: quotes.id }).from(quotes).where(eq(quotes.isDemo, false));
    const realQuoteIds = new Set(realQuotes.map((quote) => quote.id));
    const versions = realQuoteIds.size > 0 ? await tx.select({ id: quoteVersions.id, quoteId: quoteVersions.quoteId }).from(quoteVersions).where(inArray(quoteVersions.quoteId, [...realQuoteIds])) : [];
    const versionQuote = new Map(versions.map((version) => [version.id, version.quoteId]));
    const requests = versions.length > 0 ? await tx.select().from(signatureRequests).where(inArray(signatureRequests.versionId, [...versionQuote.keys()])) : [];
    // Fin de la preuve d'une version signée : signature + durée réglée.
    const proofUntil = new Map<string, string>();
    const expiredRequests: (typeof requests)[number][] = [];
    for (const request of requests) {
      if (request.status !== "completed") continue;
      const until = addMonths(parisDate(request.completedAt ?? request.createdAt), input.rules.signedQuoteRetentionMonths);
      // Preuve échue : le devis signé est traité comme un devis non signé.
      if (isExpired(input.today, until)) expiredRequests.push(request);
      else proofUntil.set(request.versionId, until);
    }
    const requestVersion = new Map(requests.map((request) => [request.id, request.versionId]));
    const quoteProofUntil = (quoteId: string) =>
      [...proofUntil.entries()]
        .filter(([versionId]) => versionQuote.get(versionId) === quoteId)
        .map(([, until]) => until)
        .sort()
        .at(-1) ?? null;

    // Signataires et lignes à traiter : ceux désignés, plus ceux des devis désignés.
    const designatedQuotes = quoteIds.filter((id) => realQuoteIds.has(id));
    const quoteVersionIds = versions.filter((version) => designatedQuotes.includes(version.quoteId)).map((version) => version.id);
    const quoteRequestIds = requests.filter((request) => quoteVersionIds.includes(request.versionId)).map((request) => request.id);
    const signers =
      requests.length > 0
        ? await tx
            .select({ id: quoteSigners.id, requestId: quoteSigners.requestId })
            .from(quoteSigners)
            .where(inArray(quoteSigners.requestId, requests.map((request) => request.id)))
        : [];
    const lines =
      versions.length > 0
        ? await tx.select({ id: quoteLines.id, versionId: quoteLines.versionId, description: quoteLines.description }).from(quoteLines).where(inArray(quoteLines.versionId, [...versionQuote.keys()]))
        : [];

    // Documents signés d'une preuve échue (PDF signé, certificat) : supprimés.
    for (const request of expiredRequests) {
      const concerned = quoteRequestIds.includes(request.id) || signers.some((signer) => signer.requestId === request.id && signerIds.includes(signer.id));
      if (concerned && (request.signedDocumentKey || request.auditCertificateKey)) plan.expiredRequestIds.push(request.id);
    }
    for (const quoteId of designatedQuotes) {
      const until = quoteProofUntil(quoteId);
      if (until) plan.items.push({ kind: "quote", recordId: quoteId, fate: "kept", legalBasis: "contract_proof", keptUntil: until });
      else anonymized("quote", quoteId);
    }
    for (const signer of signers) {
      if (!signerIds.includes(signer.id) && !quoteRequestIds.includes(signer.requestId)) continue;
      const until = proofUntil.get(requestVersion.get(signer.requestId) ?? "");
      if (until) {
        if (signerIds.includes(signer.id)) plan.items.push({ kind: "quote_signer", recordId: signer.id, fate: "kept", legalBasis: "contract_proof", keptUntil: until });
        continue;
      }
      plan.signerIds.push(signer.id);
      if (signerIds.includes(signer.id)) anonymized("quote_signer", signer.id);
    }
    for (const line of lines) {
      if (!lineIds.includes(line.id) && !quoteVersionIds.includes(line.versionId)) continue;
      const until = proofUntil.get(line.versionId);
      if (until) {
        if (lineIds.includes(line.id)) plan.items.push({ kind: "quote_line", recordId: line.id, fate: "kept", legalBasis: "contract_proof", keptUntil: until });
        continue;
      }
      if (line.description !== null) plan.lineIds.push(line.id);
      if (lineIds.includes(line.id)) anonymized("quote_line", line.id);
    }
    // Lot 31a : le nom de qui a choisi les options, gardé comme preuve d'un devis signé.
    for (const versionId of versionQuote.keys()) {
      if (!choiceIds.includes(versionId) && !quoteVersionIds.includes(versionId)) continue;
      const until = proofUntil.get(versionId);
      if (until) {
        if (choiceIds.includes(versionId)) plan.items.push({ kind: "quote_options_choice", recordId: versionId, fate: "kept", legalBasis: "contract_proof", keptUntil: until });
        continue;
      }
      plan.choiceVersionIds.push(versionId);
      if (choiceIds.includes(versionId)) anonymized("quote_options_choice", versionId);
    }
  }

  const catalogIds = idsOfKind(input.records, "catalog_item");
  if (catalogIds.length > 0) {
    for (const item of await tx.select({ id: catalogItems.id }).from(catalogItems).where(inArray(catalogItems.id, catalogIds))) {
      plan.catalogItemIds.push(item.id);
      anonymized("catalog_item", item.id);
    }
  }
  return plan;
}

export async function planQuotesErasure(input: ErasureInput): Promise<ErasurePlanItem[]> {
  return inOrganization(input.organizationId, async (tx) => (await buildPlan(tx, input)).items);
}

export async function eraseQuotesData(input: ErasureInput): Promise<ErasurePlanItem[]> {
  const result = await inOrganization(input.organizationId, async (tx) => {
    const plan = await buildPlan(tx, input);
    // E-mail de remplacement propre à chaque signataire (aucun lien entre eux).
    for (const signerId of plan.signerIds) {
      await tx.update(quoteSigners).set({ name: ANONYMIZED, email: anonymizedEmail(), billingAddress: ANONYMIZED, signingUrl: "" }).where(eq(quoteSigners.id, signerId));
    }
    if (plan.lineIds.length > 0) await tx.update(quoteLines).set({ description: ANONYMIZED }).where(inArray(quoteLines.id, plan.lineIds));
    if (plan.choiceVersionIds.length > 0) {
      await tx
        .update(quoteVersions)
        .set({ optionsChosenBy: ANONYMIZED })
        .where(and(inArray(quoteVersions.id, plan.choiceVersionIds), isNotNull(quoteVersions.optionsChosenBy)));
    }
    if (plan.catalogItemIds.length > 0) await tx.update(catalogItems).set({ importedFields: null }).where(inArray(catalogItems.id, plan.catalogItemIds));

    // RGPD-05 : fin de la conservation comptable. Seule la copie de
    // l'acheteur change, dans une transaction qui le déclare (ADR 0024).
    if (plan.invoiceIds.length + plan.creditNoteIds.length > 0) {
      await tx.execute(rawSql`SET LOCAL app.retention_anonymization = 'on'`);
      const anonymizedBuyers = (snapshot: unknown) =>
        (Array.isArray(snapshot) ? (snapshot as InvoiceBuyer[]) : []).map((buyer) => ({ ...buyer, name: ANONYMIZED, billingAddress: ANONYMIZED }));
      for (const invoice of plan.invoiceIds.length > 0 ? await tx.select().from(invoices).where(inArray(invoices.id, plan.invoiceIds)) : []) {
        await tx.update(invoices).set({ buyerSnapshot: anonymizedBuyers(invoice.buyerSnapshot) }).where(eq(invoices.id, invoice.id));
      }
      for (const note of plan.creditNoteIds.length > 0 ? await tx.select().from(creditNotes).where(inArray(creditNotes.id, plan.creditNoteIds)) : []) {
        await tx.update(creditNotes).set({ buyerSnapshot: anonymizedBuyers(note.buyerSnapshot) }).where(eq(creditNotes.id, note.id));
      }
    }
    return plan;
  });
  // Documents signés d'une preuve échue : fichiers retirés du stockage, puis
  // leurs clés effacées (une nouvelle exécution recommence sans risque).
  if (result.expiredRequestIds.length > 0) {
    const requests = await inOrganization(input.organizationId, (tx) => tx.select().from(signatureRequests).where(inArray(signatureRequests.id, result.expiredRequestIds)));
    const storage = createStorageClient();
    for (const request of requests) {
      for (const key of [request.signedDocumentKey, request.auditCertificateKey]) if (key) await deletePrivateObject(storage, key);
    }
    await inOrganization(input.organizationId, (tx) =>
      tx.update(signatureRequests).set({ signedDocumentKey: null, auditCertificateKey: null }).where(inArray(signatureRequests.id, result.expiredRequestIds)),
    );
  }
  return result.items;
}
