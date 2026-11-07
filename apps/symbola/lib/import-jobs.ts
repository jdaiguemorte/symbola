// Lot 15 (IMP-10, GEO-01, ADR 0035) — fait avancer les traitements de fond
// des imports, organisation par organisation : lecture des fiches PDF (hub)
// et placement sur la carte des prestataires importés (module vendors, par
// son service.ts). Chaque pas est enregistré : un traitement interrompu
// (redémarrage du serveur) reprend là où il s'était arrêté. Lancé au démarrage
// du serveur (instrumentation.ts), toutes les secondes, jamais deux passages à
// la fois dans le même processus.
import { createAppConnection } from "@symbola/db/client";
import { advanceImportJob, listActiveImportJobs, listOrganizations, readNextSheet, updateImportJob, type ImportJobPayload, type ImportJobView } from "@/modules/hub/service";
import { placeVendors } from "@/modules/vendors/service";

const POLL_INTERVAL_MS = 1000;
// Temps de travail d'un passage, pour que l'avancement se voie.
const STEP_BUDGET_MS = 2000;
// Fiches placées sur la carte par pas (un envoi en lot au géocodeur).
export const PLACEMENT_CHUNK = 50;

type ActiveJob = ImportJobView & { payload: ImportJobPayload };

async function advancePlacement(db: ReturnType<typeof createAppConnection>["db"], organizationId: string, job: ActiveJob): Promise<boolean> {
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

// `organizationIds` : seulement ces organisations (tests).
export async function runImportJobsOnce(budgetMs: number = STEP_BUDGET_MS, organizationIds?: string[]): Promise<number> {
  const started = Date.now();
  const { sql, db } = createAppConnection();
  let steps = 0;
  try {
    const organizations = (await listOrganizations(db)).filter((organization) => !organizationIds || organizationIds.includes(organization.id));
    for (const organization of organizations) {
      for (const job of await listActiveImportJobs(db, organization.id)) {
        try {
          let more = true;
          while (more && Date.now() - started < budgetMs) {
            more = job.kind === "read_sheets" ? await readNextSheet(db, organization.id, job) : await advancePlacement(db, organization.id, job);
            steps += 1;
          }
        } catch (error) {
          // Motif technique seulement : jamais de nom de fichier ni de donnée personnelle.
          console.error("traitement d'import échoué", { organizationId: organization.id, jobId: job.id, error: error instanceof Error ? error.name : "inconnue" });
          await updateImportJob(db, organization.id, job.id, { status: "failed", error: "processing_failed", finishedAt: new Date() });
        }
        if (Date.now() - started >= budgetMs) return steps;
      }
    }
    return steps;
  } finally {
    await sql.end();
  }
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
