// Lot 35a (HUB-13, DAT-13 ; décisions D4 et D5 ; ADR 0068) — exports complets de l'organisation.
// La Propriétaire seule les demande et les télécharge ; l'archive est préparée en arrière-plan
// (lib/export : un traitement à la fois par organisation, repris s'il est interrompu), rangée
// dans le stockage privé, servie par l'app après contrôle des droits (ADR 0027) pendant la durée
// réglée par l'Admin, puis effacée par la purge horaire ; la ligne reste comme trace, sans donnée
// personnelle. Demande, mise à disposition et téléchargement vont au journal (SEC-19).
import { and, asc, desc, eq, gte, isNull, lt, lte, or } from "drizzle-orm";
import { listTeam } from "@symbola/auth";
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appendAudit, recordAudit } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { organizationExports, type OrganizationExportError, type OrganizationExportStatus } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { parseEnv } from "@symbola/env";
import { createStorageClient, deletePrivateObject, openPrivateObjectStream, PrivateObjectNotFoundError, uploadPrivateFile } from "@symbola/files";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { sendSymbolaEmail } from "./emails";
import { findOrganizationById, findPlatformSettings, insertDefaultPlatformSettings } from "./repository";

const DAY_MS = 86_400_000;
// Une préparation dont le battement s'est arrêté depuis dix minutes (serveur redémarré) est
// reprise depuis le début.
export const ORGANIZATION_EXPORT_STALE_MS = 10 * 60 * 1000;
// Exports affichés sur l'écran (les plus récents).
const LISTED_EXPORTS = 5;

export class OrganizationExportNotFoundError extends Error {}
// Une Planner (ou un compte retiré) ne demande ni ne télécharge un export (décision D5).
export class OrganizationExportForbiddenError extends Error {}

type ExportRow = typeof organizationExports.$inferSelect;

export type OrganizationExportView = {
  id: string;
  status: OrganizationExportStatus;
  requestedAt: Date;
  readyAt: Date | null;
  expiresAt: Date | null;
  filesTotal: number;
  filesDone: number;
  missingFiles: number;
  sizeBytes: number | null;
  rowCount: number;
  error: OrganizationExportError | null;
  // Prête, encore gardée : téléchargeable.
  downloadable: boolean;
};

function toView(row: ExportRow, now: Date): OrganizationExportView {
  return {
    id: row.id,
    status: row.status,
    requestedAt: row.requestedAt,
    readyAt: row.readyAt,
    expiresAt: row.expiresAt,
    filesTotal: row.filesTotal,
    filesDone: row.filesDone,
    missingFiles: row.missingFiles,
    sizeBytes: row.sizeBytes,
    rowCount: Object.values(row.entityCounts).reduce((sum, count) => sum + count, 0),
    error: row.error,
    downloadable: row.status === "ready" && row.purgedAt === null && row.archiveKey !== null && row.expiresAt !== null && row.expiresAt > now,
  };
}

async function assertOwner(db: AppDatabase, organizationId: string, userId: string): Promise<void> {
  const member = (await listTeam(db, organizationId)).find((candidate) => candidate.id === userId);
  if (!member || member.role !== "owner" || member.disabledAt) throw new OrganizationExportForbiddenError();
}

// Organisations à visiter au prochain passage du traitement de fond (export demandé). Mémoire
// du processus : un seul processus applicatif (ADR 0011) ; un tour complet a lieu au démarrage
// et toutes les cinq minutes, en filet de sécurité (même patron que les imports, ADR 0043).
// Rangées sur globalThis : l'action de l'écran et le traitement lancé par instrumentation.ts
// sont compilés à part, et doivent pourtant partager un seul ensemble par processus.
const AWAKENED_KEY = Symbol.for("symbola.hub.awakenedExportOrganizations");
type GlobalWithAwakened = typeof globalThis & { [AWAKENED_KEY]?: Set<string> };

function awakened(): Set<string> {
  const store = globalThis as GlobalWithAwakened;
  store[AWAKENED_KEY] ??= new Set();
  return store[AWAKENED_KEY];
}

export function wakeOrganizationExports(organizationId: string): void {
  awakened().add(organizationId);
}

export function takeAwakenedExportOrganizations(): string[] {
  const set = awakened();
  const ids = [...set];
  set.clear();
  return ids;
}

export async function getOrganizationExportRetentionDays(db: AppDatabase): Promise<number> {
  let settings = await findPlatformSettings(db);
  if (!settings) {
    await insertDefaultPlatformSettings(db);
    settings = await findPlatformSettings(db);
  }
  if (!settings) throw new Error("réglages de la plateforme introuvables");
  return settings.organizationExportRetentionDays;
}

async function findActiveExport(db: AppDatabase, organizationId: string): Promise<ExportRow | null> {
  const [row] = await withOrganization(db, organizationId, (tx) =>
    tx
      .select()
      .from(organizationExports)
      .where(and(eq(organizationExports.organizationId, organizationId), or(eq(organizationExports.status, "pending"), eq(organizationExports.status, "running")))),
  );
  return row ?? null;
}

export type RequestOrganizationExportResult = { outcome: "requested" | "already_active"; export: OrganizationExportView };

// Un seul export en préparation à la fois (index unique) : une seconde demande renvoie celle en
// cours, y compris quand deux demandes arrivent ensemble.
export async function requestOrganizationExport(
  db: AppDatabase,
  input: { organizationId: string; userId: string; now?: Date },
): Promise<RequestOrganizationExportResult> {
  const now = input.now ?? new Date();
  await assertOwner(db, input.organizationId, input.userId);
  const active = await findActiveExport(db, input.organizationId);
  if (active) return { outcome: "already_active", export: toView(active, now) };
  try {
    const row = await withOrganization(db, input.organizationId, async (tx) => {
      const [created] = await tx
        .insert(organizationExports)
        .values({ organizationId: input.organizationId, requestedByUserId: input.userId, requestedAt: now })
        .returning();
      if (!created) throw new Error("demande d'export non enregistrée");
      await appendAudit(tx, { organizationId: input.organizationId, action: "hub.organization_export.requested", objectId: created.id });
      return created;
    });
    wakeOrganizationExports(input.organizationId);
    return { outcome: "requested", export: toView(row, now) };
  } catch (error) {
    const raced = await findActiveExport(db, input.organizationId);
    if (raced) return { outcome: "already_active", export: toView(raced, now) };
    throw error;
  }
}

export async function listOrganizationExports(db: AppDatabase, organizationId: string, now: Date = new Date()): Promise<OrganizationExportView[]> {
  const rows = await withOrganization(db, organizationId, (tx) =>
    tx
      .select()
      .from(organizationExports)
      .where(eq(organizationExports.organizationId, organizationId))
      .orderBy(desc(organizationExports.requestedAt))
      .limit(LISTED_EXPORTS),
  );
  return rows.map((row) => toView(row, now));
}

export type ClaimedOrganizationExport = { id: string; requestedByUserId: string };

// Le traitement de fond prend la demande la plus ancienne : en attente, ou en préparation mais
// abandonnée (battement arrêté). Verrou sans attente : deux passages ne prennent jamais la même.
export async function claimOrganizationExport(db: AppDatabase, organizationId: string, now: Date = new Date()): Promise<ClaimedOrganizationExport | null> {
  const staleBefore = new Date(now.getTime() - ORGANIZATION_EXPORT_STALE_MS);
  return withActor(SYSTEM_ACTOR, () =>
    withOrganization(db, organizationId, async (tx) => {
      const [candidate] = await tx
        .select({ id: organizationExports.id, startedAt: organizationExports.startedAt })
        .from(organizationExports)
        .where(
          and(
            eq(organizationExports.organizationId, organizationId),
            or(eq(organizationExports.status, "pending"), and(eq(organizationExports.status, "running"), lt(organizationExports.heartbeatAt, staleBefore))),
          ),
        )
        .orderBy(asc(organizationExports.requestedAt))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!candidate) return null;
      const [claimed] = await tx
        .update(organizationExports)
        .set({ status: "running", startedAt: candidate.startedAt ?? now, heartbeatAt: now, filesDone: 0 })
        .where(eq(organizationExports.id, candidate.id))
        .returning({ id: organizationExports.id, requestedByUserId: organizationExports.requestedByUserId });
      return claimed ?? null;
    }),
  );
}

// Avancement (fichiers mis dans l'archive) et battement de la préparation.
export async function recordOrganizationExportProgress(
  db: AppDatabase,
  input: { organizationId: string; exportId: string; filesDone: number; filesTotal: number; now?: Date },
): Promise<void> {
  await withActor(SYSTEM_ACTOR, () =>
    withOrganization(db, input.organizationId, (tx) =>
      tx
        .update(organizationExports)
        .set({ filesDone: input.filesDone, filesTotal: input.filesTotal, heartbeatAt: input.now ?? new Date() })
        .where(and(eq(organizationExports.id, input.exportId), eq(organizationExports.status, "running"))),
    ),
  );
}

// Archive prête (écrite sur le disque par lib/export) : rangée dans le stockage privé, puis la
// ligne passe à « prête », avec sa date d'expiration ; la Propriétaire qui l'a demandée est
// prévenue par e-mail (sans l'archive, ni lien qui y mène directement).
export async function completeOrganizationExport(
  db: AppDatabase,
  input: {
    organizationId: string;
    exportId: string;
    archivePath: string;
    entityCounts: Record<string, number>;
    filesTotal: number;
    missingFiles: number;
    now?: Date;
  },
): Promise<OrganizationExportView> {
  const now = input.now ?? new Date();
  const storage = createStorageClient();
  const key = `organization-exports/${input.organizationId}/${input.exportId}.zip`;
  const sizeBytes = await uploadPrivateFile(storage, { key, path: input.archivePath, contentType: "application/zip" });
  const retentionDays = await getOrganizationExportRetentionDays(db);
  let row: ExportRow;
  try {
    row = await withActor(SYSTEM_ACTOR, () =>
      withOrganization(db, input.organizationId, async (tx) => {
        const [updated] = await tx
          .update(organizationExports)
          .set({
            status: "ready",
            readyAt: now,
            expiresAt: new Date(now.getTime() + retentionDays * DAY_MS),
            heartbeatAt: now,
            archiveKey: key,
            sizeBytes,
            entityCounts: input.entityCounts,
            filesTotal: input.filesTotal,
            filesDone: input.filesTotal,
            missingFiles: input.missingFiles,
          })
          .where(and(eq(organizationExports.id, input.exportId), eq(organizationExports.status, "running")))
          .returning();
        if (!updated) throw new OrganizationExportNotFoundError();
        await appendAudit(tx, {
          organizationId: input.organizationId,
          action: "hub.organization_export.ready",
          objectId: input.exportId,
          details: { rows: toView(updated, now).rowCount, files: input.filesTotal - input.missingFiles, missingFiles: input.missingFiles, bytes: sizeBytes },
        });
        return updated;
      }),
    );
  } catch (error) {
    // Aucune archive sans trace.
    await deletePrivateObject(storage, key).catch(() => undefined);
    throw error;
  }
  try {
    await notifyExportReady(db, row);
  } catch (error) {
    // L'export reste prêt : l'écran le montre. Motif technique seulement (SEC-20).
    console.error("e-mail de l'export complet non envoyé", { organizationId: input.organizationId, exportId: input.exportId, error: error instanceof Error ? error.name : "inconnue" });
  }
  return toView(row, now);
}

export async function failOrganizationExport(
  db: AppDatabase,
  input: { organizationId: string; exportId: string; error: OrganizationExportError; now?: Date },
): Promise<void> {
  await withActor(SYSTEM_ACTOR, () =>
    withOrganization(db, input.organizationId, (tx) =>
      tx
        .update(organizationExports)
        .set({ status: "failed", error: input.error, heartbeatAt: input.now ?? new Date() })
        .where(and(eq(organizationExports.id, input.exportId), eq(organizationExports.status, "running"))),
    ),
  );
}

export type OrganizationExportArchive = { stream: ReadableStream<Uint8Array>; sizeBytes: number | null; fileName: string };

// Archive d'un export prêt et encore gardé, lue en flux dans le stockage privé ; le
// téléchargement va au journal.
export async function openOrganizationExportArchive(
  db: AppDatabase,
  input: { organizationId: string; userId: string; exportId: string; now?: Date },
): Promise<OrganizationExportArchive> {
  const now = input.now ?? new Date();
  await assertOwner(db, input.organizationId, input.userId);
  const [row] = await withOrganization(db, input.organizationId, (tx) =>
    tx
      .select()
      .from(organizationExports)
      .where(and(eq(organizationExports.organizationId, input.organizationId), eq(organizationExports.id, input.exportId))),
  );
  if (!row || !toView(row, now).downloadable || !row.archiveKey) throw new OrganizationExportNotFoundError();
  let opened: Awaited<ReturnType<typeof openPrivateObjectStream>>;
  try {
    opened = await openPrivateObjectStream(createStorageClient(), row.archiveKey);
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new OrganizationExportNotFoundError();
    throw error;
  }
  await recordAudit(db, { organizationId: input.organizationId, action: "hub.organization_export.downloaded", objectId: row.id });
  const day = (row.readyAt ?? row.requestedAt).toISOString().slice(0, 10);
  return { stream: opened.stream, sizeBytes: row.sizeBytes ?? opened.contentLength, fileName: `symbola-export-${day}.zip` };
}

// Purge horaire (lib/export) : archives expirées effacées du stockage, la ligne reste.
export async function purgeExpiredOrganizationExports(db: AppDatabase, organizationIds: string[], now: Date = new Date()): Promise<number> {
  const storage = createStorageClient();
  let purged = 0;
  for (const organizationId of organizationIds) {
    const expired = await withOrganization(db, organizationId, (tx) =>
      tx
        .select()
        .from(organizationExports)
        .where(
          and(
            eq(organizationExports.organizationId, organizationId),
            eq(organizationExports.status, "ready"),
            isNull(organizationExports.purgedAt),
            lte(organizationExports.expiresAt, now),
          ),
        ),
    );
    for (const row of expired) {
      if (row.archiveKey) await deletePrivateObject(storage, row.archiveKey);
      await withActor(SYSTEM_ACTOR, () =>
        withOrganization(db, organizationId, (tx) => tx.update(organizationExports).set({ purgedAt: now, archiveKey: null }).where(eq(organizationExports.id, row.id))),
      );
      purged += 1;
    }
  }
  return purged;
}

// Texte de l'e-mail, dans la langue de l'organisation : ni l'archive, ni de lien direct vers
// elle ; l'écran se trouve après connexion.
// Lot 38a (D3) : texte fixe de Symbola, dans les fichiers de traduction.
export function organizationExportReadyMail(input: { locale: Locale; organizationName: string; expiresAt: Date; url: string }): { subject: string; text: string; button: string } {
  const t = createTranslator({ locale: input.locale, messages: input.locale === "en" ? enMessages : frMessages, namespace: "Emails.fixed.exportReady" });
  return { subject: t("subject"), text: t("body", { organization: input.organizationName, until: formatDateTime(input.expiresAt, input.locale), url: input.url }), button: t("button") };
}

async function notifyExportReady(db: AppDatabase, row: ExportRow): Promise<void> {
  const [organization, team] = await Promise.all([findOrganizationById(db, row.organizationId), listTeam(db, row.organizationId)]);
  const requester = team.find((member) => member.id === row.requestedByUserId && !member.disabledAt);
  if (!organization || !requester || !row.expiresAt) return;
  const env = parseEnv(process.env);
  const mail = organizationExportReadyMail({
    locale: organization.language === "en" ? "en" : "fr",
    organizationName: organization.name,
    expiresAt: row.expiresAt,
    url: `${env.APP_PUBLIC_URL}/parametres/export`,
  });
  const locale = organization.language === "en" ? "en" : "fr";
  const url = `${env.APP_PUBLIC_URL}/parametres/export`;
  // Lot 40b (ARC-10) : un seul e-mail par export, même si la notification est rejouée.
  await sendSymbolaEmail({ to: requester.email, locale, subject: mail.subject, body: mail.text, button: { label: mail.button, url }, organizationId: row.organizationId, idempotencyKey: `export-ready:${row.id}` });
}

// Lot 49 (RGP-08, D9 ; DPO-6) — la purge des invités efface aussi les exports stockés qui les
// contiennent : les archives prêtes, non encore purgées, préparées depuis la date donnée et où des
// foyers d'invités ont été comptés. Renvoie le nombre d'archives supprimées (la titulaire en est
// prévenue par l'appelant).
export async function purgeOrganizationExportsWithGuests(db: AppDatabase, organizationId: string, since: Date, now: Date = new Date()): Promise<number> {
  const rows = await withOrganization(db, organizationId, (tx) =>
    tx
      .select()
      .from(organizationExports)
      .where(and(eq(organizationExports.organizationId, organizationId), eq(organizationExports.status, "ready"), isNull(organizationExports.purgedAt), gte(organizationExports.createdAt, since))),
  );
  const withGuests = rows.filter((row) => (row.entityCounts["guests/households"] ?? 0) > 0);
  if (withGuests.length === 0) return 0;
  const storage = createStorageClient();
  for (const row of withGuests) {
    if (row.archiveKey) await deletePrivateObject(storage, row.archiveKey);
    await withActor(SYSTEM_ACTOR, () => withOrganization(db, organizationId, (tx) => tx.update(organizationExports).set({ purgedAt: now, archiveKey: null }).where(eq(organizationExports.id, row.id))));
  }
  return withGuests.length;
}
