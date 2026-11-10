// Lot 21 (PRE-18, PRE-19, ADR 0050) — plans de rangement des étiquettes.
import { describe, expect, it } from "vitest";
import { planStarterTags, planTagArrangement, type PlanCatalogGroup, type PlanTag, type PlanVendor } from "./tag-arrangement";

const VENUES = "f-venues";
const DECOR = "f-decor";

const catalog: PlanCatalogGroup[] = [
  {
    label: "Capacité",
    exclusive: true,
    tags: [
      { label: "50 à 100 personnes", aliases: ["50 à 100 personnes", "50 to 100 guests"], familyIds: [VENUES] },
      { label: "100 à 150 personnes", aliases: ["100 à 150 personnes", "100 to 150 guests"], familyIds: [VENUES] },
      { label: "150 à 200 personnes", aliases: ["150 à 200 personnes", "150 to 200 guests"], familyIds: [VENUES] },
    ],
  },
  { label: "Équipements", exclusive: false, tags: [{ label: "Accès PMR", aliases: ["Accès PMR", "Wheelchair access"], familyIds: [VENUES] }] },
  { label: "Cérémonie", exclusive: false, tags: [{ label: "Laïque", aliases: ["Laïque", "Secular"], familyIds: null }] },
];

const tag = (id: string, label: string, extra: Partial<PlanTag> = {}): PlanTag => ({ id, label, groupId: null, familyIds: [], position: 0, ...extra });
const vendor = (id: string, familyId: string | null, tagIds: string[]): PlanVendor => ({ id, name: `Fiche ${id}`, familyId, tagIds });

describe("PRE-18 — Étiquettes de départ", () => {
  it("crée les groupes et les étiquettes qui manquent ; une étiquette du même libellé prend le groupe et la famille, sans doublon", () => {
    const { plan, created, placed } = planStarterTags({ tags: [tag("t-pmr", "accès pmr")], groups: [], vendors: [], catalog });

    expect(plan.newGroups.map((group) => [group.label, group.exclusive])).toEqual([
      ["Capacité", true],
      ["Équipements", false],
    ]);
    expect(plan.newTags.map((candidate) => candidate.label)).toEqual(["50 à 100 personnes", "100 à 150 personnes", "150 à 200 personnes"]);
    expect(plan.tagUpdates).toEqual([{ id: "t-pmr", group: { key: "equipements" }, familyIds: [VENUES], position: 0 }]);
    expect({ created, placed }).toEqual({ created: 3, placed: 1 });
  });

  it("une étiquette dont la famille n'existe plus n'est pas créée ; une étiquette déjà rangée garde son groupe", () => {
    const { plan } = planStarterTags({
      tags: [tag("t-pmr", "Accès PMR", { groupId: "g-mine", familyIds: [VENUES], position: 4 })],
      groups: [{ id: "g-mine", label: "Mes critères", exclusive: false, position: 0 }],
      vendors: [],
      catalog,
    });
    expect(plan.newTags.some((candidate) => candidate.label === "Laïque")).toBe(false);
    expect(plan.tagUpdates.some((update) => update.id === "t-pmr")).toBe(false);
  });
});

describe("PRE-19 — Les étiquettes importées se rangent toutes seules", () => {
  const imported = [
    tag("t-100", "100 à 150 personnes"),
    tag("t-150", "150 à 200 personnes"),
    tag("t-250", "250 à 300 personnes"),
    tag("t-m2a", "100 à 200m2"),
    tag("t-m2b", "200 à 400 m2"),
    tag("t-pmr", "Accès PMR"),
    tag("t-bougies", "Bougies"),
    tag("t-ambiance", "Ambiance"),
  ];
  const vendors = [
    vendor("v-domaine", VENUES, ["t-100", "t-150", "t-m2a", "t-pmr"]),
    vendor("v-chateau", VENUES, ["t-250", "t-m2b"]),
    vendor("v-fleurs", DECOR, ["t-bougies"]),
    vendor("v-sans-type", null, ["t-ambiance"]),
  ];

  it("reconnaît les étiquettes de départ, range les tranches par palier, déduit la famille des prestataires qui les portent", () => {
    const { plan, recap } = planTagArrangement({ tags: imported, groups: [], vendors, catalog });
    const update = (id: string) => plan.tagUpdates.find((candidate) => candidate.id === id);

    expect(update("t-pmr")).toEqual({ id: "t-pmr", group: { key: "equipements" }, familyIds: [VENUES], position: 0 });
    // La tranche inconnue du modèle rejoint « Capacité » par son unité, à sa place.
    expect([update("t-100"), update("t-150"), update("t-250")].map((candidate) => [candidate?.group, candidate?.position])).toEqual([
      [{ key: "capacite" }, 0],
      [{ key: "capacite" }, 1],
      [{ key: "capacite" }, 2],
    ]);
    expect(update("t-250")?.familyIds).toEqual([VENUES]);
    // Deux surfaces : un nouveau palier, réservé aux lieux qui les portent.
    expect(plan.newGroups.map((group) => [group.label, group.exclusive])).toEqual([
      ["Capacité", true],
      ["Équipements", false],
      ["M2", true],
    ]);
    expect(update("t-m2a")).toMatchObject({ group: { key: "m2" }, familyIds: [VENUES], position: 0 });
    expect(update("t-bougies")).toEqual({ id: "t-bougies", group: null, familyIds: [DECOR], position: 0 });
    expect(update("t-ambiance")).toBeUndefined();
    expect(recap).toMatchObject({ looseTags: 8, catalogMatched: 3, remaining: 1, tiers: [{ label: "Capacité", count: 3 }, { label: "M2", count: 2 }] });
  });

  it("une fiche qui portait plusieurs tranches d'un même palier garde la plus haute, et elle est signalée", () => {
    const { plan, recap } = planTagArrangement({ tags: imported, groups: [], vendors, catalog });
    expect(plan.vendorUpdates).toEqual([{ id: "v-domaine", tagIds: ["t-150", "t-m2a", "t-pmr"] }]);
    expect(recap.adjustedVendors).toEqual([{ id: "v-domaine", name: "Fiche v-domaine" }]);
  });

  it("à l'import, seules les étiquettes créées par l'import sont rangées ; une étiquette créée à la main n'est pas touchée", () => {
    const { plan } = planTagArrangement({ tags: imported, groups: [], vendors, catalog, scope: new Set(["t-bougies"]) });
    expect(plan.tagUpdates.map((update) => update.id)).toEqual(["t-bougies"]);
    expect(plan.newGroups).toEqual([]);
  });

  it("rien à ranger : aucun changement", () => {
    const tidy = [tag("t-pmr", "Accès PMR", { groupId: "g-eq", familyIds: [VENUES] })];
    const { plan, recap } = planTagArrangement({ tags: tidy, groups: [{ id: "g-eq", label: "Équipements", exclusive: false, position: 0 }], vendors: [], catalog });
    expect(plan).toEqual({ newGroups: [], tagUpdates: [], newTags: [], vendorUpdates: [] });
    expect(recap.looseTags).toBe(0);
  });
});
