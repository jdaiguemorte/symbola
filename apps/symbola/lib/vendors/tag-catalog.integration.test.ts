// Lot 21 (L21-PRE-18, L21-PRE-19, ADR 0050) — étiquettes de départ et rangement des
// étiquettes importées, contre un vrai PostgreSQL (RLS), par les portes
// d'entrée des modules ; isolation entre organisations comprise.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  arrangeVendorTags,
  countMissingStarterVendorTags,
  createVendor,
  createVendorTag,
  getVendor,
  listVendorFamilies,
  listVendorTagGroups,
  listVendorTags,
  listVendorTypes,
  previewVendorTagArrangement,
  seedStarterVendorCatalog,
  seedStarterVendorTags,
} from "@/modules/vendors/service";
import { vendorCatalogInput } from "./catalog";
import { vendorTagCatalogInput } from "./tag-catalog";

const catalog = vendorTagCatalogInput("fr", "wedding_planner");

async function organizationWithFamilies() {
  const { sql, db } = createAppConnection();
  let organizationId: string;
  try {
    organizationId = (await createOrganization(db, `Org ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
  await seedStarterVendorCatalog(organizationId, vendorCatalogInput("fr"), { withTypes: true });
  const families = await listVendorFamilies(organizationId);
  const types = await listVendorTypes(organizationId);
  const familyId = (key: string) => families.find((family) => family.starterKey === key)!.id;
  const typeId = (key: string) => types.find((type) => type.starterKey === key)!.id;
  return { organizationId, familyId, typeId };
}

describe("L21-PRE-18 — Étiquettes de départ, rangées par famille", { timeout: 30_000 }, () => {
  it("quand elle ajoute les étiquettes proposées, alors elles sont rangées en groupes et par famille ; un second ajout ne duplique rien", async () => {
    const { organizationId, familyId } = await organizationWithFamilies();
    expect(await countMissingStarterVendorTags(organizationId, catalog)).toBeGreaterThan(20);

    const first = await seedStarterVendorTags(organizationId, catalog);

    const groups = await listVendorTagGroups(organizationId);
    const tags = await listVendorTags(organizationId);
    const capacity = groups.find((group) => group.label === "Capacité")!;
    expect(capacity.exclusive).toBe(true);
    expect(tags.find((tag) => tag.label === "100 à 150 personnes")).toMatchObject({ groupId: capacity.id, familyIds: [familyId("venues")] });
    expect(tags.find((tag) => tag.label === "Champêtre")?.familyIds.sort()).toEqual([familyId("venues"), familyId("decor")].sort());
    expect(tags.find((tag) => tag.label === "Anglais")?.familyIds).toEqual([]);
    expect(first.created).toBe(tags.length);
    expect(await seedStarterVendorTags(organizationId, catalog)).toEqual({ created: 0, placed: 0 });
    expect(await countMissingStarterVendorTags(organizationId, catalog)).toBe(0);
  });

  it("une étiquette qu'elle a déjà, sous le même libellé, prend le groupe et la famille, sans doublon", async () => {
    const { organizationId, familyId } = await organizationWithFamilies();
    const mine = await createVendorTag(organizationId, "accès pmr");

    const result = await seedStarterVendorTags(organizationId, catalog);

    const tags = await listVendorTags(organizationId);
    expect(tags.filter((tag) => tag.label.toLowerCase() === "accès pmr")).toHaveLength(1);
    expect(tags.find((tag) => tag.id === mine.id)).toMatchObject({ familyIds: [familyId("venues")] });
    expect(result.placed).toBe(1);
  });
});

describe("L21-PRE-19 — Les étiquettes importées se rangent toutes seules", { timeout: 30_000 }, () => {
  it("quand elle range ses étiquettes importées, alors les tranches forment un palier, chaque étiquette prend la famille de ses prestataires, et une fiche garde sa plus haute tranche", async () => {
    const { organizationId, familyId, typeId } = await organizationWithFamilies();
    const [small, large, candles, mood] = await Promise.all(["100 à 150 personnes", "150 à 200 personnes", "Bougies", "Ambiance"].map((label) => createVendorTag(organizationId, label)));
    const venue = (await createVendor(organizationId, { name: "Domaine des Saules", typeId: typeId("venue"), city: "Lille", tagIds: [small!.id, large!.id] })).vendor;
    await createVendor(organizationId, { name: "Fleurs de Lys", typeId: typeId("florist"), city: "Lille", tagIds: [candles!.id] });
    await createVendor(organizationId, { name: "Sans type", typeId: null, city: "Lille", tagIds: [mood!.id] });

    const preview = await previewVendorTagArrangement(organizationId, catalog);
    expect(preview).toMatchObject({ changed: true, looseTags: 4 });
    expect((await listVendorTags(organizationId)).every((tag) => tag.groupId === null)).toBe(true);

    const recap = await arrangeVendorTags(organizationId, catalog);

    expect(recap).toMatchObject({ changed: true, catalogMatched: 2, familiesSet: 1, remaining: 1, tiers: [{ label: "Capacité", count: 2 }], adjustedVendors: [{ id: venue.id, name: "Domaine des Saules" }] });
    const tags = await listVendorTags(organizationId);
    const capacity = (await listVendorTagGroups(organizationId)).find((group) => group.label === "Capacité")!;
    expect(tags.filter((tag) => tag.groupId === capacity.id).map((tag) => tag.label)).toEqual(["100 à 150 personnes", "150 à 200 personnes"]);
    expect(tags.find((tag) => tag.id === candles!.id)?.familyIds).toEqual([familyId("decor")]);
    expect(tags.find((tag) => tag.id === mood!.id)).toMatchObject({ groupId: null, familyIds: [] });
    expect((await getVendor(organizationId, venue.id))?.tagIds).toEqual([large!.id]);
    expect((await previewVendorTagArrangement(organizationId, catalog)).changed).toBe(false);
  });

  it("isolation : ranger ou ajouter les étiquettes d'une organisation ne touche pas celles d'une autre", async () => {
    const a = await organizationWithFamilies();
    const b = await organizationWithFamilies();
    const tagA = await createVendorTag(a.organizationId, "Accès PMR");

    await seedStarterVendorTags(b.organizationId, catalog);
    await arrangeVendorTags(b.organizationId, catalog);

    expect(await listVendorTags(a.organizationId)).toEqual([expect.objectContaining({ id: tagA.id, groupId: null, familyIds: [] })]);
    expect(await listVendorTagGroups(a.organizationId)).toEqual([]);
    expect((await listVendorTags(b.organizationId)).some((tag) => tag.id === tagA.id)).toBe(false);
  });
});
