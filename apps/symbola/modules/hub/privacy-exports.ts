// RGPD-02 — exports des données d'une personne (lot 6, ADR 0023). Le PDF et
// l'archive ZIP sont construits par l'orchestrateur (lib/privacy/export.ts) ;
// le hub les range dans le stockage privé, garde la trace de l'export et
// délivre un lien signé de courte durée, demandé au moment du
// téléchargement — jamais stocké ni affiché d'avance. Les fichiers sont
// effacés à l'expiration (purge horaire), la ligne reste comme trace.
import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { privacyExports, privacyRequests } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadPrivateObject } from "@symbola/files";
import type { FileDownload } from "@symbola/contracts";
import { findPlatformSettings, insertDefaultPlatformSettings } from "./repository";

const DAY_MS = 86_400_000;

// Seules les demandes d'accès et de portabilité donnent lieu à un export.
const EXPORT_REQUEST_TYPES = ["access", "portability"] as const;

export class PrivacyExportNotFoundError extends Error {}
export class PrivacyExportInvalidError extends Error {
  constructor(readonly code: "request_invalid" | "empty") {
    super(code);
  }
}

export type PrivacyExportFile = "pdf" | "archive";

export type PrivacyExportView = {
  id: string;
  recordCount: number;
  requestId: string | null;
  requestPersonLabel: string | null;
  createdAt: Date;
  expiresAt: Date;
};

export async function getPrivacyExportRetentionDays(db: AppDatabase): Promise<number> {
  let settings = await findPlatformSettings(db);
  if (!settings) {
    await insertDefaultPlatformSettings(db);
    settings = await findPlatformSettings(db);
  }
  if (!settings) throw new Error("réglages de la plateforme introuvables");
  return settings.privacyExportRetentionDays;
}

// Demandes en cours auxquelles un export peut être rattaché (accès, portabilité).
export async function listExportablePrivacyRequests(db: AppDatabase, organizationId: string): Promise<{ id: string; type: string; personLabel: string }[]> {
  return withOrganization(db, organizationId, (tx) =>
    tx
      .select({ id: privacyRequests.id, type: privacyRequests.type, personLabel: privacyRequests.personLabel })
      .from(privacyRequests)
      .where(and(inArray(privacyRequests.type, [...EXPORT_REQUEST_TYPES]), inArray(privacyRequests.status, ["open", "extended"])))
      .orderBy(privacyRequests.dueOn),
  );
}

export async function storePrivacyExport(
  db: AppDatabase,
  input: {
    organizationId: string;
    userId: string;
    requestId: string | null;
    recordCount: number;
    pdf: Buffer;
    archive: Buffer;
    now?: Date;
  },
): Promise<PrivacyExportView> {
  const now = input.now ?? new Date();
  if (input.recordCount <= 0) throw new PrivacyExportInvalidError("empty");
  let requestPersonLabel: string | null = null;
  if (input.requestId) {
    const [request] = await withOrganization(db, input.organizationId, (tx) =>
      tx
        .select({ personLabel: privacyRequests.personLabel })
        .from(privacyRequests)
        .where(
          and(
            eq(privacyRequests.id, input.requestId!),
            inArray(privacyRequests.type, [...EXPORT_REQUEST_TYPES]),
            inArray(privacyRequests.status, ["open", "extended"]),
          ),
        ),
    );
    // Demande inconnue, d'une autre organisation, close ou d'un autre type.
    if (!request) throw new PrivacyExportInvalidError("request_invalid");
    requestPersonLabel = request.personLabel;
  }

  const retentionDays = await getPrivacyExportRetentionDays(db);
  const id = randomUUID();
  const prefix = `privacy-exports/${input.organizationId}/${id}`;
  const pdfKey = `${prefix}/export.pdf`;
  const archiveKey = `${prefix}/donnees.zip`;
  const storage = createStorageClient();
  await uploadPrivateObject(storage, { key: pdfKey, body: input.pdf, contentType: "application/pdf" });
  await uploadPrivateObject(storage, { key: archiveKey, body: input.archive, contentType: "application/zip" });
  try {
    const [row] = await withOrganization(db, input.organizationId, (tx) =>
      tx
        .insert(privacyExports)
        .values({
          id,
          organizationId: input.organizationId,
          requestId: input.requestId,
          recordCount: input.recordCount,
          pdfKey,
          archiveKey,
          createdByUserId: input.userId,
          createdAt: now,
          expiresAt: new Date(now.getTime() + retentionDays * DAY_MS),
        })
        .returning(),
    );
    if (!row) throw new Error("enregistrement de l'export échoué");
    return { id: row.id, recordCount: row.recordCount, requestId: row.requestId, requestPersonLabel, createdAt: row.createdAt, expiresAt: row.expiresAt };
  } catch (error) {
    // Aucun fichier sans trace : ceux déjà déposés sont retirés.
    await deletePrivateObject(storage, pdfKey).catch(() => undefined);
    await deletePrivateObject(storage, archiveKey).catch(() => undefined);
    throw error;
  }
}

// Exports encore téléchargeables, du plus récent au plus ancien.
export async function listPrivacyExports(db: AppDatabase, organizationId: string, now: Date = new Date()): Promise<PrivacyExportView[]> {
  const rows = await withOrganization(db, organizationId, (tx) =>
    tx
      .select({ export: privacyExports, personLabel: privacyRequests.personLabel })
      .from(privacyExports)
      .leftJoin(privacyRequests, eq(privacyRequests.id, privacyExports.requestId))
      .where(and(isNull(privacyExports.purgedAt), gt(privacyExports.expiresAt, now)))
      .orderBy(desc(privacyExports.createdAt)),
  );
  return rows.map(({ export: row, personLabel }) => ({
    id: row.id,
    recordCount: row.recordCount,
    requestId: row.requestId,
    requestPersonLabel: personLabel,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  }));
}

// PDF ou archive d'un export encore valide, lu dans le stockage privé et
// servi par l'app (ADR 0027).
export async function getPrivacyExportFile(
  db: AppDatabase,
  input: { organizationId: string; exportId: string; file: PrivacyExportFile; now?: Date },
): Promise<FileDownload> {
  const now = input.now ?? new Date();
  const [row] = await withOrganization(db, input.organizationId, (tx) =>
    tx
      .select()
      .from(privacyExports)
      .where(and(eq(privacyExports.id, input.exportId), isNull(privacyExports.purgedAt), gt(privacyExports.expiresAt, now))),
  );
  if (!row) throw new PrivacyExportNotFoundError();
  try {
    const { data } = await readPrivateObject(createStorageClient(), input.file === "pdf" ? row.pdfKey : row.archiveKey);
    return input.file === "pdf"
      ? { data, contentType: "application/pdf", fileName: `export-rgpd-${row.id}.pdf` }
      : { data, contentType: "application/zip", fileName: `export-rgpd-${row.id}.zip` };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new PrivacyExportNotFoundError();
    throw error;
  }
}

// Purge horaire (lib/privacy/export-purge.ts) : fichiers des exports expirés
// effacés du stockage, la ligne reste comme trace.
export async function purgeExpiredPrivacyExports(db: AppDatabase, organizationIds: string[], now: Date = new Date()): Promise<number> {
  const storage = createStorageClient();
  let purged = 0;
  for (const organizationId of organizationIds) {
    const expired = await withOrganization(db, organizationId, (tx) =>
      tx
        .select()
        .from(privacyExports)
        .where(and(isNull(privacyExports.purgedAt), lte(privacyExports.expiresAt, now))),
    );
    for (const row of expired) {
      await deletePrivateObject(storage, row.pdfKey);
      await deletePrivateObject(storage, row.archiveKey);
      await withOrganization(db, organizationId, (tx) => tx.update(privacyExports).set({ purgedAt: now }).where(eq(privacyExports.id, row.id)));
      purged += 1;
    }
  }
  return purged;
}
