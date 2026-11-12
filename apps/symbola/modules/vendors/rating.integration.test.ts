// Lot 28c (PRE-01, décision D8) — évaluation (1 à 5) et tarifs indicatifs des
// fiches du carnet : saisie, filtre « au moins N », import depuis un tableur,
// RGPD et isolation, contre un vrai PostgreSQL (RLS).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { getImportColumns, saveImportMapping, startImport } from "@/modules/hub/service";
import { confirmImport } from "@/lib/import/apply";
import { runImportJobsUntilIdle } from "@/lib/import-jobs";
import { vendorsPrivacy } from "./privacy";
import { createVendor, findVendors, getVendor, InvalidVendorRatingError, updateVendor } from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function planner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `planner-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  return { organizationId: organization.id, userId: user.id };
}

describe("PRE-01 — Annuaire privé : évaluation et tarifs indicatifs (lot 28c, D8)", () => {
  it("une fiche garde son évaluation et ses tarifs indicatifs ; les deux se modifient ou s'effacent", async () => {
    const { organizationId } = await planner();
    const { vendor } = await createVendor(organizationId, { name: "Maison Haddad", typeId: null, rating: 4, indicativePrices: "À partir de 85 € par couvert\nVin d'honneur : 12 €" });
    expect(vendor).toMatchObject({ rating: 4, indicativePrices: "À partir de 85 € par couvert\nVin d'honneur : 12 €" });
    const { vendor: updated } = await updateVendor(organizationId, vendor.id, { name: "Maison Haddad", typeId: null, rating: 5, indicativePrices: "  " });
    expect(updated).toMatchObject({ rating: 5, indicativePrices: null });
    const { vendor: cleared } = await updateVendor(organizationId, vendor.id, { name: "Maison Haddad", typeId: null, rating: null });
    expect(cleared.rating).toBeNull();
  });

  it("une évaluation hors de 1 à 5, ou non entière, est refusée", async () => {
    const { organizationId } = await planner();
    for (const rating of [0, 6, 2.5]) {
      await expect(createVendor(organizationId, { name: "X", typeId: null, rating })).rejects.toBeInstanceOf(InvalidVendorRatingError);
    }
  });

  it("l'évaluation s'affiche dans le carnet et se filtre : « au moins 4 » ne garde que les fiches notées 4 ou 5", async () => {
    const { organizationId } = await planner();
    for (const [name, rating] of [["Fleurs d'Élodie", 5], ["Studio Lumière", 4], ["DJ Nova", 3], ["Sans note", null]] as const) {
      await createVendor(organizationId, { name, typeId: null, rating });
    }
    const all = await findVendors({ organizationId });
    expect(all.find((vendor) => vendor.name === "Studio Lumière")!.rating).toBe(4);
    expect((await findVendors({ organizationId, minRating: 4 })).map((vendor) => vendor.name)).toEqual(["Fleurs d'Élodie", "Studio Lumière"]);
    expect((await findVendors({ organizationId, minRating: 5 })).map((vendor) => vendor.name)).toEqual(["Fleurs d'Élodie"]);
    // Un seuil hors de 1 à 5 est ignoré, jamais en erreur.
    expect(await findVendors({ organizationId, minRating: 9 })).toHaveLength(4);
  });

  it("les deux s'importent depuis un tableur (HUB-14) : « 4/5 », « ★★★ » ou « 5 » ; une note illisible laisse la fiche sans évaluation", async () => {
    const owner = await planner();
    const csv =
      "Nom;Évaluation;Tarifs indicatifs\n" +
      "Maison Haddad;4/5;À partir de 85 € par couvert\n" +
      "Fleurs d'Élodie;★★★;Bouquet de mariée 180 €\n" +
      "DJ Nova;5;\n" +
      "Studio Lumière;excellent;Forfait journée 1 900 €\n";
    const started = await startImport(db, { ...owner, entityType: "vendors", fileName: "carnet.csv", bytes: new TextEncoder().encode(csv) });
    if (started.status !== "started") throw new Error(`import refusé : ${JSON.stringify(started)}`);
    const view = await getImportColumns(db, owner.organizationId, started.importId);
    expect(view!.columns.map((column) => column.proposedFieldKey)).toEqual(["name", "rating", "indicativePrices"]);
    await saveImportMapping(db, {
      organizationId: owner.organizationId,
      importId: started.importId,
      choices: view!.columns.map((column) => ({ columnIndex: column.columnIndex, target: column.proposedFieldKey ?? "none", confirmed: true })),
    });
    expect(await confirmImport({ ...owner, importId: started.importId })).toMatchObject({ status: "applied", result: { created: 4 } });
    await runImportJobsUntilIdle([owner.organizationId]);

    const byName = new Map((await findVendors({ organizationId: owner.organizationId })).map((vendor) => [vendor.name, vendor.id]));
    const card = async (name: string) => (await getVendor(owner.organizationId, byName.get(name)!))!;
    expect(await card("Maison Haddad")).toMatchObject({ rating: 4, indicativePrices: "À partir de 85 € par couvert" });
    expect(await card("Fleurs d'Élodie")).toMatchObject({ rating: 3, indicativePrices: "Bouquet de mariée 180 €" });
    expect(await card("DJ Nova")).toMatchObject({ rating: 5, indicativePrices: null });
    expect(await card("Studio Lumière")).toMatchObject({ rating: null, indicativePrices: "Forfait journée 1 900 €" });
  });

  it("RGPD : les tarifs se retrouvent dans la recherche, l'évaluation et les tarifs dans l'export ; l'oubli les efface", async () => {
    const { organizationId } = await planner();
    const { vendor } = await createVendor(organizationId, { name: "Jeanne Martin Photographie", typeId: null, rating: 2, indicativePrices: "Reportage Jeanne 1 400 €" });
    const records = await vendorsPrivacy.find({ organizationId, terms: { name: "Reportage Jeanne" } });
    expect(records.map((record) => record.recordId)).toEqual([vendor.id]);
    expect(records[0]!.fields).toMatchObject({ rating: "2/5", indicativePrices: "Reportage Jeanne 1 400 €" });
    await vendorsPrivacy.erase({ organizationId, records: [{ kind: "vendor", recordId: vendor.id }], rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 }, today: "2026-11-12" });
    expect(await getVendor(organizationId, vendor.id)).toMatchObject({ name: "[anonymisé]", rating: null, indicativePrices: null });
  });

  it("isolation : une autre organisation ne lit ni ne filtre les fiches notées d'une autre, et ne les modifie pas", async () => {
    const a = await planner();
    const b = await planner();
    const { vendor } = await createVendor(a.organizationId, { name: "Maison Haddad", typeId: null, rating: 5, indicativePrices: "85 € par couvert" });
    expect(await findVendors({ organizationId: b.organizationId, minRating: 1 })).toEqual([]);
    expect(await getVendor(b.organizationId, vendor.id)).toBeNull();
    await expect(updateVendor(b.organizationId, vendor.id, { name: "Pris", typeId: null, rating: 1 })).rejects.toThrow();
    expect(await getVendor(a.organizationId, vendor.id)).toMatchObject({ name: "Maison Haddad", rating: 5 });
  });
});
