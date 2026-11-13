// Lot 31b (FAC-04, FAC-05, DOC-02, JUR-07, HUB-21 ; décisions D6, D7, D11 à D16) — accès aux
// modèles de contrat et à leurs clauses, aux acceptations de l'avertissement, aux contrats générés
// (figés, versionnés), aux actes des signataires (commande, exécution anticipée), aux dossiers de
// preuve et aux factures d'acompte à émettre d'elles-mêmes. Jamais importé hors de
// modules/quotes/ (ADR 0011).
import { and, asc, desc, eq, inArray, lte, ne, sql as raw } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { appendAudit } from "@symbola/db/audit";
import {
  contractEvidence,
  contracts,
  contractSignerActs,
  contractTemplateAcceptances,
  contractTemplateClauses,
  contractTemplates,
  paymentScheduleItems,
  quoteSigners,
  quotes,
  quoteVersions,
  scheduledDepositInvoices,
  signatureRequests,
  type ContractClauseSnapshot,
} from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

export type ContractTemplateRow = typeof contractTemplates.$inferSelect;
export type ContractTemplateClauseRow = typeof contractTemplateClauses.$inferSelect;
export type ContractRow = typeof contracts.$inferSelect;
export type ContractSignerActRow = typeof contractSignerActs.$inferSelect;
export type ContractEvidenceRow = typeof contractEvidence.$inferSelect;
export type ScheduledDepositRow = typeof scheduledDepositInvoices.$inferSelect;
export type ClauseData = Pick<ContractTemplateClauseRow, "title" | "body" | "optional" | "role">;
export type ContractTemplateWithClauses = { template: ContractTemplateRow; clauses: ContractTemplateClauseRow[] };

async function inOrganization<T>(organizationId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, work);
}

async function withClauses(tx: Tx, templates: ContractTemplateRow[]): Promise<ContractTemplateWithClauses[]> {
  if (templates.length === 0) return [];
  const clauses = await tx
    .select()
    .from(contractTemplateClauses)
    .where(inArray(contractTemplateClauses.templateId, templates.map((template) => template.id)))
    .orderBy(asc(contractTemplateClauses.position), asc(contractTemplateClauses.createdAt));
  return templates.map((template) => ({ template, clauses: clauses.filter((clause) => clause.templateId === template.id) }));
}

export async function findContractTemplates(organizationId: string): Promise<ContractTemplateWithClauses[]> {
  return inOrganization(organizationId, async (tx) => withClauses(tx, await tx.select().from(contractTemplates).orderBy(asc(contractTemplates.name))));
}

export async function findContractTemplate(organizationId: string, templateId: string): Promise<ContractTemplateWithClauses | null> {
  return inOrganization(organizationId, async (tx) => {
    const [template] = await tx.select().from(contractTemplates).where(eq(contractTemplates.id, templateId));
    return template ? ((await withClauses(tx, [template]))[0] ?? null) : null;
  });
}

export type ContractTemplateHeader = { name: string; title: string; eventTypeId: string | null; legalReviewedOn: string | null };

export async function insertContractTemplate(
  organizationId: string,
  header: ContractTemplateHeader,
  clauses: ClauseData[],
): Promise<ContractTemplateRow> {
  return inOrganization(organizationId, async (tx) => {
    const [template] = await tx.insert(contractTemplates).values({ organizationId, ...header }).returning();
    if (!template) throw new Error("création du modèle de contrat échouée");
    if (clauses.length > 0) {
      await tx.insert(contractTemplateClauses).values(clauses.map((clause, position) => ({ organizationId, templateId: template.id, ...clause, position })));
    }
    return template;
  });
}

// Chaque modification du texte augmente la version du modèle (HUB-21) ; les contrats déjà
// générés gardent leur texte figé et la version d'où ils viennent.
async function bumpVersion(tx: Tx, templateId: string): Promise<void> {
  await tx
    .update(contractTemplates)
    .set({ version: raw`${contractTemplates.version} + 1`, updatedAt: new Date() })
    .where(eq(contractTemplates.id, templateId));
}

// Le titre et la date de revue font partie du texte : leur changement augmente la version.
export async function updateContractTemplateHeader(organizationId: string, templateId: string, header: ContractTemplateHeader): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const [template] = await tx.select().from(contractTemplates).where(eq(contractTemplates.id, templateId));
    if (!template) return false;
    await tx.update(contractTemplates).set({ ...header, updatedAt: new Date() }).where(eq(contractTemplates.id, templateId));
    if (template.title !== header.title || template.legalReviewedOn !== header.legalReviewedOn) await bumpVersion(tx, templateId);
    return true;
  });
}

// --- Avertissement accepté (réponse 6 de l'avocat) ---

export async function hasAcceptedTemplate(organizationId: string, templateId: string, templateVersion: number, userId: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .select({ id: contractTemplateAcceptances.id })
      .from(contractTemplateAcceptances)
      .where(and(eq(contractTemplateAcceptances.templateId, templateId), eq(contractTemplateAcceptances.templateVersion, templateVersion), eq(contractTemplateAcceptances.userId, userId)));
    return rows.length > 0;
  });
}

export async function insertTemplateAcceptance(organizationId: string, values: { templateId: string; templateVersion: number; userId: string; acceptedAt: Date }): Promise<void> {
  await inOrganization(organizationId, (tx) => tx.insert(contractTemplateAcceptances).values({ organizationId, ...values }).onConflictDoNothing());
}

export async function deleteContractTemplateRow(organizationId: string, templateId: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const deleted = await tx.delete(contractTemplates).where(eq(contractTemplates.id, templateId)).returning({ id: contractTemplates.id });
    return deleted.length > 0;
  });
}

export async function insertContractClause(organizationId: string, templateId: string, clause: ClauseData): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const [template] = await tx.select({ id: contractTemplates.id }).from(contractTemplates).where(eq(contractTemplates.id, templateId));
    if (!template) return false;
    const [last] = await tx
      .select({ max: raw<number | null>`max(${contractTemplateClauses.position})` })
      .from(contractTemplateClauses)
      .where(eq(contractTemplateClauses.templateId, templateId));
    const position = last?.max === null || last?.max === undefined ? 0 : last.max + 1;
    await tx.insert(contractTemplateClauses).values({ organizationId, templateId, ...clause, position });
    await bumpVersion(tx, templateId);
    return true;
  });
}

// Renvoie le modèle de la clause modifiée (null si la clause n'existe pas pour l'organisation).
export async function updateContractClauseRow(organizationId: string, clauseId: string, clause: ClauseData): Promise<string | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.update(contractTemplateClauses).set({ ...clause, updatedAt: new Date() }).where(eq(contractTemplateClauses.id, clauseId)).returning();
    if (!row) return null;
    await bumpVersion(tx, row.templateId);
    return row.templateId;
  });
}

export async function deleteContractClauseRow(organizationId: string, clauseId: string): Promise<string | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.delete(contractTemplateClauses).where(eq(contractTemplateClauses.id, clauseId)).returning();
    if (!row) return null;
    await bumpVersion(tx, row.templateId);
    return row.templateId;
  });
}

// Échange la clause avec sa voisine ; les positions sont d'abord renumérotées.
export async function moveContractClauseRow(organizationId: string, clauseId: string, direction: "up" | "down"): Promise<string | null> {
  return inOrganization(organizationId, async (tx) => {
    const [clause] = await tx.select().from(contractTemplateClauses).where(eq(contractTemplateClauses.id, clauseId));
    if (!clause) return null;
    const siblings = await tx
      .select()
      .from(contractTemplateClauses)
      .where(eq(contractTemplateClauses.templateId, clause.templateId))
      .orderBy(asc(contractTemplateClauses.position), asc(contractTemplateClauses.createdAt));
    const index = siblings.findIndex((row) => row.id === clauseId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= siblings.length) return clause.templateId;
    const ordered = [...siblings];
    [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
    for (const [position, row] of ordered.entries()) {
      if (row.position !== position) await tx.update(contractTemplateClauses).set({ position }).where(eq(contractTemplateClauses.id, row.id));
    }
    await bumpVersion(tx, clause.templateId);
    return clause.templateId;
  });
}

// --- Contrats générés ---

export type QuoteContracts = { contracts: ContractRow[]; acts: ContractSignerActRow[]; evidence: ContractEvidenceRow[] };

export async function findQuoteContracts(organizationId: string, quoteId: string): Promise<QuoteContracts> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(contracts).where(eq(contracts.quoteId, quoteId)).orderBy(asc(contracts.version));
    if (rows.length === 0) return { contracts: [], acts: [], evidence: [] };
    const ids = rows.map((row) => row.id);
    const acts = await tx.select().from(contractSignerActs).where(inArray(contractSignerActs.contractId, ids)).orderBy(asc(contractSignerActs.actedAt));
    const evidence = await tx.select().from(contractEvidence).where(inArray(contractEvidence.contractId, ids));
    return { contracts: rows, acts, evidence };
  });
}

export async function findContract(organizationId: string, contractId: string): Promise<{ contract: ContractRow; acts: ContractSignerActRow[] } | null> {
  return inOrganization(organizationId, async (tx) => {
    const [contract] = await tx.select().from(contracts).where(eq(contracts.id, contractId));
    if (!contract) return null;
    const acts = await tx.select().from(contractSignerActs).where(eq(contractSignerActs.contractId, contractId)).orderBy(asc(contractSignerActs.actedAt));
    return { contract, acts };
  });
}

export type NewContract = {
  quoteId: string;
  quoteVersionId: string;
  templateId: string;
  templateVersion: number;
  templateReviewedOn: string | null;
  title: string;
  clauses: ContractClauseSnapshot[];
  conclusionChannel: ContractRow["conclusionChannel"];
  clientCategory: ContractRow["clientCategory"];
  smallBusinessConfirmed: boolean;
  withdrawalApplies: boolean;
  signatureLevel: string;
  generatedAt: Date;
  isDemo: boolean;
  quoteNumber: string;
};

// Version suivante pour ce devis, sous verrou du devis (deux générations simultanées se suivent).
// « signing » : un contrat de ce devis est en cours de signature ; on ne le remplace pas.
export async function insertContract(organizationId: string, contract: NewContract): Promise<{ status: "ok"; row: ContractRow } | { status: "not_found" | "signing" }> {
  return inOrganization(organizationId, async (tx) => {
    await tx.execute(raw`select 1 from ${quotes} where ${quotes.id} = ${contract.quoteId} for update`);
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, contract.quoteId));
    if (!quote) return { status: "not_found" };
    const pending = await tx
      .select({ id: signatureRequests.id })
      .from(signatureRequests)
      .innerJoin(contracts, eq(contracts.id, signatureRequests.contractId))
      .where(and(eq(contracts.quoteId, contract.quoteId), eq(signatureRequests.status, "pending")));
    if (pending.length > 0) return { status: "signing" };
    const [last] = await tx.select({ version: contracts.version }).from(contracts).where(eq(contracts.quoteId, contract.quoteId)).orderBy(desc(contracts.version)).limit(1);
    const [row] = await tx
      .insert(contracts)
      .values({
        organizationId,
        quoteId: contract.quoteId,
        quoteVersionId: contract.quoteVersionId,
        version: (last?.version ?? 0) + 1,
        templateId: contract.templateId,
        templateVersion: contract.templateVersion,
        templateReviewedOn: contract.templateReviewedOn,
        title: contract.title,
        clauses: contract.clauses,
        conclusionChannel: contract.conclusionChannel,
        clientCategory: contract.clientCategory,
        smallBusinessConfirmed: contract.smallBusinessConfirmed,
        withdrawalApplies: contract.withdrawalApplies,
        signatureLevel: contract.signatureLevel,
        generatedAt: contract.generatedAt,
      })
      .returning();
    if (!row) throw new Error("création du contrat échouée");
    await appendAudit(tx, {
      organizationId,
      action: "quotes.contract.generated",
      objectId: contract.quoteId,
      details: { number: contract.quoteNumber, contractVersion: row.version, templateVersion: contract.templateVersion, channel: contract.conclusionChannel, withdrawalApplies: contract.withdrawalApplies },
      isDemo: contract.isDemo,
    });
    return { status: "ok", row };
  });
}

// --- Actes des signataires : commande, exécution anticipée (réponse 1 de l'avocat, D13) ---

export async function insertSignerAct(
  organizationId: string,
  act: { contractId: string; signerId: string; kind: ContractSignerActRow["kind"]; signerName: string; presentedText: string; actedAt: Date; quoteId: string; quoteNumber: string; isDemo: boolean },
): Promise<"ok" | "exists"> {
  return inOrganization(organizationId, async (tx) => {
    const inserted = await tx
      .insert(contractSignerActs)
      .values({ organizationId, contractId: act.contractId, signerId: act.signerId, kind: act.kind, signerName: act.signerName, presentedText: act.presentedText, actedAt: act.actedAt })
      .onConflictDoNothing()
      .returning({ id: contractSignerActs.id });
    if (inserted.length === 0) return "exists";
    // Trace au journal : identifiants seulement, jamais le nom (SEC-20).
    await appendAudit(tx, {
      organizationId,
      action: act.kind === "order" ? "quotes.contract.ordered" : "quotes.contract.early_execution_requested",
      objectId: act.quoteId,
      details: { number: act.quoteNumber, contractId: act.contractId, signerId: act.signerId },
      isDemo: act.isDemo,
    });
    return "ok";
  });
}

// --- Dossier de preuve (réponses 1 et 5 de l'avocat) ---

export async function insertContractEvidence(organizationId: string, values: { requestId: string; contractId: string; documentKey: string; sha256: string }): Promise<void> {
  await inOrganization(organizationId, (tx) => tx.insert(contractEvidence).values({ organizationId, ...values }).onConflictDoNothing());
}

// --- Factures d'acompte à émettre d'elles-mêmes (FAC-05, D6) ---

export async function insertScheduledDeposit(
  organizationId: string,
  values: { quoteId: string; versionId: string; scheduleItemId: string; issueOn: string; paymentNotBefore: string | null },
): Promise<void> {
  await inOrganization(organizationId, (tx) => tx.insert(scheduledDepositInvoices).values({ organizationId, ...values }).onConflictDoNothing());
}

export type ScheduledDepositContext = { row: ScheduledDepositRow; quoteNumber: string; eventId: string; createdByUserId: string; isDemo: boolean; label: string };

async function contextsOf(tx: Tx, rows: ScheduledDepositRow[]): Promise<ScheduledDepositContext[]> {
  if (rows.length === 0) return [];
  const quoteRows = await tx.select().from(quotes).where(inArray(quotes.id, rows.map((row) => row.quoteId)));
  const items = await tx.select().from(paymentScheduleItems).where(inArray(paymentScheduleItems.id, rows.map((row) => row.scheduleItemId)));
  return rows.flatMap((row) => {
    const quote = quoteRows.find((candidate) => candidate.id === row.quoteId);
    const item = items.find((candidate) => candidate.id === row.scheduleItemId);
    return quote && item ? [{ row, quoteNumber: quote.number, eventId: quote.eventId, createdByUserId: quote.createdByUserId, isDemo: quote.isDemo, label: item.label }] : [];
  });
}

// À émettre aujourd'hui (jour de Paris) : en attente et arrivées à leur date.
export async function findDueScheduledDeposits(organizationId: string, today: string, quoteId?: string): Promise<ScheduledDepositContext[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .select()
      .from(scheduledDepositInvoices)
      .where(
        and(
          eq(scheduledDepositInvoices.status, "waiting"),
          lte(scheduledDepositInvoices.issueOn, today),
          quoteId ? eq(scheduledDepositInvoices.quoteId, quoteId) : undefined,
        ),
      )
      .orderBy(asc(scheduledDepositInvoices.issueOn));
    return contextsOf(tx, rows);
  });
}

export async function findOpenScheduledDeposits(organizationId: string): Promise<ScheduledDepositContext[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(scheduledDepositInvoices).where(ne(scheduledDepositInvoices.status, "issued")).orderBy(asc(scheduledDepositInvoices.issueOn));
    return contextsOf(tx, rows);
  });
}

export async function findQuoteScheduledDeposit(organizationId: string, quoteId: string): Promise<ScheduledDepositContext | null> {
  return inOrganization(organizationId, async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!quote) return null;
    const rows = await tx
      .select({ row: scheduledDepositInvoices })
      .from(scheduledDepositInvoices)
      .innerJoin(quoteVersions, eq(quoteVersions.id, scheduledDepositInvoices.versionId))
      .where(and(eq(scheduledDepositInvoices.quoteId, quoteId), eq(quoteVersions.version, quote.currentVersion)));
    return (await contextsOf(tx, rows.map((entry) => entry.row)))[0] ?? null;
  });
}

export async function updateScheduledDeposit(
  organizationId: string,
  id: string,
  values: { status: ScheduledDepositRow["status"]; missingFields: string[]; invoiceId: string | null },
): Promise<void> {
  await inOrganization(organizationId, (tx) => tx.update(scheduledDepositInvoices).set({ ...values, updatedAt: new Date() }).where(eq(scheduledDepositInvoices.id, id)));
}

// Une facture d'acompte émise à la main pour la même échéance clôt la facture à émettre.
export async function closeScheduledDepositForItem(organizationId: string, scheduleItemId: string, invoiceId: string): Promise<void> {
  await inOrganization(organizationId, (tx) =>
    tx
      .update(scheduledDepositInvoices)
      .set({ status: "issued", missingFields: [], invoiceId, updatedAt: new Date() })
      .where(and(eq(scheduledDepositInvoices.scheduleItemId, scheduleItemId), ne(scheduledDepositInvoices.status, "issued"))),
  );
}

// Signataires d'une demande, pour la renonciation (reconnus par l'e-mail du lien).
export async function findSignersOfRequest(organizationId: string, requestId: string) {
  return inOrganization(organizationId, (tx) => tx.select().from(quoteSigners).where(eq(quoteSigners.requestId, requestId)).orderBy(asc(quoteSigners.position)));
}

// Facture à émettre d'une échéance (pour reprendre la date « pas de paiement avant »).
export async function findScheduledDepositForItem(organizationId: string, scheduleItemId: string): Promise<ScheduledDepositRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(scheduledDepositInvoices).where(eq(scheduledDepositInvoices.scheduleItemId, scheduleItemId));
    return row ?? null;
  });
}

// Demandes de signature qui font signer un contrat de ce devis (combinée ou seule).
export async function findContractRequests(organizationId: string, contractIds: string[]) {
  if (contractIds.length === 0) return [];
  return inOrganization(organizationId, (tx) => tx.select().from(signatureRequests).where(inArray(signatureRequests.contractId, contractIds)));
}

export async function findLatestEvidence(organizationId: string, contractId: string): Promise<ContractEvidenceRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(contractEvidence).where(eq(contractEvidence.contractId, contractId)).orderBy(desc(contractEvidence.createdAt)).limit(1);
    return row ?? null;
  });
}
