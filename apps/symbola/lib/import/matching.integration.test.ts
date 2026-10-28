// IMP-03 — rapprochements contre de vrais éléments existants (modules events
// et quotes, PostgreSQL réel) : mêmes clients et même date pour un
// événement, même intitulé pour un article, même intitulé dans le même
// événement pour une tâche ; validation un par un ou en lot, refus, ajout à
// la main ; isolation entre organisations ; événements d'essai ignorés.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addEventTask, createProspect, createProspectSource, startEventsTrial } from "@/modules/events/service";
import { getImportColumns, getImportWorkingSet, saveImportMapping, startImport, type ImportEntityType } from "@/modules/hub/service";
import { createCatalogItem } from "@/modules/quotes/service";
import { addManualMatch, decideMatches, getImportMatchesView } from "./matching";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, {
    organizationId: organization.id,
    email: `planner-${randomUUID()}@symbola.test`,
    password: "mot-de-passe",
    role: "owner",
  });
  const source = await createProspectSource(organization.id, "Instagram");
  return { organizationId: organization.id, userId: user.id, sourceId: source.id };
}

type Planner = Awaited<ReturnType<typeof createPlanner>>;

async function createEvent(planner: Planner, eventDate: string, clients: { firstName: string; lastName: string }[]) {
  const { id } = await createProspect({
    organizationId: planner.organizationId,
    createdByUserId: planner.userId,
    prospectSourceId: planner.sourceId,
    clients,
    eventDate,
  });
  return id;
}

// Import dont les colonnes proposées sont acceptées telles quelles.
async function importWithColumns(planner: Planner, entityType: ImportEntityType, csv: string) {
  const started = await startImport(db, {
    organizationId: planner.organizationId,
    userId: planner.userId,
    entityType,
    fileName: "import.csv",
    bytes: new TextEncoder().encode(csv),
  });
  if (started.status !== "started") throw new Error(`import refusé : ${JSON.stringify(started)}`);
  const view = await getImportColumns(db, planner.organizationId, started.importId);
  const saved = await saveImportMapping(db, {
    organizationId: planner.organizationId,
    importId: started.importId,
    choices: view!.columns.map((column) => ({ columnIndex: column.columnIndex, target: column.proposedFieldKey ?? "none", confirmed: true })),
  });
  if (saved.status !== "saved") throw new Error(`colonnes refusées : ${JSON.stringify(saved)}`);
  return started.importId;
}

describe("IMP-03 — Rapprochements", () => {
  it("Étant donné une ligne avec les mêmes clients et la même date qu'un événement existant, alors l'app propose de les rapprocher, avec le niveau de ressemblance", async () => {
    const planner = await createPlanner();
    const existing = await createEvent(planner, "2027-06-12", [
      { firstName: "Élodie", lastName: "Durand" },
      { firstName: "Mathéo", lastName: "Lefèvre" },
    ]);
    await createEvent(planner, "2027-09-03", [{ firstName: "Inès", lastName: "Moreau" }]);
    const importId = await importWithColumns(
      planner,
      "events",
      "Prénom mariée;Nom mariée;Prénom marié;Nom marié;Date du mariage\n" +
        "Elodie;Durand;Matheo;Lefevre;12/06/2027\n" +
        "Chloé;Petit;Hugo;Roux;20/08/2027\n" +
        // Mêmes clients, autre date : pas de rapprochement proposé.
        "Inès;Moreau;;;04/10/2027\n",
    );

    const view = await getImportMatchesView(planner.organizationId, importId);
    expect(view?.rows.map((row) => row.match && { candidateId: row.match.candidateId, score: row.match.score, status: row.match.status })).toEqual([
      { candidateId: existing, score: 100, status: "proposed" },
      null,
      null,
    ]);
    expect(view?.rows[0]?.match?.event?.eventDate).toBe("2027-06-12");
  });

  it("même intitulé pour un article du catalogue, aux fautes près", async () => {
    const planner = await createPlanner();
    const item = await createCatalogItem(planner.organizationId, {
      label: "Coordination jour J",
      unit: "forfait",
      unitPriceCents: 150000,
      vatRateBasisPoints: 2000,
    });
    const importId = await importWithColumns(planner, "catalog_items", "Intitulé;Unité;Prix HT\ncoordination jour-J;forfait;1 600\nFleurs;bouquet;80\n");
    const view = await getImportMatchesView(planner.organizationId, importId);
    expect(view?.rows[0]?.match).toMatchObject({ candidateId: item.id, label: "Coordination jour J", status: "proposed" });
    expect(view?.rows[0]?.match?.score).toBeGreaterThanOrEqual(90);
    expect(view?.rows[1]?.match).toBeNull();
  });

  it("une tâche se rapproche d'une tâche du même événement ; un événement introuvable est signalé", async () => {
    const planner = await createPlanner();
    const eventId = await createEvent(planner, "2027-06-12", [{ firstName: "Élodie", lastName: "Durand" }]);
    const otherEventId = await createEvent(planner, "2027-09-03", [{ firstName: "Inès", lastName: "Moreau" }]);
    const task = await addEventTask(planner.organizationId, eventId, { label: "Réserver le traiteur", dueDate: "2027-01-15", responsible: "planner" });
    // Même intitulé dans un autre événement : jamais proposé pour Élodie.
    await addEventTask(planner.organizationId, otherEventId, { label: "Envoyer les faire-part", dueDate: "2027-03-01", responsible: "planner" });
    const importId = await importWithColumns(
      planner,
      "tasks",
      "Date du mariage;Prénom client 1;Nom client 1;Tâche;Échéance\n" +
        "12/06/2027;Élodie;Durand;Réserver le traiteur;15/01/2027\n" +
        "12/06/2027;Élodie;Durand;Envoyer les faire-part;01/03/2027\n" +
        "01/01/2028;Personne;Inconnue;Fleurs;01/02/2027\n",
    );

    const view = await getImportMatchesView(planner.organizationId, importId);
    expect(view?.rows[0]?.event).toMatchObject({ eventId, score: 100 });
    expect(view?.rows[0]?.match).toMatchObject({ candidateId: task.id, score: 100 });
    expect(view?.rows[1]?.event?.eventId).toBe(eventId);
    expect(view?.rows[1]?.match).toBeNull();
    expect(view?.rows[1]?.options.map((option) => option.id)).toEqual([task.id]);
    expect(view?.rows[2]?.event).toMatchObject({ eventId: null });
    expect(view?.rows[2]?.options).toEqual([]);
  });

  it("Elle valide les rapprochements un par un ou en lot, en refuse, et en ajoute à la main", async () => {
    const planner = await createPlanner();
    const a = await createCatalogItem(planner.organizationId, { label: "Fleurs", unit: "bouquet", unitPriceCents: 8000, vatRateBasisPoints: 2000 });
    const b = await createCatalogItem(planner.organizationId, { label: "Animation DJ", unit: "soirée", unitPriceCents: 90000, vatRateBasisPoints: 2000 });
    const c = await createCatalogItem(planner.organizationId, { label: "Photobooth", unit: "jour", unitPriceCents: 40000, vatRateBasisPoints: 2000 });
    const importId = await importWithColumns(
      planner,
      "catalog_items",
      "Intitulé;Unité;Prix HT\nFleurs;bouquet;85\nAnimation DJ;soirée;950\nBorne photo;jour;400\n",
    );
    expect((await getImportMatchesView(planner.organizationId, importId))?.rows.map((row) => row.match?.candidateId ?? null)).toEqual([a.id, b.id, null]);

    // En lot : les deux propositions acceptées, puis la seconde refusée.
    expect(await decideMatches(planner.organizationId, importId, [{ rowIndex: 0, decision: "accept" }, { rowIndex: 1, decision: "accept" }])).toBe(true);
    expect(await decideMatches(planner.organizationId, importId, [{ rowIndex: 1, decision: "refuse" }])).toBe(true);
    // À la main : « Borne photo » est le Photobooth existant.
    expect(await addManualMatch(planner.organizationId, importId, 2, c.id)).toBe(true);

    const view = await getImportMatchesView(planner.organizationId, importId);
    expect(view?.rows.map((row) => row.match && { id: row.match.candidateId, status: row.match.status, manual: row.match.manual })).toEqual([
      { id: a.id, status: "accepted", manual: false },
      { id: b.id, status: "refused", manual: false },
      { id: c.id, status: "accepted", manual: true },
    ]);
  });

  it("changer les colonnes remet les rapprochements à calculer", async () => {
    const planner = await createPlanner();
    await createCatalogItem(planner.organizationId, { label: "Fleurs", unit: "bouquet", unitPriceCents: 8000, vatRateBasisPoints: 2000 });
    const importId = await importWithColumns(planner, "catalog_items", "Intitulé;Unité;Prix HT\nFleurs;bouquet;85\n");
    await getImportMatchesView(planner.organizationId, importId);
    expect((await getImportWorkingSet(db, planner.organizationId, importId))?.matching).not.toBeNull();

    const view = await getImportColumns(db, planner.organizationId, importId);
    await saveImportMapping(db, {
      organizationId: planner.organizationId,
      importId,
      choices: view!.columns.map((column) => ({ columnIndex: column.columnIndex, target: column.proposedFieldKey ?? "none", confirmed: true })),
    });
    expect((await getImportWorkingSet(db, planner.organizationId, importId))?.matching).toBeNull();
  });

  it("les événements d'essai ne sont jamais proposés", async () => {
    const planner = await createPlanner();
    const trial = await startEventsTrial({ organizationId: planner.organizationId, userId: planner.userId, locale: "fr", now: new Date() });
    const demoEvents = trial.eventId;
    expect(demoEvents).toBeTruthy();
    const importId = await importWithColumns(planner, "events", "Prénom client 1;Nom client 1\nLéa;Martin\n");
    const view = await getImportMatchesView(planner.organizationId, importId);
    expect(view?.rows[0]?.options.some((option) => option.id === demoEvents)).toBe(false);
  });
});

describe("IMP-03 — Isolation des rapprochements", () => {
  it("organisation A ne voit pas les éléments de B, ni son import, et ne peut pas rapprocher un élément de B", async () => {
    const plannerA = await createPlanner();
    const plannerB = await createPlanner();
    const itemB = await createCatalogItem(plannerB.organizationId, { label: "Fleurs", unit: "bouquet", unitPriceCents: 8000, vatRateBasisPoints: 2000 });
    const importA = await importWithColumns(plannerA, "catalog_items", "Intitulé;Unité;Prix HT\nFleurs;bouquet;85\n");

    const view = await getImportMatchesView(plannerA.organizationId, importA);
    expect(view?.rows[0]?.match).toBeNull();
    expect(view?.rows[0]?.options).toEqual([]);
    expect(await addManualMatch(plannerA.organizationId, importA, 0, itemB.id)).toBe(false);
    expect(await getImportMatchesView(plannerB.organizationId, importA)).toBeNull();
    expect(await decideMatches(plannerB.organizationId, importA, [{ rowIndex: 0, decision: "accept" }])).toBe(false);
  });
});
