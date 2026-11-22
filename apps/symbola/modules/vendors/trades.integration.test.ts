// Lot 63e (PRE-01, PRE-11, HUB-20 ; ADR 0105) — une fiche, plusieurs métiers, contre un vrai PostgreSQL
// (RLS), par la porte d'entrée du module : métiers cochés et principal, étiquettes et champs de chaque
// métier, filtres, carte, recherche, comptes ; fusion et suppression d'un type ; reprise des types
// combinés (rapport, puis application rejouable) ; isolation entre organisations.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { domainEvents } from "@symbola/db/schema/core";
import { searchWords } from "@symbola/db/search";
import { vendorCatalogInput } from "@/lib/vendors/catalog";
import {
  addVendorTypeField,
  countVendorsByFamily,
  countVendorsByType,
  createVendor,
  createVendorFamily,
  createVendorType,
  findVendors,
  getVendor,
  getVendorsByIds,
  listVendorTypes,
  mergeVendorTypes,
  previewVendorTypeSplit,
  removeVendorType,
  searchVendorBook,
  seedStarterVendorCatalog,
  splitCombinedVendorTypes,
  updateVendor,
  VendorTypeNotFoundError,
} from "./service";

// Une seule connexion pour tout le fichier (le socle de dev est partagé).
const connection = createAppConnection();
afterAll(async () => {
  await connection.sql.end();
});

async function newOrganization(): Promise<string> {
  return (await createOrganization(connection.db, `Org ${randomUUID()}`)).id;
}

async function photoVideo(organizationId: string) {
  const family = await createVendorFamily(organizationId, { label: "Photo et vidéo", color: "#7a2e5c", icon: "camera" });
  const photo = await createVendorType(organizationId, "Photographe", "#7a2e5c", { familyId: family.id });
  const video = await createVendorType(organizationId, "Vidéaste", "#7a2e5c", { familyId: family.id });
  const style = await addVendorTypeField(organizationId, photo.id, { label: "Style", kind: "text" });
  const drone = await addVendorTypeField(organizationId, video.id, { label: "Drone", kind: "boolean", isFilter: true });
  return { family, photo, video, style, drone };
}

describe("PRE-01 — Une fiche, plusieurs métiers", () => {
  it("étant donné un studio photographe et vidéaste, quand elle coche les deux métiers et choisit le principal, alors la fiche les garde, le principal en premier, et les champs des deux métiers s'ajoutent", async () => {
    const organizationId = await newOrganization();
    const { photo, video, style, drone } = await photoVideo(organizationId);
    const { vendor } = await createVendor(organizationId, {
      name: "Studio Lumière",
      typeIds: [video.id, photo.id],
      primaryTypeId: photo.id,
      fieldValues: { [style.id]: "Reportage", [drone.id]: true },
    });
    expect(vendor.typeIds).toEqual([photo.id, video.id]);
    expect(vendor.primaryTypeId).toBe(photo.id);
    // L'ancien champ reste, le temps que les appelants passent aux métiers.
    expect(vendor.typeId).toBe(photo.id);
    expect(vendor.fieldValues).toEqual({ [style.id]: "Reportage", [drone.id]: true });

    // Le principal change ; un métier décoché perd ses champs.
    const { vendor: updated } = await updateVendor(organizationId, vendor.id, { name: "Studio Lumière", typeIds: [video.id], fieldValues: { [style.id]: "Reportage", [drone.id]: true } });
    expect(updated.typeIds).toEqual([video.id]);
    expect(updated.primaryTypeId).toBe(video.id);
    expect(updated.fieldValues).toEqual({ [drone.id]: true });
    const { vendor: none } = await updateVendor(organizationId, vendor.id, { name: "Studio Lumière", typeIds: [] });
    expect(none).toMatchObject({ typeIds: [], primaryTypeId: null, typeId: null });
  });

  it("un appelant d'avant le lot (typeId seul) donne un seul métier, principal", async () => {
    const organizationId = await newOrganization();
    const { photo } = await photoVideo(organizationId);
    const { vendor } = await createVendor(organizationId, { name: "Studio Ancien", typeId: photo.id });
    expect(vendor).toMatchObject({ typeIds: [photo.id], primaryTypeId: photo.id, typeId: photo.id });
    expect((await getVendorsByIds(organizationId, [vendor.id]))[0]!.typeIds).toEqual([photo.id]);
  });

  it("un métier d'une autre organisation, ou un principal non coché, est refusé", async () => {
    const organizationId = await newOrganization();
    const other = await newOrganization();
    const { photo } = await photoVideo(organizationId);
    const foreign = await createVendorType(other, "Traiteur", "#123456");
    await expect(createVendor(organizationId, { name: "Intrus", typeIds: [photo.id, foreign.id] })).rejects.toBeInstanceOf(VendorTypeNotFoundError);
    await expect(createVendor(organizationId, { name: "Intrus", typeIds: [photo.id], primaryTypeId: foreign.id })).rejects.toBeInstanceOf(VendorTypeNotFoundError);
  });
});

describe("PRE-11 — Filtres, carte, recherche et comptes par n'importe quel métier", () => {
  it("la fiche est trouvée par le filtre Photographe comme par le filtre Vidéaste, par sa famille une seule fois, et par le mot « vidéaste »", async () => {
    const organizationId = await newOrganization();
    const { family, photo, video, drone } = await photoVideo(organizationId);
    const { vendor: studio } = await createVendor(organizationId, { name: "Studio Lumière", typeIds: [photo.id, video.id], city: "Lyon", fieldValues: { [drone.id]: true } });
    await createVendor(organizationId, { name: "Clic Photo", typeIds: [photo.id], city: "Lyon" });
    await createVendor(organizationId, { name: "Sans métier", city: "Lyon" });
    const names = async (input: Omit<Parameters<typeof findVendors>[0], "organizationId">) => (await findVendors({ organizationId, ...input })).map((vendor) => vendor.name);

    expect(await names({ typeIds: [video.id] })).toEqual(["Studio Lumière"]);
    expect(await names({ typeIds: [photo.id] })).toEqual(["Clic Photo", "Studio Lumière"]);
    expect(await names({ familyId: family.id })).toEqual(["Clic Photo", "Studio Lumière"]);
    expect(await names({ unclassified: true })).toEqual(["Sans métier"]);
    // Un champ filtre d'un métier secondaire filtre aussi.
    expect(await names({ typeIds: [video.id], fieldFilters: [{ fieldId: drone.id, op: "eq", value: true }] })).toEqual(["Studio Lumière"]);
    // Recherche : le carnet et la recherche globale lisent les métiers.
    expect(await names({ text: "videaste" })).toEqual(["Studio Lumière"]);
    expect((await searchVendorBook(organizationId, searchWords("vidéaste"), 10)).map((result) => [result.name, result.typeLabel, result.typeLabels])).toEqual([["Studio Lumière", "Photographe", ["Photographe", "Vidéaste"]]]);

    const byType = new Map((await countVendorsByType(organizationId)).map((entry) => [entry.typeId, entry.count]));
    expect(byType.get(photo.id)).toBe(2);
    expect(byType.get(video.id)).toBe(1);
    expect(byType.get(null)).toBe(1);
    const byFamily = await countVendorsByFamily(organizationId);
    expect(byFamily.total).toBe(3);
    expect(byFamily.families.find((entry) => entry.familyId === family.id)!.count).toBe(2);
    expect(byFamily.families.find((entry) => entry.familyId === null)!.count).toBe(1);
    expect(studio.primaryTypeId).toBe(photo.id);
  });
});

describe("L16-PRE-15, PRE-01 — Fusion et suppression d'un type, avec plusieurs métiers", () => {
  it("fusionner Vidéo dans Vidéaste : la fiche qui avait les deux n'en garde qu'un ; l'événement vendors.vendor_type.merged reste le même", async () => {
    const organizationId = await newOrganization();
    const { photo, video } = await photoVideo(organizationId);
    const old = await createVendorType(organizationId, "Vidéo", "#123456");
    const { vendor: both } = await createVendor(organizationId, { name: "Studio Double", typeIds: [old.id, video.id, photo.id] });
    const { vendor: single } = await createVendor(organizationId, { name: "Studio Simple", typeIds: [photo.id, old.id] });
    const result = await mergeVendorTypes(organizationId, { sourceTypeId: old.id, targetTypeId: video.id });
    expect(result.movedVendors).toBe(2);
    expect((await getVendor(organizationId, both.id))!.typeIds).toEqual([video.id, photo.id]);
    expect((await getVendor(organizationId, both.id))!.primaryTypeId).toBe(video.id);
    expect((await getVendor(organizationId, single.id))!.typeIds).toEqual([photo.id, video.id]);
    {
      const events = await connection.db.select().from(domainEvents).where(and(eq(domainEvents.organizationId, organizationId), eq(domainEvents.name, "vendors.vendor_type.merged")));
      expect(events.map((event) => event.payload)).toEqual([{ sourceTypeId: old.id, targetTypeId: video.id, movedVendorCount: 2, movedFieldCount: 0 }]);
    }
  });

  it("supprimer le métier principal d'une fiche « à classer » : le suivant devient principal ; son seul métier : la fiche passe « à classer »", async () => {
    const organizationId = await newOrganization();
    const { photo, video } = await photoVideo(organizationId);
    const { vendor: both } = await createVendor(organizationId, { name: "Studio Double", typeIds: [photo.id, video.id] });
    const { vendor: single } = await createVendor(organizationId, { name: "Clic Photo", typeIds: [photo.id] });
    await removeVendorType(organizationId, photo.id, { moveVendorsTo: null });
    expect((await getVendor(organizationId, both.id))!).toMatchObject({ typeIds: [video.id], primaryTypeId: video.id });
    expect((await getVendor(organizationId, single.id))!).toMatchObject({ typeIds: [], primaryTypeId: null });
  });
});

describe("PRE-01, HUB-20 — Reprise des types combinés", () => {
  it("le rapport dit ce qui changerait sans rien écrire ; l'application scinde chaque type combiné, fusionne dans le premier métier, crée le second s'il manque ; rejouée, elle ne fait plus rien", async () => {
    const organizationId = await newOrganization();
    await seedStarterVendorCatalog(organizationId, vendorCatalogInput("fr"), { withTypes: true });
    const types = await listVendorTypes(organizationId);
    const photo = types.find((type) => type.starterKey === "photographer")!;
    const video = types.find((type) => type.starterKey === "videographer")!;
    // Une organisation qui a supprimé « Maquillage » et gardé l'ancien « Coiffure et maquillage ».
    const makeup = types.find((type) => type.starterKey === "makeup")!;
    await removeVendorType(organizationId, makeup.id);
    const hair = types.find((type) => type.starterKey === "hair_makeup")!;
    await connection.sql.begin(async (tx) => {
      await tx`select set_config('app.organization_id', ${organizationId}, true)`;
      await tx`update vendors.vendor_types set label = 'Coiffure et maquillage' where id = ${hair.id}`;
    });
    const combined = await createVendorType(organizationId, "Photographe & Vidéaste", "#78716c");
    const { vendor: studio } = await createVendor(organizationId, { name: "Clic & Déclic", typeIds: [combined.id] });
    const { vendor: beauty } = await createVendor(organizationId, { name: "Beauté du Jour", typeIds: [hair.id] });
    const { vendor: other } = await createVendor(organizationId, { name: "Studio Brune", typeIds: [photo.id] });

    const plan = await previewVendorTypeSplit(organizationId, vendorCatalogInput("fr"), "fr");
    expect(plan).toEqual(
      expect.arrayContaining([
        { typeId: combined.id, label: "Photographe & Vidéaste", vendorCount: 1, first: { action: "merge", into: { id: photo.id, label: photo.label } }, others: [{ key: "videographer", label: video.label, existing: { id: video.id, label: video.label } }] },
        { typeId: hair.id, label: "Coiffure et maquillage", vendorCount: 1, first: { action: "rename", key: "hair_makeup", to: "Coiffure" }, others: [{ key: "makeup", label: "Maquillage", existing: null }] },
      ]),
    );
    expect((await listVendorTypes(organizationId)).some((type) => type.id === combined.id)).toBe(true);

    const result = await splitCombinedVendorTypes(organizationId, vendorCatalogInput("fr"), "fr");
    expect(result.map((entry) => [entry.label, entry.vendors, entry.createdTypes]).sort()).toEqual([
      ["Coiffure et maquillage", 1, ["Maquillage"]],
      ["Photographe & Vidéaste", 1, []],
    ]);
    const after = await listVendorTypes(organizationId);
    expect(after.some((type) => type.id === combined.id)).toBe(false);
    expect(after.find((type) => type.id === hair.id)!.label).toBe("Coiffure");
    const newMakeup = after.find((type) => type.starterKey === "makeup")!;
    expect((await getVendor(organizationId, studio.id))!).toMatchObject({ typeIds: [photo.id, video.id], primaryTypeId: photo.id });
    expect((await getVendor(organizationId, beauty.id))!).toMatchObject({ typeIds: [hair.id, newMakeup.id], primaryTypeId: hair.id });
    expect((await getVendor(organizationId, other.id))!.typeIds).toEqual([photo.id]);

    expect(await previewVendorTypeSplit(organizationId, vendorCatalogInput("fr"), "fr")).toEqual([]);
    expect(await splitCombinedVendorTypes(organizationId, vendorCatalogInput("fr"), "fr")).toEqual([]);
  });

  it("une organisation ne voit ni ne reprend les types d'une autre", async () => {
    const a = await newOrganization();
    const b = await newOrganization();
    const combined = await createVendorType(b, "Photographe et vidéaste", "#78716c");
    await createVendor(b, { name: "Chez B", typeIds: [combined.id] });
    expect(await previewVendorTypeSplit(a, vendorCatalogInput("fr"), "fr")).toEqual([]);
    expect(await splitCombinedVendorTypes(a, vendorCatalogInput("fr"), "fr")).toEqual([]);
    expect((await listVendorTypes(b)).map((type) => type.label)).toEqual(["Photographe et vidéaste"]);
  });
});
