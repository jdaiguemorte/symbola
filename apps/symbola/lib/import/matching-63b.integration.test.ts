// Lot 63b (HUB-14) — rapprochements vérifiables, contre un vrai PostgreSQL : la ligne du fichier et
// la fiche existante côte à côte (métier, ville, e-mail, téléphone, nombre d'évènements) ; deux fiches
// qui n'ont en commun que le prénom sont « À vérifier », deux prestataires par défaut ; « Décider plus
// tard » remet la proposition en attente.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { decideFreeColumns, getImportColumns, saveImportMapping, startImport } from "@/modules/hub/service";
import { createVendor, createVendorType } from "@/modules/vendors/service";
import { getImportWizard } from "./wizard";
import { decideMatches, getImportMatchesView } from "./matching";

const { sql, db } = createAppConnection();
process.env.GEOCODER = "fake";
afterAll(async () => {
  await sql.end();
});

async function vendorsImport(csv: string) {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `planner-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const photographer = await createVendorType(organization.id, "Photographe", "#2f6f5e");
  const benjamin = await createVendor(organization.id, { name: "Benjamin Dupuy", typeId: photographer.id, city: null, email: "contact@dupuy-photo.example.org", phone: "06 39 98 00 44" });
  const studio = await createVendor(organization.id, { name: "Studio Lumière", typeId: photographer.id, city: "Tours" });
  const started = await startImport(db, { organizationId: organization.id, userId: user.id, entityType: "vendors", fileName: "prestataires.csv", bytes: new TextEncoder().encode(csv) });
  if (started.status !== "started") throw new Error(JSON.stringify(started));
  const view = await getImportColumns(db, organization.id, started.importId);
  await saveImportMapping(db, { organizationId: organization.id, importId: started.importId, choices: view!.columns.map((column) => ({ columnIndex: column.columnIndex, target: column.proposedFieldKey ?? "none", confirmed: true })) });
  await decideFreeColumns(db, { organizationId: organization.id, importId: started.importId, decisions: [] });
  return { organizationId: organization.id, importId: started.importId, benjaminId: benjamin.vendor.id, studioId: studio.vendor.id };
}

const CSV = "Nom;Type de prestataire;Ville;E-mail\nBenjamin;DJ;Villeurbanne;bnj.mix@example.org\nStudio Lumière;Photographe;Tours;lea@studio-lumiere.example.org\n";

describe("HUB-14 — Rapprochements vérifiables (lot 63b)", () => {
  it("la ligne du fichier et la fiche existante côte à côte : nom, métier, ville, e-mail, téléphone, nombre d'évènements, différences dites", async () => {
    const { organizationId, importId, studioId } = await vendorsImport(CSV);
    const view = await getImportMatchesView(organizationId, importId);
    const studio = view!.rows.find((row) => row.values.name === "Studio Lumière")!;
    expect(studio.match).toMatchObject({ candidateId: studioId, status: "proposed" });
    expect(studio.compare).toMatchObject({ vendorId: studioId, eventCount: 0, toVerify: false });
    expect(studio.compare!.lines.map((line) => [line.key, line.file, line.existing, line.different])).toEqual([
      ["name", "Studio Lumière", "Studio Lumière", false],
      ["type", "Photographe", "Photographe", false],
      ["city", "Tours", "Tours", false],
      ["email", "lea@studio-lumiere.example.org", null, false],
      ["phone", null, null, false],
    ]);
  });

  it("étant donné deux fiches qui n'ont en commun que le prénom, la proposition porte « À vérifier » et le choix par défaut est « Ce sont deux prestataires »", async () => {
    const { organizationId, importId, benjaminId } = await vendorsImport(CSV);
    const view = await getImportMatchesView(organizationId, importId);
    const benjamin = view!.rows.find((row) => row.values.name === "Benjamin")!;
    expect(benjamin.match).toMatchObject({ candidateId: benjaminId, status: "refused", toVerify: true, reviewed: false });
    expect(benjamin.compare!.toVerify).toBe(true);
    expect(benjamin.compare!.lines.find((line) => line.key === "type")).toMatchObject({ file: "DJ", existing: "Photographe", different: true });
    // L'étape « Doublons » ne se franchit pas d'elle-même : la planner doit la voir.
    expect((await getImportWizard(organizationId, importId))!.steps.find((step) => step.key === "matches")).toMatchObject({ done: false });
  });

  it("« C'est le même », « Ce sont deux prestataires », « Décider plus tard » : chaque choix est gardé", async () => {
    const { organizationId, importId } = await vendorsImport(CSV);
    const rowIndex = (await getImportMatchesView(organizationId, importId))!.rows.find((row) => row.values.name === "Benjamin")!.rowIndex;
    const status = async () => (await getImportMatchesView(organizationId, importId))!.rows.find((row) => row.rowIndex === rowIndex)!.match;
    await decideMatches(organizationId, importId, [{ rowIndex, decision: "later" }]);
    expect(await status()).toMatchObject({ status: "proposed", reviewed: false });
    await decideMatches(organizationId, importId, [{ rowIndex, decision: "accept" }]);
    expect(await status()).toMatchObject({ status: "accepted", reviewed: true });
    await decideMatches(organizationId, importId, [{ rowIndex, decision: "refuse" }]);
    expect(await status()).toMatchObject({ status: "refused", reviewed: true, toVerify: true });
  });

  it("la fiche d'une autre organisation n'est jamais proposée (isolation)", async () => {
    const mine = await vendorsImport(CSV);
    const other = await vendorsImport(CSV);
    const view = await getImportMatchesView(mine.organizationId, mine.importId);
    const ids = view!.rows.flatMap((row) => [row.match?.candidateId, row.compare?.vendorId, ...row.options.map((option) => option.id)]);
    expect(ids).not.toContain(other.benjaminId);
    expect(ids).not.toContain(other.studioId);
  });
});
