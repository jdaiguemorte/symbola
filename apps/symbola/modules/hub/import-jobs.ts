// Lot 15 (IMP-10, ADR 0035) — traitements de fond suivis d'un import, exposés
// par service.ts. La lecture des fiches PDF déposées se fait ici, fiche par
// fiche : chaque fiche, gardée chiffrée dans le stockage privé le temps de la
// lecture, est passée à l'antivirus, lue (ADR 0034), ajoutée comme ligne de
// l'import, puis supprimée avec sa clé. Le placement sur la carte des
// prestataires importés est avancé par l'orchestrateur (lib/import-jobs.ts),
// qui appelle le module vendors. Un traitement reprend là où il s'était
// arrêté : chaque pas est enregistré avant le suivant.
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { importJobs, imports, type ImportJobPayload, type ImportJobResult, type ImportJobStatus } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { parseEnv } from "@symbola/env";
import { createStorageClient, deletePrivateObject, openSealedFile, PrivateObjectNotFoundError, readPrivateObject, scanBuffer } from "@symbola/files";
import {
  EVENT_SHEET_COLUMNS,
  eventSheetRejectionRow,
  eventSheetRow,
  neutralizeCell,
  parseEventSheet,
  readPdfText,
  type EventSheetRejection,
} from "@symbola/import-engine";
import { planningSoftwareProfile } from "@symbola/starter-templates";

export type { ImportJobKind, ImportJobPayload, ImportJobResult, ImportJobStatus } from "@symbola/db/schema/hub";

export type ImportJobView = {
  id: string;
  importId: string;
  kind: "read_sheets" | "place_vendors";
  status: ImportJobStatus;
  total: number;
  done: number;
  result: ImportJobResult;
  error: string | null;
};

type JobRow = typeof importJobs.$inferSelect;

// Lot 16 (L16-ARC-01, ADR 0043) — organisations qui ont un traitement à faire
// avancer, signalées au traitement de fond du même processus dès que leur
// transaction est validée : il ne visite plus toutes les organisations à
// chaque passage. Rangées sur globalThis, comme la réserve de connexions, pour
// qu'un seul ensemble existe par processus.
const AWAKENED_KEY = Symbol.for("symbola.hub.awakenedImportOrganizations");
type GlobalWithAwakened = typeof globalThis & { [AWAKENED_KEY]?: Set<string> };

function awakened(): Set<string> {
  const store = globalThis as GlobalWithAwakened;
  store[AWAKENED_KEY] ??= new Set();
  return store[AWAKENED_KEY];
}

export function wakeImportJobs(organizationId: string): void {
  awakened().add(organizationId);
}

// Les organisations signalées depuis le passage précédent ; l'ensemble est vidé.
export function takeAwakenedImportOrganizations(): string[] {
  const set = awakened();
  const organizationIds = [...set];
  set.clear();
  return organizationIds;
}

const ACTIVE: ImportJobStatus[] = ["pending", "running"];

function toView(row: JobRow): ImportJobView {
  return { id: row.id, importId: row.importId, kind: row.kind, status: row.status, total: row.total, done: row.done, result: row.result, error: row.error };
}

export async function createImportJob(
  db: AppDatabase,
  input: { organizationId: string; importId: string; payload: ImportJobPayload; total: number; now?: Date },
): Promise<ImportJobView> {
  const view = await withOrganization(db, input.organizationId, async (tx) => {
    const [row] = await tx
      .insert(importJobs)
      .values({ organizationId: input.organizationId, importId: input.importId, kind: input.payload.kind, payload: input.payload, total: input.total, ...(input.now ? { createdAt: input.now, updatedAt: input.now } : {}) })
      .returning();
    if (!row) throw new Error("création du traitement échouée");
    return toView(row);
  });
  wakeImportJobs(input.organizationId);
  return view;
}

export async function listImportJobs(db: AppDatabase, organizationId: string, importId: string): Promise<ImportJobView[]> {
  return withOrganization(db, organizationId, async (tx) =>
    (await tx.select().from(importJobs).where(eq(importJobs.importId, importId)).orderBy(asc(importJobs.createdAt))).map(toView),
  );
}

// Lecture des fiches en cours : l'import n'a pas encore toutes ses lignes.
export async function isReadingSheets(db: AppDatabase, organizationId: string, importId: string): Promise<boolean> {
  return withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx
      .select({ id: importJobs.id })
      .from(importJobs)
      .where(and(eq(importJobs.importId, importId), eq(importJobs.kind, "read_sheets"), inArray(importJobs.status, ACTIVE)))
      .limit(1);
    return Boolean(row);
  });
}

export async function listActiveImportJobs(db: AppDatabase, organizationId: string): Promise<(ImportJobView & { payload: ImportJobPayload })[]> {
  return withOrganization(db, organizationId, async (tx) =>
    (await tx.select().from(importJobs).where(inArray(importJobs.status, ACTIVE)).orderBy(asc(importJobs.createdAt))).map((row) => ({ ...toView(row), payload: row.payload })),
  );
}

export async function updateImportJob(
  db: AppDatabase,
  organizationId: string,
  jobId: string,
  patch: Partial<Pick<JobRow, "status" | "done" | "payload" | "result" | "error" | "finishedAt">>,
): Promise<void> {
  await withOrganization(db, organizationId, (tx) => tx.update(importJobs).set({ ...patch, updatedAt: new Date() }).where(eq(importJobs.id, jobId)));
}

// Un pas n'est validé que si l'avancement n'a pas bougé depuis sa lecture :
// deux passages simultanés n'écrivent jamais deux fois le même pas.
export async function advanceImportJob(
  db: AppDatabase,
  organizationId: string,
  job: { id: string; done: number },
  patch: Partial<Pick<JobRow, "status" | "done" | "payload" | "result" | "finishedAt">>,
  alsoInTransaction?: (tx: Parameters<Parameters<typeof withOrganization>[2]>[0]) => Promise<unknown>,
): Promise<boolean> {
  return withOrganization(db, organizationId, async (tx) => {
    const claimed = await tx
      .update(importJobs)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(importJobs.id, job.id), eq(importJobs.done, job.done), inArray(importJobs.status, ACTIVE)))
      .returning({ id: importJobs.id });
    if (claimed.length === 0) return false;
    if (alsoInTransaction) await alsoInTransaction(tx);
    return true;
  });
}

// Fichiers encore gardés d'une lecture de fiches : supprimés avec leur clé.
async function deleteStoredSheets(payload: ImportJobPayload): Promise<void> {
  if (payload.kind !== "read_sheets") return;
  const keys = payload.files.map((file) => file.objectKey).filter((key): key is string => Boolean(key));
  if (keys.length === 0) return;
  const storage = createStorageClient();
  for (const key of keys) await deletePrivateObject(storage, key).catch(() => undefined);
}

function withoutStoredFiles(payload: ImportJobPayload): ImportJobPayload {
  if (payload.kind !== "read_sheets") return payload;
  return { ...payload, files: [] };
}

// Import abandonné, expiré ou annulé : ses traitements en cours s'arrêtent,
// les fiches encore gardées sont supprimées.
export async function cancelImportJobs(db: AppDatabase, organizationId: string, importId: string, now: Date = new Date()): Promise<number> {
  const active = await withOrganization(db, organizationId, (tx) =>
    tx.select().from(importJobs).where(and(eq(importJobs.importId, importId), inArray(importJobs.status, ACTIVE))),
  );
  for (const job of active) {
    await deleteStoredSheets(job.payload);
    await updateImportJob(db, organizationId, job.id, { status: "cancelled", payload: withoutStoredFiles(job.payload), finishedAt: now });
  }
  return active.length;
}

async function appendImportRow(tx: Parameters<Parameters<typeof withOrganization>[2]>[0], importId: string, cells: string[], lineNumber: number): Promise<boolean> {
  {
    const updated = await tx
      .update(imports)
      .set({
        rows: sql`coalesce(${imports.rows}, '[]'::jsonb) || ${JSON.stringify([cells])}::jsonb`,
        sourceLineNumbers: sql`coalesce(${imports.sourceLineNumbers}, '[]'::jsonb) || ${JSON.stringify([lineNumber])}::jsonb`,
        rowCount: sql`${imports.rowCount} + 1`,
        neutralizedCells: sql`${imports.neutralizedCells} + ${cells.filter((cell) => cell.startsWith("'")).length}`,
        updatedAt: new Date(),
      })
      .where(and(eq(imports.id, importId), eq(imports.status, "draft")))
      .returning({ id: imports.id });
    return updated.length > 0;
  }
}

async function readSheet(file: { fileName: string; objectKey: string | null; secret: string | null; rejection?: string }, today: string): Promise<string[]> {
  const reject = (reason: EventSheetRejection) => EVENT_SHEET_COLUMNS.map((column) => eventSheetRejectionRow(file.fileName, reason)[column]);
  if (file.rejection) return reject(file.rejection as EventSheetRejection);
  if (!file.objectKey || !file.secret) return reject("unreadable");
  const stored = await readPrivateObject(createStorageClient(), file.objectKey);
  let bytes: Buffer;
  try {
    bytes = openSealedFile(stored.data, file.secret);
  } catch {
    return reject("unreadable");
  }
  const env = parseEnv(process.env);
  if ((await scanBuffer(bytes, { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT })).infected) return reject("infected");
  const read = await readPdfText(new Uint8Array(bytes), { maxBytes: bytes.length, maxPages: 3, timeoutMs: 10_000 });
  if (!read.ok) return reject(read.reason);
  const parsed = read.pages[0] ? parseEventSheet(read.pages[0], planningSoftwareProfile().eventSheet) : null;
  if (!parsed?.ok) return reject("not_event_sheet");
  const row = eventSheetRow(file.fileName, parsed.sheet, today);
  return EVENT_SHEET_COLUMNS.map((column) => row[column]);
}

// Un pas de lecture : la fiche suivante devient une ligne de l'import, puis
// son fichier et sa clé sont effacés. Renvoie false quand il n'y a plus rien.
export async function readNextSheet(db: AppDatabase, organizationId: string, job: ImportJobView & { payload: ImportJobPayload }, now: Date = new Date()): Promise<boolean> {
  if (job.payload.kind !== "read_sheets") return false;
  const [importRow] = await withOrganization(db, organizationId, (tx) => tx.select({ status: imports.status }).from(imports).where(eq(imports.id, job.importId)));
  if (importRow?.status !== "draft") {
    await cancelImportJobs(db, organizationId, job.importId, now);
    return false;
  }
  const file = job.payload.files[job.done];
  if (!file) {
    await updateImportJob(db, organizationId, job.id, { status: "done", finishedAt: now });
    return false;
  }
  let read: string[];
  try {
    read = await readSheet(file, job.payload.today);
  } catch (error) {
    // Fiche déjà lue et supprimée par un passage simultané : il a la main.
    if (error instanceof PrivateObjectNotFoundError) return false;
    throw error;
  }
  const cells = read.map((cell) => neutralizeCell(cell).value);
  const done = job.done + 1;
  // Lecture finie : plus rien n'est gardé des fiches (ni nom, ni fichier, ni clé).
  const files = done >= job.total ? [] : job.payload.files.map((entry, index) => (index === job.done ? { ...entry, objectKey: null, secret: null } : entry));
  // La ligne et l'avancement s'écrivent ensemble, ou pas du tout.
  const claimed = await advanceImportJob(
    db,
    organizationId,
    job,
    { status: done >= job.total ? "done" : "running", done, payload: { ...job.payload, files }, ...(done >= job.total ? { finishedAt: now } : {}) },
    (tx) => appendImportRow(tx, job.importId, cells, job.done + 1),
  );
  if (!claimed) return false;
  if (file.objectKey) await deletePrivateObject(createStorageClient(), file.objectKey).catch(() => undefined);
  job.done = done;
  job.payload = { ...job.payload, files };
  return done < job.total;
}

// Traitement en échec relancé par la planner : il reprend là où il s'était arrêté.
export async function retryImportJob(db: AppDatabase, organizationId: string, jobId: string): Promise<boolean> {
  const retried = await withOrganization(db, organizationId, async (tx) => {
    const updated = await tx
      .update(importJobs)
      .set({ status: "pending", error: null, finishedAt: null, updatedAt: new Date() })
      .where(and(eq(importJobs.id, jobId), eq(importJobs.status, "failed")))
      .returning({ id: importJobs.id });
    return updated.length > 0;
  });
  if (retried) wakeImportJobs(organizationId);
  return retried;
}
