// Lot 15 (IMP-10, GEO-01, ADR 0035) — fait avancer les traitements de fond
// des imports, organisation par organisation : lecture des fiches PDF (hub)
// et placement sur la carte des prestataires importés (module vendors, par
// son service.ts). Chaque pas est enregistré : un traitement interrompu
// (redémarrage du serveur) reprend là où il s'était arrêté. Lancé au démarrage
// du serveur (instrumentation.ts), toutes les secondes, jamais deux passages à
// la fois dans le même processus.
import { appDatabase, type AppDatabase } from "@symbola/db/client";
import {
  advanceImportJob,
  listActiveImportJobs,
  listOrganizations,
  readNextSheet,
  takeAwakenedImportOrganizations,
  updateImportJob,
  wakeImportJobs,
  type ImportJobPayload,
  type ImportJobView,
} from "@/modules/hub/service";
import { placeVendors } from "@/modules/vendors/service";

const POLL_INTERVAL_MS = 1000;
// Temps de travail d'un passage, pour que l'avancement se voie.
const STEP_BUDGET_MS = 2000;
// Fiches placées sur la carte par pas (un envoi en lot au géocodeur).
export const PLACEMENT_CHUNK = 50;

type ActiveJob = ImportJobView & { payload: ImportJobPayload };

async function advancePlacement(db: AppDatabase, organizationId: string, job: ActiveJob): Promise<boolean> {
  if (job.payload.kind !== "place_vendors") return false;
  const ids = job.payload.vendorIds.slice(job.done, job.done + PLACEMENT_CHUNK);
  const outcome = ids.length > 0 ? await placeVendors(organizationId, ids) : { placed: 0, unplaced: 0, skipped: 0 };
  const done = job.done + ids.length;
  const result = { placed: (job.result.placed ?? 0) + outcome.placed, unplaced: (job.result.unplaced ?? 0) + outcome.unplaced };
  const finished = done >= job.total;
  // Placement idempotent ; l'avancement et le décompte ne comptent qu'une fois.
  if (!(await advanceImportJob(db, organizationId, job, { status: finished ? "done" : "running", done, result, ...(finished ? { finishedAt: new Date() } : {}) }))) return false;
  job.done = done;
  job.result = result;
  return !finished;
}

// Lot 16 (L16-ARC-01, ADR 0043) : un passage ne visite que les organisations
// signalées (traitement créé ou relancé, ou encore inachevé au passage
// précédent). Un tour complet a lieu au démarrage du serveur, pour reprendre un
// traitement interrompu, puis toutes les 5 minutes, en filet de sécurité.
export const FULL_SCAN_INTERVAL_MS = 5 * 60 * 1000;
let lastFullScanAt: number | null = null;

async function organizationsToVisit(db: AppDatabase, now: number): Promise<string[]> {
  const awakenedIds = takeAwakenedImportOrganizations();
  if (lastFullScanAt !== null && now - lastFullScanAt < FULL_SCAN_INTERVAL_MS) return awakenedIds;
  lastFullScanAt = now;
  const all = (await listOrganizations(db)).map((organization) => organization.id);
  return [...new Set([...awakenedIds, ...all])];
}

// `organizationIds` : seulement ces organisations, sans rien signaler (tests).
export async function runImportJobsOnce(budgetMs: number = STEP_BUDGET_MS, organizationIds?: string[]): Promise<number> {
  const started = Date.now();
  const db = appDatabase();
  let steps = 0;
  const targets = organizationIds ?? (await organizationsToVisit(db, started));
  for (const [index, organizationId] of targets.entries()) {
    const jobs = await listActiveImportJobs(db, organizationId);
    for (const job of jobs) {
      try {
        let more = true;
        while (more && Date.now() - started < budgetMs) {
          more = job.kind === "read_sheets" ? await readNextSheet(db, organizationId, job) : await advancePlacement(db, organizationId, job);
          steps += 1;
        }
      } catch (error) {
        // Motif technique seulement : jamais de nom de fichier ni de donnée personnelle.
        console.error("traitement d'import échoué", { organizationId, jobId: job.id, error: error instanceof Error ? error.name : "inconnue" });
        await updateImportJob(db, organizationId, job.id, { status: "failed", error: "processing_failed", finishedAt: new Date() });
      }
      if (Date.now() - started >= budgetMs) {
        // Temps écoulé : cette organisation et celles pas encore visitées passent au prochain tour.
        if (!organizationIds) for (const pending of targets.slice(index)) wakeImportJobs(pending);
        return steps;
      }
    }
    // Un traitement encore actif (pas encore réclamé, par exemple) : on y revient au prochain passage.
    if (!organizationIds && jobs.length > 0 && (await listActiveImportJobs(db, organizationId)).length > 0) wakeImportJobs(organizationId);
  }
  return steps;
}

// Jusqu'au bout (tests, essais) : passages répétés tant qu'il reste du travail.
export async function runImportJobsUntilIdle(organizationIds?: string[], maxPasses = 200): Promise<void> {
  for (let pass = 0; pass < maxPasses; pass += 1) {
    if ((await runImportJobsOnce(60_000, organizationIds)) === 0) return;
  }
}

export function scheduleImportJobs(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runImportJobsOnce()
      .catch((error: unknown) => {
        console.error("traitements d'import : passage échoué", error instanceof Error ? error.message : error);
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, POLL_INTERVAL_MS).unref();
}
