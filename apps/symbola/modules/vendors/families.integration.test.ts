// Lot 16 (PRE-14, PRE-15, ADR 0040) — familles de types de prestataires,
// renommage, fusion et rangement des types, contre un vrai PostgreSQL (RLS),
// par la porte d'entrée du module. Données de départ du métier wedding planner.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { domainEvents } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";
import { starterVendorCatalog } from "@symbola/starter-templates";
import {
  addVendorTypeField,
  countVendorsByType,
  createVendor,
  createVendorFamily,
  createVendorType,
  findVendors,
  getVendor,
  importVendorRows,
  listVendorFamilies,
  listVendorTypes,
  mergeVendorTypes,
  moveVendorFamily,
  removeVendorFamily,
  removeVendorType,
  renameVendorType,
  seedStarterVendorCatalog,
  setVendorTypeFamily,
  undoImportedVendorsElements,
  updateVendorFamily,
  VendorFamilyNotEmptyError,
  VendorFamilyNotFoundError,
  VendorTypeInUseError,
  VendorTypeNotFoundError,
} from "./service";

const catalog = (locale: "fr" | "en" = "fr") =>
  starterVendorCatalog(locale).map((family) => ({
    ...family,
    types: family.types.map((type) => ({ key: type.key, label: type.label, synonyms: type.synonyms, fields: type.fields })),
  }));

async function newOrganization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Org ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

async function familyNamed(organizationId: string, label: string) {
  const family = (await listVendorFamilies(organizationId)).find((candidate) => candidate.label === label);
  if (!family) throw new Error(`famille introuvable : ${label}`);
  return family;
}

async function typeNamed(organizationId: string, label: string) {
  const type = (await listVendorTypes(organizationId)).find((candidate) => candidate.label === label);
  if (!type) throw new Error(`type introuvable : ${label}`);
  return type;
}

describe("PRE-14 — Familles et types", () => {
  it("une nouvelle organisation démarre avec une dizaine de familles et environ 25 types rangés dedans", async () => {
    const organizationId = await newOrganization();
    const result = await seedStarterVendorCatalog(organizationId, catalog(), { withTypes: true });
    const families = await listVendorFamilies(organizationId);
    const types = await listVendorTypes(organizationId);
    expect(result.families).toBe(families.length);
    expect(families.length).toBeGreaterThanOrEqual(8);
    expect(types.length).toBeGreaterThanOrEqual(22);
    expect(types.every((type) => type.familyId !== null)).toBe(true);
    const beauty = await familyNamed(organizationId, "Beauté et tenues");
    expect(types.filter((type) => type.familyId === beauty.id).map((type) => type.label)).toContain("Coiffure et maquillage");
    // Les champs de départ suivent leur type.
    expect((await typeNamed(organizationId, "Lieu de réception")).fields.length).toBeGreaterThan(3);
  });

  it("étant donné une organisation existante, ses types sont rangés par les synonymes, le reste à classer, sans qu'aucune fiche change de type", async () => {
    const organizationId = await newOrganization();
    const hair = await createVendorType(organizationId, "Coiffeur(se)", "#123456");
    const makeup = await createVendorType(organizationId, "Maquillage", "#123456");
    const model = await createVendorType(organizationId, "Mannequin", "#123456");
    const { vendor } = await createVendor(organizationId, { name: "Studio Brune", typeId: hair.id });

    const result = await seedStarterVendorCatalog(organizationId, catalog(), { withTypes: false });

    const beauty = await familyNamed(organizationId, "Beauté et tenues");
    const types = await listVendorTypes(organizationId);
    expect(types).toHaveLength(3);
    expect(types.find((type) => type.id === hair.id)!.familyId).toBe(beauty.id);
    expect(types.find((type) => type.id === makeup.id)!.familyId).toBe(beauty.id);
    expect(types.find((type) => type.id === model.id)!.familyId).toBeNull();
    expect(result.classified).toBe(2);
    expect((await getVendor(organizationId, vendor.id))!.typeId).toBe(hair.id);
  });

  it("les familles de départ ne sont posées qu'une fois : une famille supprimée n'est jamais rétablie d'office", async () => {
    const organizationId = await newOrganization();
    await seedStarterVendorCatalog(organizationId, catalog(), { withTypes: false });
    const count = (await listVendorFamilies(organizationId)).length;
    const stationery = await familyNamed(organizationId, "Papeterie et impression");
    await removeVendorFamily(organizationId, stationery.id);

    expect(await seedStarterVendorCatalog(organizationId, catalog(), { withTypes: true })).toEqual({ families: 0, types: 0, classified: 0 });
    expect(await listVendorFamilies(organizationId)).toHaveLength(count - 1);
    expect(await listVendorTypes(organizationId)).toHaveLength(0);

    // Sur sa demande (« Ajouter les types de départ »), elles reviennent avec leurs types.
    const again = await seedStarterVendorCatalog(organizationId, catalog(), { withTypes: true, explicit: true });
    expect(again.families).toBe(1);
    expect(again.types).toBeGreaterThanOrEqual(22);
  });

  it("quand elle choisit une famille, seules les fiches de ses types s'affichent ; « à classer » réunit les types sans famille et les fiches sans type", async () => {
    const organizationId = await newOrganization();
    await seedStarterVendorCatalog(organizationId, catalog(), { withTypes: true });
    const beauty = await familyNamed(organizationId, "Beauté et tenues");
    const hair = await typeNamed(organizationId, "Coiffure et maquillage");
    const dress = await typeNamed(organizationId, "Robe de mariée");
    const venue = await typeNamed(organizationId, "Lieu de réception");
    const loose = await createVendorType(organizationId, "Mannequin", "#123456");
    const a = (await createVendor(organizationId, { name: "Studio Brune", typeId: hair.id })).vendor;
    const b = (await createVendor(organizationId, { name: "Atelier Ivoire", typeId: dress.id })).vendor;
    await createVendor(organizationId, { name: "Domaine des Tilleuls", typeId: venue.id });
    const c = (await createVendor(organizationId, { name: "Agence Silhouette", typeId: loose.id })).vendor;
    const d = (await createVendor(organizationId, { name: "Sans type", typeId: null })).vendor;

    expect((await findVendors({ organizationId, familyId: beauty.id })).map((vendor) => vendor.id).sort()).toEqual([a.id, b.id].sort());
    expect((await findVendors({ organizationId, unclassified: true })).map((vendor) => vendor.id).sort()).toEqual([c.id, d.id].sort());
    // Un type précis dans la famille choisie (second rang).
    expect((await findVendors({ organizationId, familyId: beauty.id, typeIds: [dress.id] })).map((vendor) => vendor.id)).toEqual([b.id]);
    const counts = new Map((await countVendorsByType(organizationId)).map((entry) => [entry.typeId, entry.count]));
    expect(counts.get(hair.id)).toBe(1);
    expect(counts.get(null)).toBe(1);
  });
});

describe("PRE-15 — Renommer, fusionner, ranger les types", () => {
  it("quand elle renomme un type, toutes les fiches suivent", async () => {
    const organizationId = await newOrganization();
    const type = await createVendorType(organizationId, "Coiffeur", "#123456");
    const { vendor } = await createVendor(organizationId, { name: "Studio Brune", typeId: type.id });
    await renameVendorType(organizationId, type.id, "Coiffure", "#123456");
    expect((await getVendor(organizationId, vendor.id))!.typeId).toBe(type.id);
    expect((await listVendorTypes(organizationId)).find((candidate) => candidate.id === type.id)!.label).toBe("Coiffure");
  });

  it("quand elle fusionne « Coiffeur(se) » dans « Coiffure et maquillage », les fiches passent au type gardé, les champs propres sont repris et le type fusionné disparaît, opération journalisée", async () => {
    const organizationId = await newOrganization();
    const kept = await createVendorType(organizationId, "Coiffure et maquillage", "#123456");
    const merged = await createVendorType(organizationId, "Coiffeur(se)", "#123456");
    const keptPrice = await addVendorTypeField(organizationId, kept.id, { label: "Tarif d'essai", kind: "amount" });
    const mergedPrice = await addVendorTypeField(organizationId, merged.id, { label: "tarif d'essai", kind: "amount" });
    const mergedArea = await addVendorTypeField(organizationId, merged.id, { label: "Zone d'intervention (km)", kind: "number" });
    const { vendor } = await createVendor(organizationId, {
      name: "Studio Brune",
      typeId: merged.id,
      fieldValues: { [mergedPrice.id]: 8000, [mergedArea.id]: 40 },
    });
    const other = (await createVendor(organizationId, { name: "Salon Rivière", typeId: kept.id, fieldValues: { [keptPrice.id]: 5000 } })).vendor;

    expect(await mergeVendorTypes(organizationId, { sourceTypeId: merged.id, targetTypeId: kept.id })).toEqual({ movedVendors: 1, movedFields: 1 });

    const types = await listVendorTypes(organizationId);
    expect(types.map((type) => type.id)).toEqual([kept.id]);
    expect(types[0]!.fields.map((field) => field.label)).toEqual(["Tarif d'essai", "Zone d'intervention (km)"]);
    const moved = (await getVendor(organizationId, vendor.id))!;
    expect(moved.typeId).toBe(kept.id);
    expect(moved.fieldValues).toEqual({ [keptPrice.id]: 8000, [mergedArea.id]: 40 });
    expect((await getVendor(organizationId, other.id))!.fieldValues).toEqual({ [keptPrice.id]: 5000 });

    const { sql, db } = createAppConnection();
    try {
      // domain_events n'est pas sous RLS (outbox lue par le worker, SOC-06) : filtre explicite.
      const events = await withOrganization(db, organizationId, (tx) =>
        tx
          .select()
          .from(domainEvents)
          .where(and(eq(domainEvents.organizationId, organizationId), eq(domainEvents.name, "vendors.vendor_type.merged"))),
      );
      expect(events).toHaveLength(1);
      expect(events[0]!.payload).toEqual({ sourceTypeId: merged.id, targetTypeId: kept.id, movedVendorCount: 1, movedFieldCount: 1 });
    } finally {
      await sql.end();
    }
  });

  it("un import qui avait créé le type fusionné reste annulable", async () => {
    const organizationId = await newOrganization();
    const kept = await createVendorType(organizationId, "Coiffure et maquillage", "#123456");
    const imported = await importVendorRows({
      organizationId,
      rows: [{ rowIndex: 0, values: { name: "Studio Brune", type: "Coiffeur(se)", city: "Lille" }, importedFields: {}, matchId: null, eventId: null }],
      typeChoices: [{ label: "Coiffeur(se)", typeId: null }],
    });
    const createdType = imported.items.find((item) => item.kind === "vendor_type")!;
    await mergeVendorTypes(organizationId, { sourceTypeId: createdType.elementId, targetTypeId: kept.id });

    const outcomes = await undoImportedVendorsElements(
      organizationId,
      imported.items.map((item) => ({ kind: item.kind, elementId: item.elementId, action: item.action, previous: item.previous, written: item.written, force: false })),
    );
    const byKind = new Map(imported.items.map((item, index) => [item.kind, outcomes[index]]));
    expect(byKind.get("vendor")).toBe("undone");
    expect(byKind.get("vendor_type")).toBe("missing");
    expect(await findVendors({ organizationId })).toHaveLength(0);
    expect((await listVendorTypes(organizationId)).map((type) => type.id)).toEqual([kept.id]);
  });

  it("quand elle supprime un type qui a des fiches, il faut dire vers quel type les déplacer : plus de fiche qui perd son type en silence", async () => {
    const organizationId = await newOrganization();
    const old = await createVendorType(organizationId, "Lieux", "#123456");
    const target = await createVendorType(organizationId, "Lieu de réception", "#123456");
    const { vendor } = await createVendor(organizationId, { name: "Domaine des Tilleuls", typeId: old.id });

    await expect(removeVendorType(organizationId, old.id)).rejects.toBeInstanceOf(VendorTypeInUseError);
    expect((await getVendor(organizationId, vendor.id))!.typeId).toBe(old.id);

    await removeVendorType(organizationId, old.id, { moveVendorsTo: target.id });
    expect((await getVendor(organizationId, vendor.id))!.typeId).toBe(target.id);
    expect((await listVendorTypes(organizationId)).map((type) => type.id)).toEqual([target.id]);

    // Choix explicite : les fiches passent « à classer ».
    await removeVendorType(organizationId, target.id, { moveVendorsTo: null });
    expect((await getVendor(organizationId, vendor.id))!.typeId).toBeNull();
    // Un type vide se supprime sans question.
    const empty = await createVendorType(organizationId, "Vide", "#123456");
    await removeVendorType(organizationId, empty.id);
    expect(await listVendorTypes(organizationId)).toHaveLength(0);
  });

  it("quand elle change la famille d'un type, le carnet suit", async () => {
    const organizationId = await newOrganization();
    await seedStarterVendorCatalog(organizationId, catalog(), { withTypes: true });
    const decor = await familyNamed(organizationId, "Fleurs et décoration");
    const jewelry = await typeNamed(organizationId, "Bijoux");
    const { vendor } = await createVendor(organizationId, { name: "Maison Opale", typeId: jewelry.id });
    await setVendorTypeFamily(organizationId, jewelry.id, decor.id);
    expect((await findVendors({ organizationId, familyId: decor.id })).map((found) => found.id)).toEqual([vendor.id]);
    await setVendorTypeFamily(organizationId, jewelry.id, null);
    expect((await findVendors({ organizationId, unclassified: true })).map((found) => found.id)).toEqual([vendor.id]);
  });

  it("les familles appartiennent à l'organisation : « Tenues » créée, « Beauté et tenues » renommée « Beauté », chacune avec sa couleur", async () => {
    const organizationId = await newOrganization();
    await seedStarterVendorCatalog(organizationId, catalog(), { withTypes: true });
    const beauty = await familyNamed(organizationId, "Beauté et tenues");
    const attire = await createVendorFamily(organizationId, { label: "Tenues", color: "#7A2E5C", icon: "attire" });
    for (const label of ["Robe de mariée", "Tenue du marié", "Bijoux"]) await setVendorTypeFamily(organizationId, (await typeNamed(organizationId, label)).id, attire.id);
    await updateVendorFamily(organizationId, beauty.id, { label: "Beauté", color: beauty.color, icon: beauty.icon });

    const families = await listVendorFamilies(organizationId);
    expect(families.find((family) => family.id === beauty.id)!.label).toBe("Beauté");
    expect(families.find((family) => family.id === attire.id)).toMatchObject({ label: "Tenues", color: "#7a2e5c", icon: "attire" });
    const types = await listVendorTypes(organizationId);
    expect(types.filter((type) => type.familyId === beauty.id).map((type) => type.label).sort()).toEqual(["Bien-être", "Coiffure et maquillage"]);
    expect(types.filter((type) => type.familyId === attire.id)).toHaveLength(3);
  });

  it("elle change l'ordre des familles et ne supprime qu'une famille vide", async () => {
    const organizationId = await newOrganization();
    await seedStarterVendorCatalog(organizationId, catalog(), { withTypes: true });
    const [first, second] = await listVendorFamilies(organizationId);
    await moveVendorFamily(organizationId, second!.id, "up");
    expect((await listVendorFamilies(organizationId)).slice(0, 2).map((family) => family.id)).toEqual([second!.id, first!.id]);

    await expect(removeVendorFamily(organizationId, first!.id)).rejects.toBeInstanceOf(VendorFamilyNotEmptyError);
    const empty = await createVendorFamily(organizationId, { label: "Divers", color: "#5e5a52", icon: "other" });
    await removeVendorFamily(organizationId, empty.id);
    expect((await listVendorFamilies(organizationId)).some((family) => family.id === empty.id)).toBe(false);
  });

  it("refuse une couleur ou une icône inconnue", async () => {
    const organizationId = await newOrganization();
    await expect(createVendorFamily(organizationId, { label: "Divers", color: "rouge", icon: "other" })).rejects.toBeInstanceOf(RangeError);
    await expect(createVendorFamily(organizationId, { label: "Divers", color: "#5e5a52", icon: "licorne" })).rejects.toBeInstanceOf(RangeError);
    await expect(createVendorFamily(organizationId, { label: " ", color: "#5e5a52", icon: "other" })).rejects.toBeInstanceOf(RangeError);
  });
});

describe("PRE-14 / PRE-15 — Isolation entre organisations", () => {
  it("l'organisation B ne voit, ne modifie ni ne supprime les familles et les types de A", async () => {
    const a = await newOrganization();
    const b = await newOrganization();
    await seedStarterVendorCatalog(a, catalog(), { withTypes: true });
    const familyOfA = (await listVendorFamilies(a))[0]!;
    const typeOfA = (await listVendorTypes(a))[0]!;
    const typeOfB = await createVendorType(b, "Fleuriste", "#123456");

    expect(await listVendorFamilies(b)).toHaveLength(0);
    await expect(updateVendorFamily(b, familyOfA.id, { label: "Piratée", color: "#000000", icon: "other" })).rejects.toBeInstanceOf(VendorFamilyNotFoundError);
    await expect(removeVendorFamily(b, familyOfA.id)).rejects.toBeInstanceOf(VendorFamilyNotFoundError);
    await expect(moveVendorFamily(b, familyOfA.id, "down")).rejects.toBeInstanceOf(VendorFamilyNotFoundError);
    await expect(setVendorTypeFamily(b, typeOfB.id, familyOfA.id)).rejects.toBeInstanceOf(VendorFamilyNotFoundError);
    await expect(setVendorTypeFamily(b, typeOfA.id, null)).rejects.toBeInstanceOf(VendorTypeNotFoundError);
    await expect(mergeVendorTypes(b, { sourceTypeId: typeOfA.id, targetTypeId: typeOfB.id })).rejects.toBeInstanceOf(VendorTypeNotFoundError);
    await expect(mergeVendorTypes(b, { sourceTypeId: typeOfB.id, targetTypeId: typeOfA.id })).rejects.toBeInstanceOf(VendorTypeNotFoundError);
    await expect(removeVendorType(b, typeOfA.id, { moveVendorsTo: typeOfB.id })).rejects.toBeInstanceOf(VendorTypeNotFoundError);
    expect(await findVendors({ organizationId: b, familyId: familyOfA.id })).toHaveLength(0);

    expect((await listVendorFamilies(a)).find((family) => family.id === familyOfA.id)!.label).toBe(familyOfA.label);
    expect((await listVendorTypes(a)).some((type) => type.id === typeOfA.id)).toBe(true);
  });
});
