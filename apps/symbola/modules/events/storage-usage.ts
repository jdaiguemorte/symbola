// Lot 37b (DOC-12 ; D12, D13 ; ADR 0071) — ce que le module events rend au relevé de stockage : les
// fichiers déposés (toutes les versions des documents de l'évènement, pièces jointes des tâches,
// devis des prestataires consultés), en nombre et en volume, par évènement. Une image compte dans
// « images », le reste dans « dépôts ». Tailles lues en base, jamais au stockage ; jamais un nom de
// fichier. Exposé seulement par service.ts (ADR 0011).
import { eq, isNotNull, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventDocuments, eventDocumentVersions, eventTaskAttachments, eventVendorCandidates } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { StorageNature, StorageUsageRow } from "@symbola/contracts";

function natureOf(mime: SQLWrapper): SQL<StorageNature> {
  return sql<StorageNature>`case when ${mime} like 'image/%' then 'images' else 'uploads' end`;
}

const files = sql<number>`count(*)::int`;

export async function measureEventsStorage(organizationId: string): Promise<StorageUsageRow[]> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const versionNature = natureOf(eventDocumentVersions.mime);
    const documents = await tx
      .select({ eventId: eventDocuments.eventId, nature: versionNature, files, bytes: sql<number>`coalesce(sum(${eventDocumentVersions.sizeBytes}), 0)::bigint`.mapWith(Number) })
      .from(eventDocumentVersions)
      .innerJoin(eventDocuments, eq(eventDocuments.id, eventDocumentVersions.documentId))
      .groupBy(eventDocuments.eventId, versionNature);
    const attachmentNature = natureOf(eventTaskAttachments.mime);
    const attachments = await tx
      .select({ eventId: eventTaskAttachments.eventId, nature: attachmentNature, files, bytes: sql<number>`coalesce(sum(${eventTaskAttachments.sizeBytes}), 0)::bigint`.mapWith(Number) })
      .from(eventTaskAttachments)
      .groupBy(eventTaskAttachments.eventId, attachmentNature);
    const quoteNature = natureOf(sql`coalesce(${eventVendorCandidates.quoteMime}, '')`);
    const candidateQuotes = await tx
      .select({ eventId: eventVendorCandidates.eventId, nature: quoteNature, files, bytes: sql<number>`coalesce(sum(${eventVendorCandidates.quoteSizeBytes}), 0)::bigint`.mapWith(Number) })
      .from(eventVendorCandidates)
      .where(isNotNull(eventVendorCandidates.quoteFileKey))
      .groupBy(eventVendorCandidates.eventId, quoteNature);
    return [...documents, ...attachments, ...candidateQuotes].map((row) => ({ nature: row.nature, eventId: row.eventId, files: row.files, bytes: row.bytes }));
  });
}
