// Lot 35a (HUB-13, décision D4, ADR 0068) — traitement de fond des exports complets : prend une
// demande en attente (ou abandonnée, battement arrêté), prépare l'archive, la remet au hub qui la
// range et prévient la Propriétaire ; un échec est marqué (archive trop volumineuse, ou autre),
// le fichier temporaire est toujours effacé. Même patron que les imports (ADR 0035, ADR 0043) :
// lancé au démarrage du serveur (instrumentation.ts), un passage à la fois dans le processus ;
// un passage ne visite que les organisations signalées, sauf au démarrage et toutes les cinq
// minutes (tour complet, pour reprendre une préparation interrompue). Purge horaire des archives
// expirées. Journaux : identifiants et motif technique seulement (SEC-20).
import { rm } from "node:fs/promises";
import { appDatabase } from "@symbola/db/client";
import { ArchiveTooLargeError } from "@symbola/privacy";
import {
  claimOrganizationExport,
  completeOrganizationExport,
  failOrganizationExport,
  listOrganizations,
  purgeExpiredOrganizationExports,
  recordOrganizationExportProgress,
  takeAwakenedExportOrganizations,
} from "@/modules/hub/service";
import { buildOrganizationExportArchive } from "./organization-export";

const POLL_INTERVAL_MS = 5000;
const FULL_SCAN_INTERVAL_MS = 5 * 60 * 1000;
const PURGE_INTERVAL_MS = 60 * 60 * 1000;
let lastFullScanAt: number | null = null;

async function organizationsToVisit(now: number): Promise<string[]> {
  const awakened = takeAwakenedExportOrganizations();
  if (lastFullScanAt !== null && now - lastFullScanAt < FULL_SCAN_INTERVAL_MS) return awakened;
  lastFullScanAt = now;
  const all = (await listOrganizations(appDatabase())).map((organization) => organization.id);
  return [...new Set([...awakened, ...all])];
}

// Prépare l'export en attente d'une organisation, s'il y en a un. Renvoie vrai s'il en a pris un.
export async function runOrganizationExport(organizationId: string, now: () => Date = () => new Date()): Promise<boolean> {
  const db = appDatabase();
  const claimed = await claimOrganizationExport(db, organizationId, now());
  if (!claimed) return false;
  let archivePath: string | null = null;
  try {
    const build = await buildOrganizationExportArchive({
      organizationId,
      now: now(),
      onProgress: (progress) => recordOrganizationExportProgress(db, { organizationId, exportId: claimed.id, ...progress, now: now() }),
    });
    archivePath = build.path;
    await completeOrganizationExport(db, {
      organizationId,
      exportId: claimed.id,
      archivePath: build.path,
      entityCounts: build.entityCounts,
      filesTotal: build.filesTotal,
      missingFiles: build.missingFiles,
      now: now(),
    });
  } catch (error) {
    console.error("export complet échoué", { organizationId, exportId: claimed.id, error: error instanceof Error ? error.name : "inconnue" });
    await failOrganizationExport(db, { organizationId, exportId: claimed.id, error: error instanceof ArchiveTooLargeError ? "too_large" : "failed", now: now() });
  } finally {
    if (archivePath) await rm(archivePath, { force: true });
  }
  return true;
}

// `organizationIds` : seulement ces organisations, sans rien signaler (tests).
export async function runOrganizationExportsOnce(organizationIds?: string[]): Promise<number> {
  let prepared = 0;
  for (const organizationId of organizationIds ?? (await organizationsToVisit(Date.now()))) {
    if (await runOrganizationExport(organizationId)) prepared += 1;
  }
  return prepared;
}

export function scheduleOrganizationExports(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runOrganizationExportsOnce()
      .catch((error: unknown) => {
        console.error("exports complets : passage échoué", error instanceof Error ? error.message : error);
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, POLL_INTERVAL_MS).unref();
}

export async function purgeAllExpiredOrganizationExports(now: Date = new Date()): Promise<number> {
  const db = appDatabase();
  const organizations = await listOrganizations(db);
  return purgeExpiredOrganizationExports(
    db,
    organizations.map((organization) => organization.id),
    now,
  );
}

export function scheduleOrganizationExportPurge(): void {
  const run = () => {
    purgeAllExpiredOrganizationExports().catch((error: unknown) => {
      console.error("purge des exports complets expirés échouée", error instanceof Error ? error.message : error);
    });
  };
  run();
  setInterval(run, PURGE_INTERVAL_MS).unref();
}
