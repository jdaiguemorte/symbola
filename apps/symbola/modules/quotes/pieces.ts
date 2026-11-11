// Lot 23b (FAC-14, JUR-05, JUR-06, DOC-08, ADR 0061) — pièces inaltérables :
// originaux des factures et avoirs, chaîne d'empreintes, archive comptable.
// Accès base du module quotes (comme repository.ts) : jamais importé hors du
// module.
import { createHash } from "node:crypto";
import { and, asc, eq, inArray, sql as raw } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { ledgerEntries, originalDocuments, paymentScheduleItems, quotes, quoteVersions } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, readPrivateObject, uploadPrivateObject } from "@symbola/files";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

export type OriginalKind = "invoice" | "credit_note";
export type OriginalRow = typeof originalDocuments.$inferSelect;
export type LedgerEntryRow = typeof ledgerEntries.$inferSelect;

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function originalKey(organizationId: string, kind: OriginalKind, documentId: string): string {
  return `originals/${organizationId}/${kind}/${documentId}.pdf`;
}

// Dépose l'original et l'enregistre, dans la transaction de l'émission : si le
// stockage ne répond pas, l'émission échoue et son numéro n'est pas consommé.
// L'enregistrement s'enchaîne de lui-même (déclencheur original_documents_chain).
export async function storeOriginal(
  tx: Tx,
  input: { organizationId: string; kind: OriginalKind; documentId: string; pdf: Uint8Array; reconstructed?: boolean },
): Promise<OriginalRow> {
  const key = originalKey(input.organizationId, input.kind, input.documentId);
  const body = Buffer.from(input.pdf);
  await uploadPrivateObject(createStorageClient(), { key, body, contentType: "application/pdf" });
  const [row] = await tx
    .insert(originalDocuments)
    .values({
      organizationId: input.organizationId,
      documentKind: input.kind,
      documentId: input.documentId,
      storageKey: key,
      sha256: sha256Hex(body),
      byteSize: body.byteLength,
      isReconstructed: input.reconstructed ?? false,
    })
    .returning();
  if (!row) throw new Error("enregistrement de l'original échoué");
  return row;
}

export async function findOriginal(organizationId: string, kind: OriginalKind, documentId: string): Promise<OriginalRow | null> {
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(originalDocuments)
      .where(and(eq(originalDocuments.documentKind, kind), eq(originalDocuments.documentId, documentId))),
  );
  return row ?? null;
}

// Pièce émise avant le lot 23b (décision D6) : son PDF est rendu une fois, à
// sa première ouverture, puis conservé, marqué « reconstitué ». Deux premières
// ouvertures simultanées : la seconde relit celui de la première.
export async function storeReconstructedOriginal(
  organizationId: string,
  kind: OriginalKind,
  documentId: string,
  pdf: Uint8Array,
): Promise<OriginalRow> {
  try {
    return await withOrganization(appDatabase(), organizationId, (tx) =>
      storeOriginal(tx, { organizationId, kind, documentId, pdf, reconstructed: true }),
    );
  } catch (error) {
    const existing = await findOriginal(organizationId, kind, documentId);
    if (existing) return existing;
    throw error;
  }
}

export async function readOriginalBytes(original: OriginalRow): Promise<Buffer> {
  return (await readPrivateObject(createStorageClient(), original.storageKey)).data;
}

export type LedgerAnomalyCode = "sequence_gap" | "broken_link" | "entry_altered" | "object_missing" | "object_altered" | "object_unchained";
export type LedgerAnomaly = { sequence: number | null; kind: string; objectId: string; anomaly: LedgerAnomalyCode };

// FAC-14 — vérification par la base (quotes.verify_ledger) : chaîne recalculée,
// chaque écriture comparée à la pièce actuelle, pièces sans écriture.
export async function verifyLedgerRows(organizationId: string): Promise<{ anomalies: LedgerAnomaly[]; entries: number; lastHash: string | null }> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const rows = (await tx.execute(raw`select * from quotes.verify_ledger(${organizationId}::uuid)`)) as unknown as {
      anomaly_sequence: string | number | null;
      anomaly_kind: string;
      anomaly_object: string;
      anomaly: LedgerAnomalyCode;
    }[];
    const [last] = await tx
      .select({ sequence: ledgerEntries.sequence, hash: ledgerEntries.hash })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.organizationId, organizationId))
      .orderBy(raw`${ledgerEntries.sequence} desc`)
      .limit(1);
    return {
      anomalies: [...rows].map((row) => ({
        sequence: row.anomaly_sequence === null ? null : Number(row.anomaly_sequence),
        kind: row.anomaly_kind,
        objectId: row.anomaly_object,
        anomaly: row.anomaly,
      })),
      entries: last ? Number(last.sequence) : 0,
      lastHash: last?.hash ?? null,
    };
  });
}

// JUR-06 — archive comptable : années qui ont des écritures (heure de Paris).
export async function ledgerYears(organizationId: string): Promise<number[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .selectDistinct({ year: raw<number>`extract(year from ${ledgerEntries.recordedAt} at time zone 'Europe/Paris')::int` })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.organizationId, organizationId)),
  );
  return rows.map((row) => Number(row.year)).sort((a, b) => b - a);
}

export type LedgerArchiveRow = LedgerEntryRow & { quoteNumber: string | null };

// Écritures d'une année, dans l'ordre de la chaîne, avec le numéro du devis
// d'un encaissement (le numéro d'une facture ou d'un avoir est dans le contenu).
export async function ledgerEntriesOfYear(organizationId: string, year: number): Promise<LedgerArchiveRow[]> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const rows = await tx
      .select()
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.organizationId, organizationId),
          raw`extract(year from ${ledgerEntries.recordedAt} at time zone 'Europe/Paris') = ${year}`,
        ),
      )
      .orderBy(asc(ledgerEntries.sequence));
    const itemIds = [
      ...new Set(
        rows.flatMap((row) => {
          const itemId = (row.payload as { scheduleItemId?: unknown }).scheduleItemId;
          return (row.entryKind === "payment" || row.entryKind === "payment_reversal") && typeof itemId === "string" ? [itemId] : [];
        }),
      ),
    ];
    const numbers = new Map<string, string>();
    if (itemIds.length > 0) {
      const found = await tx
        .select({ itemId: paymentScheduleItems.id, number: quotes.number })
        .from(paymentScheduleItems)
        .innerJoin(quoteVersions, eq(quoteVersions.id, paymentScheduleItems.versionId))
        .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
        .where(inArray(paymentScheduleItems.id, itemIds));
      for (const row of found) numbers.set(row.itemId, row.number);
    }
    return rows.map((row) => {
      const itemId = (row.payload as { scheduleItemId?: unknown }).scheduleItemId;
      return { ...row, quoteNumber: typeof itemId === "string" ? (numbers.get(itemId) ?? null) : null };
    });
  });
}
