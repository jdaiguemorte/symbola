// Lot 71a (SEC-21, RGP-05 ; spécification du lot 71, § 3 et § 6, critère 9 du paquet 71a) — test
// d'abus : une fiche PDF déposée puis laissée en plan ne reste pas dans le stockage. La purge horaire
// des brouillons expirés efface ses objets chiffrés, même quand la lecture n'a jamais eu lieu ou s'est
// arrêtée en échec.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { createStorageClient, PrivateObjectNotFoundError, readPrivateObject } from "@symbola/files";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { cancelImport, listActiveImportJobs, listImportJobs, startEventSheetsImport, updateImportJob } from "@/modules/hub/service";
import { purgeAllExpiredImportDrafts } from "./import-purge";

const { sql, db } = createAppConnection();
const DAY_MS = 24 * 60 * 60 * 1000;

afterAll(async () => {
  await sql.end();
});

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `p-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  return { organizationId: organization.id, userId: user.id };
}

const sheet = (name: string) => ({ fileName: name, bytes: readImportCorpusFile(`logiciel-tiers/${name}`) });

async function storedKeys(organizationId: string, importId: string): Promise<string[]> {
  const jobs = await listActiveImportJobs(db, organizationId);
  const job = jobs.find((candidate) => candidate.importId === importId);
  if (!job || job.payload.kind !== "read_sheets") return [];
  return job.payload.files.map((file) => file.objectKey).filter((key): key is string => Boolean(key));
}

async function expectGone(key: string) {
  await expect(readPrivateObject(createStorageClient(), key)).rejects.toBeInstanceOf(PrivateObjectNotFoundError);
}

describe("SEC-21 — Une fiche PDF laissée en plan ne reste pas dans le stockage (lot 71a)", () => {
  it("un brouillon de fiche PDF expiré, jamais lu, n'a plus d'objet dans le stockage après la purge", async () => {
    const planner = await createPlanner();
    const now = new Date();
    const started = await startEventSheetsImport(db, { ...planner, files: [sheet("fiche-evenement-complete.pdf"), sheet("fiche-evenement-minimale.pdf")], now });
    if (started.status !== "started") throw new Error("import refusé");
    const keys = await storedKeys(planner.organizationId, started.importId);
    expect(keys).toHaveLength(2);
    // La fiche est bien gardée tant que le brouillon vit.
    await expect(readPrivateObject(createStorageClient(), keys[0]!)).resolves.toBeDefined();

    await purgeAllExpiredImportDrafts(new Date(now.getTime() + 8 * DAY_MS));

    for (const key of keys) await expectGone(key);
    const [job] = await listImportJobs(db, planner.organizationId, started.importId);
    expect(job?.status).toBe("cancelled");
  });

  it("une lecture arrêtée en échec ne garde pas non plus ses fiches : ni à l'abandon, ni à l'expiration", async () => {
    for (const end of ["cancel", "expire"] as const) {
      const planner = await createPlanner();
      const now = new Date();
      const started = await startEventSheetsImport(db, { ...planner, files: [sheet("fiche-evenement-complete.pdf")], now });
      if (started.status !== "started") throw new Error("import refusé");
      const keys = await storedKeys(planner.organizationId, started.importId);
      const [job] = await listImportJobs(db, planner.organizationId, started.importId);
      // Antivirus injoignable, par exemple : le traitement passe en échec, la fiche reste à relire.
      await updateImportJob(db, planner.organizationId, job!.id, { status: "failed", error: "processing_failed", finishedAt: now });

      if (end === "cancel") await cancelImport(db, planner.organizationId, started.importId, now);
      else await purgeAllExpiredImportDrafts(new Date(now.getTime() + 8 * DAY_MS));

      for (const key of keys) await expectGone(key);
    }
  });
});
