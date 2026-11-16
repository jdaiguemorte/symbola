// Lot 37b (DOC-12 ; D12, D13 ; ADR 0071) — ce que le module quotes rend au relevé de stockage :
// - originaux légaux : factures et avoirs émis (quotes.original_documents) ;
// - documents signés : document signé et certificat de chaque signature, dossiers de preuve.
// En nombre et en volume, par évènement, hors pièces d'essai. Tailles lues en base ; celles d'avant
// le lot 37b sont lues une fois au stockage (sans le télécharger) puis gardées. Jamais un nom de
// fichier. Exposé seulement par service.ts (ADR 0011).
import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { contractEvidence, contracts, originalDocuments, quotes, quoteVersions, signatureRequests } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, statPrivateObject } from "@symbola/files";
import type { StorageUsageRow } from "@symbola/contracts";

// D13 : les tailles manquantes (fichiers archivés avant le lot 37b), lues une fois au stockage. Un
// fichier absent du stockage reste sans taille et n'est pas compté ; il est signalé au journal par
// son identifiant de ligne, sans nom de fichier.
export async function fillMissingQuotesFileSizes(organizationId: string): Promise<void> {
  const db = appDatabase();
  const [requests, evidences] = await withOrganization(db, organizationId, (tx) =>
    Promise.all([
      tx
        .select()
        .from(signatureRequests)
        .where(
          or(
            and(isNotNull(signatureRequests.signedDocumentKey), isNull(signatureRequests.signedDocumentSizeBytes)),
            and(isNotNull(signatureRequests.auditCertificateKey), isNull(signatureRequests.auditCertificateSizeBytes)),
          ),
        ),
      tx.select().from(contractEvidence).where(isNull(contractEvidence.sizeBytes)),
    ]),
  );
  if (requests.length === 0 && evidences.length === 0) return;
  const storage = createStorageClient();
  const sizeOf = async (key: string | null, table: string, id: string): Promise<number | null> => {
    if (!key) return null;
    const size = await statPrivateObject(storage, key);
    if (size === null) console.warn(`relevé de stockage : fichier absent du stockage (${table} ${id})`);
    return size;
  };
  for (const request of requests) {
    const signed = request.signedDocumentSizeBytes ?? (await sizeOf(request.signedDocumentKey, "signature_requests", request.id));
    const certificate = request.auditCertificateSizeBytes ?? (await sizeOf(request.auditCertificateKey, "signature_requests", request.id));
    await withOrganization(db, organizationId, (tx) =>
      tx.update(signatureRequests).set({ signedDocumentSizeBytes: signed, auditCertificateSizeBytes: certificate }).where(eq(signatureRequests.id, request.id)),
    );
  }
  for (const evidence of evidences) {
    const size = await sizeOf(evidence.documentKey, "contract_evidence", evidence.id);
    if (size !== null) await withOrganization(db, organizationId, (tx) => tx.update(contractEvidence).set({ sizeBytes: size }).where(eq(contractEvidence.id, evidence.id)));
  }
}

export async function measureQuotesStorage(organizationId: string): Promise<StorageUsageRow[]> {
  await fillMissingQuotesFileSizes(organizationId);
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const [originals] = await tx.select({ files: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(${originalDocuments.byteSize}), 0)::bigint`.mapWith(Number) }).from(originalDocuments);
    const signedPresent = sql`${signatureRequests.signedDocumentKey} is not null and ${signatureRequests.signedDocumentSizeBytes} is not null`;
    const certificatePresent = sql`${signatureRequests.auditCertificateKey} is not null and ${signatureRequests.auditCertificateSizeBytes} is not null`;
    const signed = await tx
      // Un fichier effacé à la fin de sa conservation (clé remise à nul, RGPD) ne compte plus.
      .select({
        eventId: quotes.eventId,
        files: sql<number>`(count(*) filter (where ${signedPresent}) + count(*) filter (where ${certificatePresent}))::int`,
        bytes: sql<number>`(coalesce(sum(${signatureRequests.signedDocumentSizeBytes}) filter (where ${signedPresent}), 0) + coalesce(sum(${signatureRequests.auditCertificateSizeBytes}) filter (where ${certificatePresent}), 0))::bigint`.mapWith(Number),
      })
      .from(signatureRequests)
      .innerJoin(quoteVersions, eq(quoteVersions.id, signatureRequests.versionId))
      .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
      .where(and(eq(quotes.isDemo, false), or(isNotNull(signatureRequests.signedDocumentKey), isNotNull(signatureRequests.auditCertificateKey))))
      .groupBy(quotes.eventId);
    const evidence = await tx
      .select({ eventId: quotes.eventId, files: sql<number>`count(${contractEvidence.sizeBytes})::int`, bytes: sql<number>`coalesce(sum(${contractEvidence.sizeBytes}), 0)::bigint`.mapWith(Number) })
      .from(contractEvidence)
      .innerJoin(contracts, eq(contracts.id, contractEvidence.contractId))
      .innerJoin(quotes, eq(quotes.id, contracts.quoteId))
      .where(eq(quotes.isDemo, false))
      .groupBy(quotes.eventId);
    return [
      { nature: "legal_originals" as const, eventId: null, files: originals?.files ?? 0, bytes: originals?.bytes ?? 0 },
      ...[...signed, ...evidence].map((row) => ({ nature: "signed_documents" as const, eventId: row.eventId, files: row.files, bytes: row.bytes })),
    ];
  });
}
