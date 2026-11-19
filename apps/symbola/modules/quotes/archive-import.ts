// Lot 35b (HUB-13 ; décision D7 de Julien du 18/11/2026, après l'avis de l'expert-comptable ;
// ADR 0098) — reprise des entités du module Devis et factures d'un export Symbola. Les factures,
// avoirs et encaissements repris restent des pièces comptables en lecture seule (déclencheurs
// d'immuabilité), avec leur numéro, leur original et leurs séries : la numérotation continue après
// le dernier numéro repris (même SIREN, contrôlé par l'orchestrateur). La chaîne des pièces reprise
// est d'abord vérifiée entièrement (rangs, liens, empreintes recalculées, contenu de chaque pièce),
// puis prolongée : une ancre garde sa dernière empreinte, la chaîne de l'organisation part d'elle,
// et les pièces reprises s'y enchaînent de nouveau, dans l'ordre de la chaîne d'origine, marquées
// « reprise ». La chaîne obtenue est vérifiée avant la fin de la transaction.
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { ExportRow, ImportEntityResult, ModuleImportContext, ModuleImportResult, ModuleImportRows } from "@symbola/contracts";
import { clearModuleImportTargets, importModuleEntities, insertImportRows, prepareImportRows, registerModuleImportIds } from "@symbola/db/import";
import { entityName, type ExportEntitySpec, type ExportRawRow } from "@symbola/db/export";
import { ledgerAnchors } from "@symbola/db/schema/quotes";
import type { OrganizationTransaction } from "@symbola/db/with-organization";
import { QUOTES_EXPORT_ENTITIES } from "./export";

const GENESIS = "0".repeat(64);
// Pièce chaînée → entité de l'archive.
const PIECE_ENTITIES: Readonly<Record<string, string>> = {
  invoice: "invoices",
  credit_note: "credit_notes",
  original: "original_documents",
  payment: "payment_entries",
  payment_reversal: "payment_entries",
};
const PIECES = new Set(Object.values(PIECE_ENTITIES));

// Chaîne reprise invalide : la reprise est refusée, rien n'est écrit (motif sans donnée de l'archive).
export class ImportedLedgerInvalidError extends Error {
  constructor(readonly anomaly: string) {
    super(`chaîne des pièces reprise invalide : ${anomaly}`);
    this.name = "ImportedLedgerInvalidError";
  }
}

type LedgerRow = { sequence: number; entryKind: string; objectId: string; payload: Record<string, unknown>; previousHash: string; hash: string };

function sha256Text(value: unknown): string {
  return createHash("sha256")
    .update(typeof value === "string" ? value : "", "utf8")
    .digest("hex");
}

function ledgerRows(rows: ModuleImportRows): LedgerRow[] {
  return [...(rows.get("ledger_entries") ?? [])].map((row) => row as unknown as LedgerRow).sort((a, b) => a.sequence - b.sequence);
}

// Empreintes SHA-256 du texte JSONB de documents JSON (même texte que la base : jsonb::text).
async function jsonbHashes(tx: OrganizationTransaction, values: unknown[]): Promise<string[]> {
  if (values.length === 0) return [];
  const result = (await tx.execute(
    sql`select quotes.ledger_sha256(case when jsonb_typeof(value) = 'null' then null else value::text end) as hash from jsonb_array_elements(${JSON.stringify(values)}::jsonb) with ordinality order by ordinality`,
  )) as unknown as { hash: string }[];
  return result.map((row) => row.hash);
}

// Contenu attendu de chaque écriture, recalculé depuis la pièce de l'archive (mêmes règles que
// quotes.ledger_payload_*). Les instants de l'archive sont à la milliseconde ; la chaîne les tient
// à la microseconde : ils sont comparés à la milliseconde.
async function expectedPayload(tx: OrganizationTransaction, kind: string, piece: ExportRow, fileHashes: ReadonlyMap<string, string>): Promise<Record<string, unknown>> {
  if (kind === "invoice") {
    const [seller, buyer, lines, totals] = await jsonbHashes(tx, [piece.sellerSnapshot ?? null, piece.buyerSnapshot ?? null, piece.linesSnapshot ?? null, piece.totalsSnapshot ?? null]);
    return {
      number: piece.number,
      kind: piece.kind,
      quoteId: piece.quoteId ?? null,
      versionId: piece.versionId ?? null,
      scheduleItemId: piece.scheduleItemId ?? null,
      issuedAt: piece.issuedAt,
      issuedOn: piece.issuedOn ?? null,
      serviceDate: piece.serviceDate ?? null,
      paymentDueOn: piece.paymentDueOn ?? null,
      amountCents: piece.amountCents,
      vatRegime: piece.vatRegime ?? null,
      legalMentionSha256: sha256Text(piece.legalMention),
      mentionsSha256: sha256Text(piece.mentions),
      sellerSha256: seller,
      buyerSha256: buyer,
      linesSha256: lines,
      totalsSha256: totals,
    };
  }
  if (kind === "credit_note") {
    const [seller, buyer, totals] = await jsonbHashes(tx, [piece.sellerSnapshot ?? null, piece.buyerSnapshot ?? null, piece.totalsSnapshot ?? null]);
    return {
      number: piece.number,
      invoiceId: piece.invoiceId ?? null,
      issuedAt: piece.issuedAt,
      issuedOn: piece.issuedOn ?? null,
      amountCents: piece.amountCents,
      reasonSha256: sha256Text(piece.reason),
      legalMentionSha256: sha256Text(piece.legalMention),
      sellerSha256: seller,
      buyerSha256: buyer,
      totalsSha256: totals,
    };
  }
  if (kind === "original") {
    // La clé de stockage d'origine ne sort pas de Symbola : c'est le fichier lui-même qui est
    // contrôlé (son empreinte dans l'archive est celle que la chaîne a scellée).
    const fileHash = typeof piece.storageKey === "string" ? fileHashes.get(piece.storageKey) : undefined;
    if (fileHash !== piece.sha256) throw new ImportedLedgerInvalidError("original_altered");
    return { documentKind: piece.documentKind, documentId: piece.documentId, sha256: piece.sha256, byteSize: piece.byteSize, isReconstructed: piece.isReconstructed };
  }
  return {
    kind: piece.kind,
    scheduleItemId: piece.scheduleItemId,
    amountCents: piece.amountCents,
    paidOn: piece.paidOn ?? null,
    paymentMethodId: piece.paymentMethodId ?? null,
    paymentMethodLabel: piece.paymentMethodLabel ?? null,
    reversesEntryId: piece.reversesEntryId ?? null,
    reasonSha256: sha256Text(piece.reason),
  };
}

function samePayload(kind: string, expected: Record<string, unknown>, sealed: Record<string, unknown>): boolean {
  const compared = { ...sealed };
  if (kind === "original") delete compared.storageKey;
  if (typeof compared.issuedAt === "string") compared.issuedAt = compared.issuedAt.slice(0, 23);
  const wanted = { ...expected };
  if (typeof wanted.issuedAt === "string") wanted.issuedAt = wanted.issuedAt.slice(0, 23);
  const keys = new Set([...Object.keys(compared), ...Object.keys(wanted)]);
  return [...keys].every((key) => JSON.stringify(compared[key] ?? null) === JSON.stringify(wanted[key] ?? null));
}

export type VerifiedImportedLedger = { entries: number; lastSequence: number; tip: string | null };

// Vérifie la chaîne reprise, comme quotes.verify_ledger le fait dans la base (FAC-14).
export async function verifyImportedLedger(tx: OrganizationTransaction, rows: ModuleImportRows, context: ModuleImportContext): Promise<VerifiedImportedLedger> {
  const entries = ledgerRows(rows);
  const anchor = rows.get("ledger_anchors")?.[0];
  let expectedPrevious = typeof anchor?.previousHash === "string" ? anchor.previousHash : GENESIS;
  const pieces = new Map<string, ExportRow>();
  for (const entity of PIECES) for (const row of rows.get(entity) ?? []) pieces.set(`${entity}:${String(row.id)}`, row);

  const hashes = entries.length
    ? ((await tx.execute(
        sql`select quotes.ledger_hash(e ->> 'previousHash', (e ->> 'sequence')::bigint, e ->> 'entryKind', (e ->> 'objectId')::uuid, e -> 'payload') as hash from jsonb_array_elements(${JSON.stringify(entries)}::jsonb) with ordinality as t(e, n) order by n`,
      )) as unknown as { hash: string }[])
    : [];
  const chained = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (entry.sequence !== index + 1) throw new ImportedLedgerInvalidError("sequence_gap");
    if (entry.previousHash !== expectedPrevious) throw new ImportedLedgerInvalidError("broken_link");
    if (hashes[index]?.hash !== entry.hash) throw new ImportedLedgerInvalidError("entry_altered");
    const entity = PIECE_ENTITIES[entry.entryKind];
    const piece = entity ? pieces.get(`${entity}:${entry.objectId}`) : undefined;
    if (!entity || !piece) throw new ImportedLedgerInvalidError("object_missing");
    if (!samePayload(entry.entryKind, await expectedPayload(tx, entry.entryKind, piece, context.fileHashes), entry.payload)) throw new ImportedLedgerInvalidError("object_altered");
    chained.add(`${entity}:${entry.objectId}`);
    expectedPrevious = entry.hash;
  }
  for (const key of pieces.keys()) if (!chained.has(key)) throw new ImportedLedgerInvalidError("object_unchained");
  const last = entries.at(-1);
  return { entries: entries.length, lastSequence: last?.sequence ?? Number(anchor?.sourceLastSequence ?? 0), tip: last?.hash ?? (anchor ? expectedPrevious : null) };
}

// Pièces reprises, écrites dans l'ordre de la chaîne d'origine : chacune s'y enchaîne de nouveau.
async function writePiecesInChainOrder(tx: OrganizationTransaction, rows: ModuleImportRows, context: ModuleImportContext): Promise<ImportEntityResult[]> {
  const specs = new Map(QUOTES_EXPORT_ENTITIES.filter((spec) => PIECES.has(entityName(spec))).map((spec) => [entityName(spec), spec] as const));
  const prepared = new Map<string, { spec: ExportEntitySpec; row: ExportRawRow }>();
  const results: ImportEntityResult[] = [];
  for (const [name, spec] of specs) {
    const archived = rows.get(name) ?? [];
    const ready = prepareImportRows(spec, archived, context);
    for (const row of ready) prepared.set(`${name}:${String(row.id)}`, { spec, row });
    results.push({ entity: name, rows: archived.length, imported: ready.length, reason: null });
  }
  await tx.execute(sql`select set_config('app.ledger_import', 'on', true)`);
  for (const entry of ledgerRows(rows)) {
    const entity = PIECE_ENTITIES[entry.entryKind]!;
    const piece = prepared.get(`${entity}:${context.ids.get(entry.objectId) ?? ""}`);
    if (!piece) throw new ImportedLedgerInvalidError("object_missing");
    await insertImportRows(tx, piece.spec, [piece.row]);
  }
  await tx.execute(sql`select set_config('app.ledger_import', '', true)`);
  return results;
}

export function registerQuotesImportIds(rows: ModuleImportRows, context: ModuleImportContext): void {
  registerModuleImportIds(QUOTES_EXPORT_ENTITIES, rows, context);
}

export async function importQuotesData(tx: OrganizationTransaction, rows: ModuleImportRows, context: ModuleImportContext): Promise<ModuleImportResult> {
  await clearModuleImportTargets(tx, { organizationId: context.organizationId, specs: QUOTES_EXPORT_ENTITIES });
  const ledger = await verifyImportedLedger(tx, rows, context);
  if (ledger.tip) {
    await tx.insert(ledgerAnchors).values({
      organizationId: context.organizationId,
      previousHash: ledger.tip,
      sourceOrganizationId: context.sourceOrganizationId,
      sourceLastSequence: ledger.lastSequence,
      sourceEntries: ledger.entries,
    });
  }
  const entities = await importModuleEntities(tx, {
    specs: QUOTES_EXPORT_ENTITIES,
    rows,
    context,
    deferred: { entities: PIECES, write: () => writePiecesInChainOrder(tx, rows, context) },
  });
  const anomalies = (await tx.execute(sql`select anomaly from quotes.verify_ledger(${context.organizationId}::uuid)`)) as unknown as { anomaly: string }[];
  if (anomalies.length > 0) throw new ImportedLedgerInvalidError(`prolonged_${anomalies[0]!.anomaly}`);
  return { module: "quotes", entities, ledger: { entries: ledger.entries, lastSequence: ledger.lastSequence } };
}
