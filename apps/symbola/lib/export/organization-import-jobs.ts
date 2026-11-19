// Lot 35b (HUB-13 ; décisions D6 et D7 ; ADR 0098) — traitement de fond des reprises d'un export :
// prend une demande en attente (ou abandonnée, battement arrêté), recopie l'archive déposée dans un
// fichier temporaire, la reprend (lib/export/organization-import), puis efface l'archive déposée et
// le fichier temporaire, que la reprise réussisse ou non. Un refus garde son motif. Même patron que
// les exports (ADR 0068, ADR 0043) : lancé au démarrage du serveur (instrumentation.ts), un passage à
// la fois. Journaux : identifiants et motif technique seulement (SEC-20).
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { appDatabase } from "@symbola/db/client";
import { createStorageClient, openPrivateObjectStream } from "@symbola/files";
import {
  claimOrganizationImport,
  failOrganizationImport,
  forgetOrganizationImportArchive,
  listOrganizations,
  recordOrganizationImportHeartbeat,
  takeAwakenedOrganizationImports,
} from "@/modules/hub/service";
import { importOrganizationArchive, OrganizationImportRefusedError } from "./organization-import";

const POLL_INTERVAL_MS = 5000;
const FULL_SCAN_INTERVAL_MS = 5 * 60 * 1000;
let lastFullScanAt: number | null = null;

async function organizationsToVisit(now: number): Promise<string[]> {
  const awakened = takeAwakenedOrganizationImports();
  if (lastFullScanAt !== null && now - lastFullScanAt < FULL_SCAN_INTERVAL_MS) return awakened;
  lastFullScanAt = now;
  const all = (await listOrganizations(appDatabase())).map((organization) => organization.id);
  return [...new Set([...awakened, ...all])];
}

async function downloadArchive(key: string): Promise<string> {
  const path = join(tmpdir(), `symbola-reprise-${randomUUID()}.zip`);
  const { stream } = await openPrivateObjectStream(createStorageClient(), key);
  await pipeline(Readable.fromWeb(stream as unknown as NodeReadableStream<Uint8Array>), createWriteStream(path, { flags: "wx" }));
  return path;
}

// Reprend l'archive en attente d'une organisation, s'il y en a une. Renvoie vrai s'il en a pris une.
export async function runOrganizationImport(organizationId: string, now: () => Date = () => new Date()): Promise<boolean> {
  const db = appDatabase();
  const claimed = await claimOrganizationImport(db, organizationId, now());
  if (!claimed) return false;
  let path: string | null = null;
  try {
    if (!claimed.archiveKey) throw new OrganizationImportRefusedError("unreadable");
    path = await downloadArchive(claimed.archiveKey);
    await importOrganizationArchive({
      organizationId,
      importerUserId: claimed.requestedByUserId,
      importId: claimed.id,
      path,
      now: now(),
      onHeartbeat: () => recordOrganizationImportHeartbeat(db, { organizationId, importId: claimed.id, now: now() }),
    });
  } catch (error) {
    const refused = error instanceof OrganizationImportRefusedError;
    if (!refused) console.error("reprise d'un export échouée", { organizationId, importId: claimed.id, error: error instanceof Error ? error.name : "inconnue" });
    await failOrganizationImport(db, { organizationId, importId: claimed.id, error: refused ? error.code : "failed", detail: refused ? error.detail : null, now: now() });
  } finally {
    if (path) await rm(path, { force: true });
    await forgetOrganizationImportArchive(db, { organizationId, importId: claimed.id });
  }
  return true;
}

// `organizationIds` : seulement ces organisations, sans rien signaler (tests).
export async function runOrganizationImportsOnce(organizationIds?: string[]): Promise<number> {
  let done = 0;
  for (const organizationId of organizationIds ?? (await organizationsToVisit(Date.now()))) {
    if (await runOrganizationImport(organizationId)) done += 1;
  }
  return done;
}

export function scheduleOrganizationImports(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runOrganizationImportsOnce()
      .catch((error: unknown) => {
        console.error("reprises d'export : passage échoué", error instanceof Error ? error.message : error);
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, POLL_INTERVAL_MS).unref();
}
