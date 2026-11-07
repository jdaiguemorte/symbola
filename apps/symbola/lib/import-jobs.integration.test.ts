// Lot 15 (GEO-01, IMP-10) — traitements de fond des imports contre de vrais
// services (PostgreSQL, stockage, antivirus) : placement sur la carte en lot
// (adresses dédoublonnées, points connus réutilisés, point manuel gardé),
// lecture des fiches PDF gardées chiffrées puis supprimées, reprise après
// interruption, annulation, isolation entre organisations.
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { createStorageClient, PrivateObjectNotFoundError, readPrivateObject } from "@symbola/files";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { cancelImport, createImportJob, getImportDraft, listActiveImportJobs, listImportJobs, startEventSheetsImport, startImport } from "@/modules/hub/service";
import { createVendor, getVendor, setVendorLocation } from "@/modules/vendors/service";
import { fakeGeocoderCalls } from "@/modules/vendors/geocoder";
import { runImportJobsOnce, runImportJobsUntilIdle } from "./import-jobs";

const { sql, db } = createAppConnection();
process.env.GEOCODER = "fake";

afterAll(async () => {
  await sql.end();
});

beforeEach(() => {
  fakeGeocoderCalls.batches = 0;
  fakeGeocoderCalls.single = 0;
});

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `p-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  return { organizationId: organization.id, userId: user.id };
}

// Un import confirmé quelconque, support du traitement de placement.
async function someImport(planner: Awaited<ReturnType<typeof createPlanner>>) {
  const started = await startImport(db, { ...planner, entityType: "vendors", fileName: "a.csv", bytes: new TextEncoder().encode("Nom;Ville\nA;Lille\n") });
  if (started.status !== "started") throw new Error("import refusé");
  return started.importId;
}

const sheet = (name: string) => ({ fileName: name, bytes: readImportCorpusFile(`logiciel-tiers/${name}`) });

describe("GEO-01 — Placement sur la carte en lot, sans attendre", () => {
  it("adresses en double placées d'un seul envoi, point déjà connu repris sans appel, point placé à la main gardé, adresse introuvable « à placer »", async () => {
    const planner = await createPlanner();
    const { organizationId } = planner;
    const known = await createVendor(organizationId, { name: "Déjà placé", typeId: null, addressLine: "1 rue Connue", postalCode: "59000", city: "Lille" });
    const vendor = async (name: string, addressLine: string | null, city: string | null = "Lyon") =>
      (await createVendor(organizationId, { name, typeId: null, addressLine, postalCode: city === "Lyon" ? "69001" : "59000", city })).vendor.id;
    const twinA = await vendor("Jumeau A", "3 quai Exemple");
    const twinB = await vendor("Jumeau B", "3 QUAI  exemple");
    const sameAsKnown = await vendor("Même adresse", "1 rue connue", "Lille");
    const lost = await vendor("Perdu", "adresse introuvable");
    const manual = await vendor("Manuel", "9 rue Ailleurs");
    await setVendorLocation(organizationId, manual, 45.1, 4.1);
    fakeGeocoderCalls.batches = 0;
    fakeGeocoderCalls.single = 0;

    const importId = await someImport(planner);
    const ids = [twinA, twinB, sameAsKnown, lost, manual];
    await createImportJob(db, { organizationId, importId, payload: { kind: "place_vendors", vendorIds: ids }, total: ids.length });
    await runImportJobsUntilIdle([organizationId]);

    expect(fakeGeocoderCalls).toEqual({ batches: 1, single: 0 });
    const [a, b, same, unplaced, kept] = await Promise.all(ids.map((id) => getVendor(organizationId, id)));
    expect(a!.location).toMatchObject({ source: "geocoded" });
    expect(b!.location).toEqual(a!.location);
    expect(same!.location).toEqual(known.vendor.location);
    expect(unplaced!.location).toBeNull();
    expect(kept!.location).toEqual({ latitude: 45.1, longitude: 4.1, source: "manual" });
    const [job] = await listImportJobs(db, organizationId, importId);
    expect(job).toMatchObject({ kind: "place_vendors", status: "done", total: 5, done: 5, result: { placed: 3, unplaced: 1 } });
  });

  it("jamais le point d'une autre organisation", async () => {
    const a = await createPlanner();
    const b = await createPlanner();
    await createVendor(b.organizationId, { name: "Chez B", typeId: null, addressLine: "5 rue Partagée", postalCode: "69001", city: "Lyon" });
    const { vendor } = await createVendor(a.organizationId, { name: "Chez A", typeId: null, addressLine: "5 rue Partagée", postalCode: "69001", city: "Lyon" });
    await setVendorLocation(b.organizationId, (await createVendor(b.organizationId, { name: "B2", typeId: null, addressLine: "5 rue Partagée", postalCode: "69001", city: "Lyon" })).vendor.id, 1, 1);
    fakeGeocoderCalls.batches = 0;
    const importId = await someImport(a);
    await createImportJob(db, { organizationId: a.organizationId, importId, payload: { kind: "place_vendors", vendorIds: [vendor.id] }, total: 1 });
    await runImportJobsUntilIdle([a.organizationId]);
    expect(fakeGeocoderCalls.batches).toBe(1);
    expect((await getVendor(a.organizationId, vendor.id))!.location).not.toMatchObject({ latitude: 1, longitude: 1 });
  });
});

describe("IMP-10 — Voir l'avancement des traitements longs", () => {
  it("les fiches déposées sont gardées chiffrées, lues une à une avec l'avancement, puis supprimées", async () => {
    const planner = await createPlanner();
    const started = await startEventSheetsImport(db, {
      ...planner,
      files: [sheet("fiche-evenement-complete.pdf"), sheet("fiche-evenement-minimale.pdf"), { fileName: "notes.pdf", bytes: new TextEncoder().encode("pas un pdf") }],
    });
    if (started.status !== "started") throw new Error("import refusé");
    const [job] = await listActiveImportJobs(db, planner.organizationId);
    expect(job).toMatchObject({ kind: "read_sheets", status: "pending", total: 3, done: 0 });
    // Une fiche refusée au dépôt n'est jamais gardée ; les autres le sont, chiffrées.
    const files = job!.payload.kind === "read_sheets" ? job!.payload.files : [];
    expect(files.map((file) => Boolean(file.objectKey))).toEqual([true, true, false]);
    const stored = await readPrivateObject(createStorageClient(), files[0]!.objectKey!);
    expect(Buffer.from(stored.data).includes(Buffer.from("%PDF"))).toBe(false);
    // Pas de rapprochements tant que la lecture n'est pas finie.
    expect((await getImportDraft(db, planner.organizationId, started.importId))!.jobs[0]).toMatchObject({ status: "pending" });

    await runImportJobsUntilIdle([planner.organizationId]);
    const draft = (await getImportDraft(db, planner.organizationId, started.importId))!;
    expect(draft.jobs[0]).toMatchObject({ status: "done", done: 3 });
    expect(draft.rowCount).toBe(3);
    await expect(readPrivateObject(createStorageClient(), files[0]!.objectKey!)).rejects.toBeInstanceOf(PrivateObjectNotFoundError);
  });

  it("un traitement interrompu reprend là où il s'était arrêté, sans relire une fiche déjà lue", async () => {
    const planner = await createPlanner();
    const started = await startEventSheetsImport(db, { ...planner, files: [sheet("fiche-evenement-complete.pdf"), sheet("fiche-evenement-minimale.pdf")] });
    if (started.status !== "started") throw new Error("import refusé");
    // Un passage très court : au plus une fiche lue, comme avant un redémarrage.
    await runImportJobsOnce(1, [planner.organizationId]);
    const partial = (await getImportDraft(db, planner.organizationId, started.importId))!;
    expect(partial.jobs[0]!.done).toBeLessThan(2);
    await runImportJobsUntilIdle([planner.organizationId]);
    const draft = (await getImportDraft(db, planner.organizationId, started.importId))!;
    expect(draft.rowCount).toBe(2);
    expect(draft.previewRows.map((row) => row[0])).toEqual(["fiche-evenement-complete.pdf", "fiche-evenement-minimale.pdf"]);
  });

  it("abandonner l'import arrête la lecture et supprime les fiches encore gardées ; une autre organisation ne voit pas l'avancement", async () => {
    const planner = await createPlanner();
    const other = await createPlanner();
    const started = await startEventSheetsImport(db, { ...planner, files: [sheet("fiche-evenement-complete.pdf")] });
    if (started.status !== "started") throw new Error("import refusé");
    const [job] = await listActiveImportJobs(db, planner.organizationId);
    const key = job!.payload.kind === "read_sheets" ? job!.payload.files[0]!.objectKey! : "";
    expect(await listImportJobs(db, other.organizationId, started.importId)).toEqual([]);

    expect(await cancelImport(db, planner.organizationId, started.importId)).toBe(true);
    expect((await listImportJobs(db, planner.organizationId, started.importId))[0]).toMatchObject({ status: "cancelled" });
    await expect(readPrivateObject(createStorageClient(), key)).rejects.toBeInstanceOf(PrivateObjectNotFoundError);
  });
});
