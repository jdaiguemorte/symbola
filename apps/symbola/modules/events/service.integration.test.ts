// PRD-EVT-01 / PRD-EVT-07 — liste des événements et source du prospect, contre un
// vrai PostgreSQL (RLS, ADR 0012), par la porte d'entrée du module.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { starterLossReasons, starterProspectSources } from "@symbola/starter-templates";
import {
  addLossReasons,
  addProspectSources,
  addEventTask,
  changeEventStatus,
  createLossReason,
  listOrganizationTasks,
  updateEventTask,
  createProspect,
  createProspectSource,
  getEvent,
  listEvents,
  listLossReasons,
  listProspectSources,
} from "./service";

// Auteur des créations, historisé dans event_status_history (PRD-EVT-02).
const plannerId = randomUUID();

async function seedOrganization() {
  const organizationId = randomUUID();
  const instagram = await createProspectSource(organizationId, "Instagram");
  const salon = await createProspectSource(organizationId, "Salon");
  return { organizationId, instagram, salon };
}

describe("PRD-EVT-01 — Liste des événements", () => {
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

describe("PRD-EVT-07 — Source du prospect", () => {
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

describe("PRD-EVT-07 — Listes de départ des sources et des motifs de perte", () => {
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

describe("PRD-HUB-02 — Tâches de toute l'organisation (accueil, écran Tâches)", () => {
  async function prospect(organizationId: string, sourceId: string, firstName: string, eventDate: string | null) {
    return createProspect({
      organizationId,
      createdByUserId: plannerId,
      prospectSourceId: sourceId,
      clients: [{ firstName, lastName: null }, { firstName: "Sacha", lastName: null }],
      eventDate,
      venueName: null,
      venueCity: null,
    });
  }

  it("liste les tâches non faites en retard ou dues sous 14 jours, triées par échéance, avec le nom de l'événement", async () => {
    const { organizationId, instagram } = await seedOrganization();
    const ines = await prospect(organizationId, instagram.id, "Inès", "2027-06-12");
    const lea = await prospect(organizationId, instagram.id, "Léa", "2027-05-15");
    await addEventTask(organizationId, ines.id, { label: "En retard", dueDate: "2026-10-28", responsible: "planner" });
    await addEventTask(organizationId, lea.id, { label: "Dans 14 jours", dueDate: "2026-11-17", responsible: "clients" });
    await addEventTask(organizationId, ines.id, { label: "Dans 15 jours", dueDate: "2026-11-18", responsible: "planner" });
    const done = await addEventTask(organizationId, lea.id, { label: "Faite", dueDate: "2026-11-05", responsible: "planner" });
    await updateEventTask({ organizationId, taskId: done.id, done: true });

    const tasks = await listOrganizationTasks({ organizationId, today: "2026-11-03", horizonDays: 14 });
    expect(tasks.map((task) => [task.label, task.event.names, task.overdue])).toEqual([
      ["En retard", "Inès & Sacha", true],
      ["Dans 14 jours", "Léa & Sacha", false],
    ]);
    expect(tasks[1]?.responsible).toBe("clients");
  });

  it("sans horizon et faites comprises : toutes les tâches ; jamais celles d'un événement perdu ou réalisé", async () => {
    const { organizationId, instagram } = await seedOrganization();
    const reason = await createLossReason(organizationId, "Budget", false);
    const kept = await prospect(organizationId, instagram.id, "Anna", "2027-07-03");
    const lost = await prospect(organizationId, instagram.id, "Zoé", null);
    await addEventTask(organizationId, kept.id, { label: "Lointaine", dueDate: "2027-05-01", responsible: "planner" });
    const doneTask = await addEventTask(organizationId, kept.id, { label: "Faite", dueDate: "2026-09-01", responsible: "planner" });
    await updateEventTask({ organizationId, taskId: doneTask.id, done: true });
    await addEventTask(organizationId, lost.id, { label: "Événement perdu", dueDate: "2026-11-04", responsible: "planner" });
    await changeEventStatus({ organizationId, eventId: lost.id, changedByUserId: plannerId, toStatus: "lost", lossReasonId: reason.id });

    const tasks = await listOrganizationTasks({ organizationId, today: "2026-11-03", horizonDays: null, includeDone: true });
    expect(tasks.map((task) => [task.label, task.done])).toEqual([
      ["Faite", true],
      ["Lointaine", false],
    ]);
  });

  it("isolation : une organisation ne voit jamais les tâches d'une autre", async () => {
    const own = await seedOrganization();
    const other = await seedOrganization();
    const event = await prospect(own.organizationId, own.instagram.id, "Inès", null);
    await addEventTask(own.organizationId, event.id, { label: "Privée", dueDate: "2026-11-04", responsible: "planner" });
    expect(await listOrganizationTasks({ organizationId: other.organizationId, today: "2026-11-03", horizonDays: 14 })).toEqual([]);
  });
});

