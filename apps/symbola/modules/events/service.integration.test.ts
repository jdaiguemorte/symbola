// EVT-01 / EVT-07 — liste des événements et source du prospect, contre un
// vrai PostgreSQL (RLS, ADR 0012), par la porte d'entrée du module.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { starterLossReasons, starterProspectSources } from "@symbola/starter-templates";
import {
  addLossReasons,
  addProspectSources,
  createProspect,
  createProspectSource,
  getEvent,
  listEvents,
  listLossReasons,
  listProspectSources,
} from "./service";

// Auteur des créations, historisé dans event_status_history (EVT-02).
const plannerId = randomUUID();

async function seedOrganization() {
  const organizationId = randomUUID();
  const instagram = await createProspectSource(organizationId, "Instagram");
  const salon = await createProspectSource(organizationId, "Salon");
  return { organizationId, instagram, salon };
}

describe("EVT-01 — Liste des événements", () => {
  it("trie par date croissante, les événements sans date en tête", async () => {
    const { organizationId, instagram } = await seedOrganization();
    const base = {
      organizationId,
      createdByUserId: plannerId,
      prospectSourceId: instagram.id,
      venueName: null,
      venueCity: null,
    };
    await createProspect({
      ...base,
      clients: [{ firstName: "Tard", lastName: null }],
      eventDate: "2027-09-12",
    });
    await createProspect({
      ...base,
      clients: [{ firstName: "SansDate", lastName: null }],
      eventDate: null,
    });
    await createProspect({
      ...base,
      clients: [{ firstName: "Tôt", lastName: null }],
      eventDate: "2027-05-08",
    });

    const items = await listEvents({ organizationId });
    expect(items.map((item) => item.clients[0]?.firstName)).toEqual(["SansDate", "Tôt", "Tard"]);
  });

  it("cherche par prénom, nom ou lieu", async () => {
    const { organizationId, instagram } = await seedOrganization();
    await createProspect({
      organizationId,
      createdByUserId: plannerId,
      prospectSourceId: instagram.id,
      clients: [{ firstName: "Camille", lastName: "Durand" }],
      eventDate: null,
      venueName: "Château de Vaux",
      venueCity: "Maincy",
    });

    for (const term of ["Camille", "durand", "Vaux", "Maincy"]) {
      expect(await listEvents({ organizationId, search: term })).toHaveLength(1);
    }
    expect(await listEvents({ organizationId, search: "Introuvable" })).toHaveLength(0);
  });
});

describe("EVT-07 — Source du prospect", () => {
  it("la source est visible dans la fiche et filtrable dans la liste", async () => {
    const { organizationId, instagram, salon } = await seedOrganization();
    const base = {
      organizationId,
      createdByUserId: plannerId,
      eventDate: null,
      venueName: null,
      venueCity: null,
    };
    const viaInstagram = await createProspect({
      ...base,
      prospectSourceId: instagram.id,
      clients: [{ firstName: "Alix", lastName: null }],
    });
    await createProspect({
      ...base,
      prospectSourceId: salon.id,
      clients: [{ firstName: "Sacha", lastName: null }],
    });

    const detail = await getEvent(organizationId, viaInstagram.id);
    expect(detail?.prospectSourceId).toBe(instagram.id);

    const filtered = await listEvents({ organizationId, prospectSourceId: instagram.id });
    expect(filtered.map((item) => item.id)).toEqual([viaInstagram.id]);
  });
});

describe("EVT-07 — Listes de départ des sources et des motifs de perte", () => {
  it("ajoute les sources et motifs de départ sans doublon, même relancé, en gardant ceux de la planner", async () => {
    const { organizationId } = await seedOrganization();
    const added = await addProspectSources(organizationId, starterProspectSources("fr"));
    // « Instagram » existait déjà (seedOrganization) : pas de doublon.
    expect(added).toBe(starterProspectSources("fr").length - 1);
    expect(await addProspectSources(organizationId, starterProspectSources("fr"))).toBe(0);
    const sources = (await listProspectSources(organizationId)).map((source) => source.label);
    expect(sources).toContain("Salon");
    expect(sources.filter((label) => label === "Instagram")).toHaveLength(1);

    expect(await addLossReasons(organizationId, starterLossReasons("fr"))).toBe(starterLossReasons("fr").length);
    expect(await addLossReasons(organizationId, [{ label: " budget INSUFFISANT ", isFreeText: false }])).toBe(0);
    const other = (await listLossReasons(organizationId)).find((reason) => reason.label === "Autre");
    expect(other?.isFreeText).toBe(true);
  });

  it("isolation : les listes chargées par une organisation n'apparaissent jamais chez une autre", async () => {
    const own = await seedOrganization();
    const other = await seedOrganization();
    await addProspectSources(own.organizationId, ["Mariages.net"]);
    await addLossReasons(own.organizationId, [{ label: "Trop loin", isFreeText: false }]);
    expect((await listProspectSources(other.organizationId)).map((source) => source.label)).not.toContain("Mariages.net");
    expect((await listLossReasons(other.organizationId)).map((reason) => reason.label)).not.toContain("Trop loin");
  });
});
