// Lot 35b (HUB-13 ; décisions D6 et D7 ; ADR 0098) — reprises d'un export Symbola dans une
// organisation vide. La Propriétaire seule dépose l'archive ; elle est rangée dans le stockage privé
// le temps de la reprise, faite en arrière-plan (lib/export : un traitement à la fois par
// organisation, en une seule transaction), puis effacée, que la reprise réussisse ou non. La ligne
// garde l'état et le bilan (nombres par entité, motifs), sans donnée personnelle. Demande, fin et
// échec vont au journal (SEC-19).
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, lt, or } from "drizzle-orm";
import { listTeam } from "@symbola/auth";
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appendAudit } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { organizationImports, type OrganizationImportError, type OrganizationImportReport, type OrganizationImportStatus } from "@symbola/db/schema/hub";
import { withOrganization, type OrganizationTransaction } from "@symbola/db/with-organization";
import { createStorageClient, deletePrivateObject, uploadPrivateFile } from "@symbola/files";

// Une reprise dont le battement s'est arrêté depuis dix minutes (serveur redémarré) est reprise
// depuis le début : sa transaction n'a rien écrit.
export const ORGANIZATION_IMPORT_STALE_MS = 10 * 60 * 1000;
const LISTED_IMPORTS = 5;

export class OrganizationImportForbiddenError extends Error {}
export class OrganizationImportNotFoundError extends Error {}
// Une reprise est déjà en attente ou en cours dans cette organisation.
export class OrganizationImportActiveError extends Error {}

type ImportRow = typeof organizationImports.$inferSelect;

export type OrganizationImportView = {
  id: string;
  status: OrganizationImportStatus;
  requestedAt: Date;
  finishedAt: Date | null;
  sourceGeneratedAt: Date | null;
  report: OrganizationImportReport | null;
  error: OrganizationImportError | null;
  errorDetail: string | null;
};

function toView(row: ImportRow): OrganizationImportView {
  return {
    id: row.id,
    status: row.status,
    requestedAt: row.requestedAt,
    finishedAt: row.finishedAt,
    sourceGeneratedAt: row.sourceGeneratedAt,
    report: row.report ?? null,
    error: row.error,
    errorDetail: row.errorDetail,
  };
}

export async function assertImportOwner(db: AppDatabase, organizationId: string, userId: string): Promise<void> {
  const member = (await listTeam(db, organizationId)).find((candidate) => candidate.id === userId);
  if (!member || member.role !== "owner" || member.disabledAt) throw new OrganizationImportForbiddenError();
}

// Même patron que les exports (ADR 0043) : organisations à visiter au prochain passage.
const AWAKENED_KEY = Symbol.for("symbola.hub.awakenedImportOrganizations");
type GlobalWithAwakened = typeof globalThis & { [AWAKENED_KEY]?: Set<string> };

function awakened(): Set<string> {
  const store = globalThis as GlobalWithAwakened;
  store[AWAKENED_KEY] ??= new Set();
  return store[AWAKENED_KEY];
}

export function wakeOrganizationImports(organizationId: string): void {
  awakened().add(organizationId);
}

export function takeAwakenedOrganizationImports(): string[] {
  const set = awakened();
  const ids = [...set];
  set.clear();
  return ids;
}

async function findActiveImport(db: AppDatabase, organizationId: string): Promise<ImportRow | null> {
  const [row] = await withOrganization(db, organizationId, (tx) =>
    tx
      .select()
      .from(organizationImports)
      .where(and(eq(organizationImports.organizationId, organizationId), or(eq(organizationImports.status, "pending"), eq(organizationImports.status, "running")))),
  );
  return row ?? null;
}

// Archive déposée (fichier temporaire de la route d'envoi) : rangée dans le stockage privé, puis la
// demande est enregistrée. Une seule reprise à la fois (index unique).
export async function requestOrganizationImport(
  db: AppDatabase,
  input: { organizationId: string; userId: string; archivePath: string; now?: Date },
): Promise<OrganizationImportView> {
  const now = input.now ?? new Date();
  await assertImportOwner(db, input.organizationId, input.userId);
  if (await findActiveImport(db, input.organizationId)) throw new OrganizationImportActiveError();
  const id = randomUUID();
  const storage = createStorageClient();
  const key = `organization-imports/${input.organizationId}/${id}.zip`;
  const archiveBytes = await uploadPrivateFile(storage, { key, path: input.archivePath, contentType: "application/zip" });
  try {
    const row = await withOrganization(db, input.organizationId, async (tx) => {
      const [created] = await tx
        .insert(organizationImports)
        .values({ id, organizationId: input.organizationId, requestedByUserId: input.userId, requestedAt: now, archiveKey: key, archiveBytes })
        .returning();
      if (!created) throw new Error("demande de reprise non enregistrée");
      await appendAudit(tx, { organizationId: input.organizationId, action: "hub.organization_import.requested", objectId: id, details: { bytes: archiveBytes } });
      return created;
    });
    wakeOrganizationImports(input.organizationId);
    return toView(row);
  } catch (error) {
    await deletePrivateObject(storage, key).catch(() => undefined);
    if (await findActiveImport(db, input.organizationId)) throw new OrganizationImportActiveError();
    throw error;
  }
}

export async function listOrganizationImports(db: AppDatabase, organizationId: string): Promise<OrganizationImportView[]> {
  const rows = await withOrganization(db, organizationId, (tx) =>
    tx.select().from(organizationImports).where(eq(organizationImports.organizationId, organizationId)).orderBy(desc(organizationImports.requestedAt)).limit(LISTED_IMPORTS),
  );
  return rows.map(toView);
}

export type ClaimedOrganizationImport = { id: string; requestedByUserId: string; archiveKey: string | null };

// Le traitement de fond prend la demande la plus ancienne (en attente, ou abandonnée).
export async function claimOrganizationImport(db: AppDatabase, organizationId: string, now: Date = new Date()): Promise<ClaimedOrganizationImport | null> {
  const staleBefore = new Date(now.getTime() - ORGANIZATION_IMPORT_STALE_MS);
  return withActor(SYSTEM_ACTOR, () =>
    withOrganization(db, organizationId, async (tx) => {
      const [candidate] = await tx
        .select({ id: organizationImports.id, startedAt: organizationImports.startedAt })
        .from(organizationImports)
        .where(
          and(
            eq(organizationImports.organizationId, organizationId),
            or(eq(organizationImports.status, "pending"), and(eq(organizationImports.status, "running"), lt(organizationImports.heartbeatAt, staleBefore))),
          ),
        )
        .orderBy(asc(organizationImports.requestedAt))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!candidate) return null;
      const [claimed] = await tx
        .update(organizationImports)
        .set({ status: "running", startedAt: candidate.startedAt ?? now, heartbeatAt: now })
        .where(eq(organizationImports.id, candidate.id))
        .returning({ id: organizationImports.id, requestedByUserId: organizationImports.requestedByUserId, archiveKey: organizationImports.archiveKey });
      return claimed ?? null;
    }),
  );
}

export async function recordOrganizationImportHeartbeat(db: AppDatabase, input: { organizationId: string; importId: string; now?: Date }): Promise<void> {
  await withActor(SYSTEM_ACTOR, () =>
    withOrganization(db, input.organizationId, (tx) =>
      tx
        .update(organizationImports)
        .set({ heartbeatAt: input.now ?? new Date() })
        .where(and(eq(organizationImports.id, input.importId), eq(organizationImports.status, "running"))),
    ),
  );
}

// Fin de la reprise, dans sa transaction (les données et le bilan, ou rien).
export async function finishOrganizationImportInTransaction(
  tx: OrganizationTransaction,
  input: { organizationId: string; importId: string; report: OrganizationImportReport; sourceGeneratedAt: Date; now?: Date },
): Promise<void> {
  const now = input.now ?? new Date();
  const [updated] = await tx
    .update(organizationImports)
    .set({ status: "done", finishedAt: now, heartbeatAt: now, report: input.report, sourceGeneratedAt: input.sourceGeneratedAt, error: null, errorDetail: null })
    .where(and(eq(organizationImports.id, input.importId), eq(organizationImports.status, "running")))
    .returning({ id: organizationImports.id });
  if (!updated) throw new OrganizationImportNotFoundError();
  const rows = input.report.entities.reduce((sum, entity) => sum + entity.imported, 0);
  await appendAudit(tx, { organizationId: input.organizationId, action: "hub.organization_import.completed", objectId: input.importId, details: { rows, files: input.report.files.imported } });
}

export async function failOrganizationImport(
  db: AppDatabase,
  input: { organizationId: string; importId: string; error: OrganizationImportError; detail?: string | null; now?: Date },
): Promise<void> {
  await withActor(SYSTEM_ACTOR, () =>
    withOrganization(db, input.organizationId, async (tx) => {
      await tx
        .update(organizationImports)
        .set({ status: "failed", error: input.error, errorDetail: input.detail ?? null, finishedAt: input.now ?? new Date(), heartbeatAt: input.now ?? new Date() })
        .where(and(eq(organizationImports.id, input.importId), eq(organizationImports.status, "running")));
      await appendAudit(tx, { organizationId: input.organizationId, action: "hub.organization_import.failed", objectId: input.importId, details: { error: input.error } });
    }),
  );
}

// L'archive déposée est effacée à la fin, réussie ou non ; la ligne reste.
export async function forgetOrganizationImportArchive(db: AppDatabase, input: { organizationId: string; importId: string }): Promise<void> {
  const [row] = await withOrganization(db, input.organizationId, (tx) =>
    tx.select({ archiveKey: organizationImports.archiveKey }).from(organizationImports).where(eq(organizationImports.id, input.importId)),
  );
  if (row?.archiveKey) await deletePrivateObject(createStorageClient(), row.archiveKey).catch(() => undefined);
  await withActor(SYSTEM_ACTOR, () =>
    withOrganization(db, input.organizationId, (tx) => tx.update(organizationImports).set({ archiveKey: null }).where(eq(organizationImports.id, input.importId))),
  );
}
