// Lot 20 (décision 5, ADR 0049) — étiquettes rangées en groupes, rattachées à
// des familles, groupes « palier » à choix unique, paliers repérés dans les
// libellés importés ; contre un vrai PostgreSQL (RLS), par la porte d'entrée
// du module, isolation entre organisations comprise.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  applyVendorTagTierProposal,
  createVendor,
  createVendorFamily,
  createVendorTag,
  createVendorTagGroup,
  getVendor,
  listVendorTagGroups,
  listVendorTags,
  listVendorTagTierProposals,
  removeVendorTagGroup,
  updateVendor,
  updateVendorTag,
  updateVendorTagGroup,
  VendorTagGroupNotFoundError,
  VendorTagNotFoundError,
  VendorTagTierConflictError,
} from "./service";

async function newOrganization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Org ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

describe("Lot 20 (décision 5) — Étiquettes par groupe et par famille", () => {
  it("une étiquette se range dans un groupe et vaut pour certaines familles ; un groupe supprimé rend ses étiquettes à « Autres »", async () => {
    const organizationId = await newOrganization();
    const venues = await createVendorFamily(organizationId, { label: "Lieux", color: "#4f6b5a", icon: "venue" });
    const equipment = await createVendorTagGroup(organizationId, { label: "Équipements", exclusive: false });
    const tag = await createVendorTag(organizationId, "Accès PMR", { groupId: equipment.id, familyIds: [venues.id, randomUUID()] });
    // Une famille inconnue est ignorée.
    expect(tag).toMatchObject({ groupId: equipment.id, familyIds: [venues.id] });

    await updateVendorTag(organizationId, tag.id, { label: "Accès PMR complet", groupId: equipment.id, familyIds: [] });
    expect((await listVendorTags(organizationId)).find((candidate) => candidate.id === tag.id)).toMatchObject({ label: "Accès PMR complet", familyIds: [] });

    await removeVendorTagGroup(organizationId, equipment.id);
    expect(await listVendorTagGroups(organizationId)).toEqual([]);
    expect((await listVendorTags(organizationId)).find((candidate) => candidate.id === tag.id)?.groupId).toBeNull();
  });

  it("un groupe « palier » n'accepte qu'une étiquette par fiche", async () => {
    const organizationId = await newOrganization();
    const capacity = await createVendorTagGroup(organizationId, { label: "Capacité", exclusive: true });
    const small = await createVendorTag(organizationId, "100 à 150 personnes", { groupId: capacity.id });
    const large = await createVendorTag(organizationId, "150 à 200 personnes", { groupId: capacity.id });
    expect([small.position, large.position]).toEqual([0, 1]);
    const style = await createVendorTag(organizationId, "Champêtre");

    await expect(createVendor(organizationId, { name: "Domaine des Saules", typeId: null, tagIds: [small.id, large.id] })).rejects.toBeInstanceOf(
      VendorTagTierConflictError,
    );
    const { vendor } = await createVendor(organizationId, { name: "Domaine des Saules", typeId: null, tagIds: [small.id, style.id] });
    await expect(updateVendor(organizationId, vendor.id, { name: "Domaine des Saules", typeId: null, tagIds: [small.id, large.id] })).rejects.toBeInstanceOf(
      VendorTagTierConflictError,
    );
    await updateVendor(organizationId, vendor.id, { name: "Domaine des Saules", typeId: null, tagIds: [large.id, style.id] });
    expect((await getVendor(organizationId, vendor.id))?.tagIds.sort()).toEqual([large.id, style.id].sort());

    // Un groupe ordinaire accepte plusieurs étiquettes.
    await updateVendorTagGroup(organizationId, capacity.id, { label: "Capacité", exclusive: false });
    await updateVendor(organizationId, vendor.id, { name: "Domaine des Saules", typeId: null, tagIds: [small.id, large.id] });
  });

  it("les paliers repérés dans les étiquettes importées sont proposés, puis rangés en groupe « palier » une fois validés", async () => {
    const organizationId = await newOrganization();
    for (const label of ["150 à 200 personnes", "Moins de 50 personnes", "100 à 150 personnes", "Champêtre", "100 à 200m2"]) await createVendorTag(organizationId, label);
    const proposals = await listVendorTagTierProposals(organizationId);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.tags.map((tag) => tag.label)).toEqual(["Moins de 50 personnes", "100 à 150 personnes", "150 à 200 personnes"]);

    const group = await applyVendorTagTierProposal(organizationId, "personnes", "Capacité (personnes)");
    expect(group).toMatchObject({ label: "Capacité (personnes)", exclusive: true });
    const grouped = (await listVendorTags(organizationId)).filter((tag) => tag.groupId === group!.id);
    expect(grouped.map((tag) => [tag.label, tag.position])).toEqual([
      ["Moins de 50 personnes", 0],
      ["100 à 150 personnes", 1],
      ["150 à 200 personnes", 2],
    ]);
    // Rangées, elles ne sont plus proposées ; une unité inconnue ne crée rien.
    expect(await listVendorTagTierProposals(organizationId)).toEqual([]);
    expect(await applyVendorTagTierProposal(organizationId, "couchages", "Couchages")).toBeNull();
  });
});

describe("Lot 20 (décision 5) — Isolation des groupes d'étiquettes", () => {
  it("organisation A ne voit, ne modifie ni n'utilise les groupes et étiquettes de B", async () => {
    const organizationA = await newOrganization();
    const organizationB = await newOrganization();
    const groupB = await createVendorTagGroup(organizationB, { label: "Style", exclusive: false });
    const tagB = await createVendorTag(organizationB, "Chic", { groupId: groupB.id });

    expect(await listVendorTagGroups(organizationA)).toEqual([]);
    expect(await listVendorTags(organizationA)).toEqual([]);
    await expect(createVendorTag(organizationA, "Bohème", { groupId: groupB.id })).rejects.toBeInstanceOf(VendorTagGroupNotFoundError);
    await expect(updateVendorTag(organizationA, tagB.id, { label: "Piraté" })).rejects.toBeInstanceOf(VendorTagNotFoundError);
    await expect(updateVendorTagGroup(organizationA, groupB.id, { label: "Piraté", exclusive: true })).rejects.toBeInstanceOf(VendorTagGroupNotFoundError);
    await removeVendorTagGroup(organizationA, groupB.id);
    expect(await listVendorTagGroups(organizationB)).toEqual([groupB]);
    expect((await listVendorTags(organizationB))[0]).toMatchObject({ label: "Chic", groupId: groupB.id });
  });
});
