// EVT-01 / EVT-07 — liste des événements et source du prospect, contre un
// vrai PostgreSQL (RLS, ADR 0012), par la porte d'entrée du module.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createProspect, createProspectSource, getEvent, listEvents } from "./service";

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
