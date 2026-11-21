// Lot 62c (UX-13, UX-05, UX-12, NFR-19 ; décision D1) — la fiche d'évènement reprise : programme du
// jour J et budget en listes éditables (une ligne s'ouvre en place, une seule à la fois ; un seul
// « Enregistrer » par liste, qui dit le nombre de lignes modifiées ; « Annuler les modifications »),
// coordonnées des mariés en grille, cibles de 44 px du rétroplanning. Chaque parcours tourne en
// taille ordinateur et en 375 px, avec axe-core et les mesures communes du lot 62
// (docs/lots/lot-62-ergonomie.md, « Mesure commune aux quatre paquets »).
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import {
  addDefaultVendorSlots,
  addEventTask,
  addProgramItem,
  addVendorCandidate,
  createProspect,
  createProspectSource,
  getEventProgram,
  listDefaultVendorSlots,
  listEventTasks,
  listEventVendorSlots,
} from "../modules/events/service";
import { addBudgetLine, createAllocationModel, getEventBudget, listBudgetLines, simulateEventBudget, updateBudgetLine } from "../modules/budget/service";
import { openEventTab, readyOrganization, signIn } from "./helpers";
import { measureScreen } from "./lot-62c-mesures";

const SLOTS = ["Lieu de réception", "Traiteur", "Photographe", "Fleurs et décoration", "Musique", "Tenues et beauté", "Papeterie", "Hébergement et transport", "Imprévus"];

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;

// En taille ordinateur, la fenêtre du relevé (1440 × 900) : les hauteurs « en écrans » s'y comparent.
test.beforeEach(async ({ page }) => {
  if (!isPhone(page)) await page.setViewportSize({ width: 1440, height: 900 });
});

// Les critères communs du lot 62 : un bouton principal au plus, aucun champ court trop large, aucun
// débordement ; en taille ordinateur, jamais six champs empilés ; en 375 px, aucune cible de moins de 44 px.
async function expectCommonCriteria(page: Page) {
  const measures = await measureScreen(page);
  expect(measures.primary.length, `boutons principaux : ${measures.primary.join(" | ")}`).toBeLessThanOrEqual(1);
  expect(measures.wideShortFields).toBe(0);
  expect(measures.overflowX).toBeLessThanOrEqual(0);
  if (isPhone(page)) expect(measures.smallTargets).toEqual([]);
  else expect(measures.stackedRun).toBeLessThan(6);
  return measures;
}

async function wedding() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    const email = `planner-62c-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-lot-62c", role: "owner" });
    await addDefaultVendorSlots(organizationId, SLOTS);
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({
      organizationId,
      createdByUserId: owner.id,
      prospectSourceId: source.id,
      clients: [
        { firstName: "Léa", lastName: "Martin", email: `lea-${randomUUID()}@exemple.test` },
        { firstName: "Maxime", lastName: "Dubois" },
      ],
      eventDate: "2027-06-12",
    });
    return { organizationId, userId: owner.id, email, eventId: event.id };
  } finally {
    await sql.end();
  }
}

// Treize séquences, comme le programme mesuré au relevé.
const SEQUENCES: [string, string, string, string][] = [
  ["09:00", "10:00", "Accès du domaine, livraison du mobilier", "Domaine"],
  ["10:00", "12:00", "Installation florale et décoration", "Jardin et grande salle"],
  ["10:30", "13:00", "Coiffure et maquillage", "Maison des mariés"],
  ["12:00", "13:00", "Mise en place du traiteur", "Cuisine et terrasse"],
  ["13:00", "13:45", "Déjeuner de l'équipe", "Office"],
  ["13:30", "14:30", "Photos des préparatifs", "Maison des mariés"],
  ["14:00", "15:00", "Installation et essais de la sonorisation", "Sous les tilleuls"],
  ["15:00", "15:30", "Accueil des invités", "Allée"],
  ["15:30", "16:15", "Cérémonie laïque", "Sous les tilleuls"],
  ["16:30", "17:00", "Photos de couple", "Parc"],
  ["17:00", "18:45", "Vin d'honneur", "Terrasse"],
  ["19:30", "22:30", "Dîner", "Grande salle"],
  ["22:30", "02:00", "Soirée dansante", "Grande salle"],
];

test("UX-13, UX-05 — programme : une ligne par séquence, une seule ligne ouverte, un seul « Enregistrer le programme »", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  for (const [startTime, endTime, label, location] of SEQUENCES) await addProgramItem(setup.organizationId, setup.eventId, { startTime, endTime, label, location, vendorSlotIds: [], freeParticipants: [] });
  const saved = async () => (await getEventProgram(setup.organizationId, setup.eventId)).items.map((item) => `${item.startTime} ${item.label}`);
  const before = await saved();
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/events/${setup.eventId}`);
  await openEventTab(page, "Programme du jour J");

  // Chaque séquence est une ligne du tableau (début, fin, durée, séquence, lieu, qui), avec deux actions.
  const table = page.getByRole("table", { name: "Programme du jour J" });
  await expect(table.getByRole("columnheader")).toHaveText(["Début", "Fin", "Durée", "Séquence", "Lieu", "Qui", "Actions"]);
  await expect(table.getByRole("row")).toHaveCount(SEQUENCES.length + 1);
  const row = (label: string) => table.getByRole("row").filter({ has: page.locator("strong", { hasText: new RegExp(`^${label}$`) }) });
  await expect(row("Cérémonie laïque").locator(".program-start")).toHaveText("15:30");
  await expect(row("Cérémonie laïque").locator(".program-end")).toHaveText("16:15");
  await expect(row("Cérémonie laïque").locator(".program-duration")).toHaveText("45 min");
  await expect(row("Cérémonie laïque").locator(".program-place")).toHaveText("Sous les tilleuls");
  await expect(row("Cérémonie laïque").getByRole("button")).toHaveCount(2);
  for (const button of await row("Cérémonie laïque").getByRole("button").all()) {
    const box = (await button.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  // La diffusion, le PDF, l'agenda et l'import d'un chrono restent en tête de la carte, avant la liste.
  const tops = async (locator: ReturnType<Page["locator"]>) => (await locator.first().boundingBox())!.y;
  const listTop = await tops(table);
  for (const head of [page.getByRole("heading", { name: "Diffusion aux clients et aux prestataires" }), page.getByRole("link", { name: "Télécharger le PDF « mariés »" }), page.getByRole("heading", { name: "Mon calendrier" }), page.getByText("Importer un chrono (tableur)")]) {
    expect(await tops(head)).toBeLessThan(listTop);
  }

  // Au repos : les critères communs, et trois écrans au plus en taille ordinateur pour treize séquences.
  const measures = await expectCommonCriteria(page);
  if (!isPhone(page)) expect(measures.screens).toBeLessThanOrEqual(3);
  await expectNoAxeViolation(page);

  // « Modifier » ouvre la ligne en place ; une autre ligne ouverte referme la première.
  await page.getByRole("button", { name: "Modifier la ligne Cérémonie laïque" }).click();
  const ceremony = page.getByRole("group", { name: "Modifier la ligne Cérémonie laïque" });
  await expect(ceremony).toBeVisible();
  await ceremony.getByLabel("Séquence", { exact: true }).fill("Cérémonie laïque sous les tilleuls");
  await ceremony.getByLabel("Note interne").fill("Alliances chez le témoin");
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Modifier la ligne Dîner" }).click();
  await expect(ceremony).toHaveCount(0);
  const dinner = page.getByRole("group", { name: "Modifier la ligne Dîner" });
  await dinner.getByLabel("Début", { exact: true }).fill("19:45");
  await dinner.getByRole("button", { name: "Fermer la ligne" }).click();
  await expect(page.getByRole("group", { name: /^Modifier la ligne/ })).toHaveCount(0);
  await expect(row("Cérémonie laïque sous les tilleuls")).toContainText("Modifiée");
  await expect(row("Cérémonie laïque sous les tilleuls")).toContainText("Note interne : Alliances chez le témoin");

  // Une séquence ajoutée attend avec les autres ; la barre dit le nombre de lignes, rien n'est écrit.
  await page.getByRole("button", { name: "Ajouter une séquence" }).click();
  const added = page.getByRole("group", { name: "Modifier la ligne Nouvelle séquence" });
  await added.getByLabel("Début", { exact: true }).fill("18:45");
  await added.getByLabel("Durée (min)").fill("30");
  await expect(added.getByLabel("Fin", { exact: true })).toHaveValue("19:15");
  await added.getByLabel("Séquence", { exact: true }).fill("Photos de groupe");
  await added.getByRole("button", { name: "Fermer la ligne" }).click();
  await expect(page.getByText("3 lignes modifiées, pas encore enregistrées.")).toBeVisible();
  // Dans la carte du programme, un seul bouton principal : celui de la barre.
  await expect(page.getByRole("button", { name: "Enregistrer le programme" })).toHaveClass(/button-primary/);
  expect((await measureScreen(page)).primary.filter((label) => label !== "Préparer le devis")).toEqual(["Enregistrer le programme"]);
  expect(await saved()).toEqual(before);

  // « Annuler les modifications » rend le programme enregistré.
  await page.getByRole("button", { name: "Annuler les modifications" }).click();
  await expect(page.getByText(/pas encore enregistrée/)).toHaveCount(0);
  await expect(row("Cérémonie laïque")).toHaveCount(1);
  await expect(row("Photos de groupe")).toHaveCount(0);
  expect(await saved()).toEqual(before);

  // Une ligne incomplète n'est pas envoyée : elle s'ouvre, avec ce qui manque.
  await page.getByRole("button", { name: "Ajouter une séquence" }).click();
  await page.getByRole("group", { name: "Modifier la ligne Nouvelle séquence" }).getByLabel("Séquence", { exact: true }).fill("Photos de groupe");
  await page.getByRole("button", { name: "Enregistrer le programme" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Donnez une heure de début et un nom à cette séquence." })).toBeVisible();
  expect(await saved()).toEqual(before);
  await page.getByRole("group", { name: "Modifier la ligne Nouvelle séquence" }).getByLabel("Début", { exact: true }).fill("18:45");

  // Deux lignes en un envoi : une modifiée, une ajoutée.
  await page.getByRole("button", { name: "Modifier la ligne Cérémonie laïque" }).click();
  await page.getByRole("group", { name: "Modifier la ligne Cérémonie laïque" }).getByLabel("Note interne").fill("Alliances chez le témoin");
  await expect(page.getByText("2 lignes modifiées, pas encore enregistrées.")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer le programme" }).click();
  await expect(page.getByText("Programme enregistré : 2 lignes.")).toBeVisible();
  await expect(row("Photos de groupe").locator(".program-start")).toHaveText("18:45");
  const program = await getEventProgram(setup.organizationId, setup.eventId);
  expect(program.items).toHaveLength(SEQUENCES.length + 1);
  expect(program.items.find((item) => item.label === "Cérémonie laïque")).toMatchObject({ internalNote: "Alliances chez le témoin" });
  expect(program.items.find((item) => item.label === "Photos de groupe")).toMatchObject({ startTime: "18:45" });

  await expectCommonCriteria(page);
  await expectNoAxeViolation(page);
});

async function weddingWithBudget() {
  const setup = await wedding();
  const defaults = await listDefaultVendorSlots(setup.organizationId);
  const share = [2100, 3100, 800, 900, 600, 1000, 200, 800, 500];
  const model = await createAllocationModel({ organizationId: setup.organizationId, name: "Classique", items: defaults.map((slot, index) => ({ defaultVendorSlotId: slot.id, percentageBasisPoints: share[index]! })) });
  await simulateEventBudget({ organizationId: setup.organizationId, eventId: setup.eventId, totalAmountCents: 3500000, guestCount: 120, allocationModelId: model.id });
  // Neuf lignes, comme le budget mesuré au relevé : une par catégorie, estimée.
  const slots = await listEventVendorSlots(setup.organizationId, setup.eventId);
  for (const [index, slot] of slots.entries()) {
    await updateBudgetLine({ organizationId: setup.organizationId, eventId: setup.eventId, eventVendorSlotId: slot.id, field: "estimated", amountCents: share[index]! * 350, changedByUserId: setup.userId });
  }
  const caterer = slots.find((slot) => slot.label === "Traiteur")!;
  await addVendorCandidate({ organizationId: setup.organizationId, eventId: setup.eventId, vendorSlotId: caterer.id, vendorName: "Maison Haddad" });
  return setup;
}

test("UX-13, UX-05 — budget : répartition et lignes en tableaux éditables, un seul « Enregistrer » par liste", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await weddingWithBudget();
  const lines = async () => (await listBudgetLines(setup.organizationId, setup.eventId)).lines.map((line) => `${line.label} ${line.committedAmountCents ?? "—"}`);
  const before = await lines();
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/budget/${setup.eventId}`);
  await page.waitForLoadState("networkidle");

  // Au repos : critères communs ; huit écrans au plus en 375 px pour neuf lignes.
  const measures = await expectCommonCriteria(page);
  if (isPhone(page)) expect(measures.screens).toBeLessThanOrEqual(8);
  await expectNoAxeViolation(page);

  // Les lignes forment un tableau ; « Modifier » ouvre la ligne en place, une seule à la fois.
  const table = page.getByRole("table", { name: "Estimé, réel, engagé, payé" });
  const editor = (label: string) => page.getByRole("region", { name: `Ligne « ${label} » : montants, prestataire, documents et échéances` });
  await table.getByRole("button", { name: "Modifier « Traiteur »" }).click();
  await editor("Traiteur").getByLabel("Libellé — Traiteur").fill("Dîner, 120 couverts");
  await editor("Traiteur").getByRole("combobox", { name: "Prestataire — Traiteur" }).selectOption({ label: "Maison Haddad" });
  await editor("Traiteur").getByLabel("Engagé — Traiteur").fill("11 000");
  await expectNoAxeViolation(page);
  await table.getByRole("button", { name: "Modifier « Musique »" }).click();
  await expect(editor("Traiteur")).toHaveCount(0);
  await editor("Musique").getByLabel("Engagé — Musique").fill("2 100,50");
  await editor("Musique").getByRole("button", { name: "Fermer la ligne", exact: true }).click();
  await expect(page.getByRole("region", { name: /^Ligne « / })).toHaveCount(0);

  // La barre dit le nombre de lignes ; rien n'est écrit avant « Enregistrer le budget ».
  await expect(page.getByText("2 lignes modifiées, pas encore enregistrées.")).toBeVisible();
  expect((await measureScreen(page)).primary).toEqual(["Enregistrer le budget"]);
  await expect(page.getByRole("button", { name: "Enregistrer le budget" })).toHaveClass(/button-primary/);
  expect(await lines()).toEqual(before);
  await page.getByRole("button", { name: "Annuler les modifications" }).click();
  await expect(page.getByText(/pas encore enregistrée/)).toHaveCount(0);
  expect(await lines()).toEqual(before);

  // Les deux lignes partent ensemble ; les cinq montants et l'écart se recalculent comme avant.
  await table.getByRole("button", { name: "Modifier « Traiteur »" }).click();
  await editor("Traiteur").getByLabel("Libellé — Traiteur").fill("Dîner, 120 couverts");
  await editor("Traiteur").getByRole("combobox", { name: "Prestataire — Traiteur" }).selectOption({ label: "Maison Haddad" });
  await editor("Traiteur").getByLabel("Engagé — Traiteur").fill("11 000");
  await table.getByRole("button", { name: "Modifier « Musique »" }).click();
  await editor("Musique").getByLabel("Engagé — Musique").fill("2 100,50");
  await page.getByRole("button", { name: "Enregistrer le budget" }).click();
  await expect(page.getByText("Budget enregistré : 2 lignes.")).toBeVisible();
  const dinner = table.getByRole("row").filter({ hasText: "Modifier « Dîner, 120 couverts »" });
  await expect(dinner).toContainText("Maison Haddad");
  await expect(dinner).toContainText("11 000,00 €");
  await expect(dinner).toContainText("Dépassement de 150,00 €");
  const view = await listBudgetLines(setup.organizationId, setup.eventId);
  expect(view.lines.find((line) => line.label === "Dîner, 120 couverts")).toMatchObject({ estimatedAmountCents: 1085000, committedAmountCents: 1100000, remainingAmountCents: 1100000, varianceCents: 15000 });
  expect(view.lines.find((line) => line.label === "Musique")).toMatchObject({ committedAmountCents: 210050 });

  // La répartition de la simulation, repliée une fois les lignes posées : un tableau, plus de « Ajuster ».
  await page.getByText("Simulation et répartition par poste").click();
  const allocation = page.getByRole("table", { name: "Répartition par poste" });
  await expect(allocation.getByRole("row")).toHaveCount(SLOTS.length + 1);
  await expect(page.getByRole("button", { name: "Ajuster" })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("listitem").filter({ has: page.locator("form") })).toHaveCount(0);
  await allocation.getByLabel("Photographe", { exact: true }).fill("3 000");
  await allocation.getByLabel("Papeterie", { exact: true }).fill("500");
  await expect(page.getByText("2 postes modifiés, pas encore enregistrés.")).toBeVisible();
  expect((await getEventBudget(setup.organizationId, setup.eventId))!.allocatedCents).toBe(3500000);
  await page.getByRole("button", { name: "Enregistrer la répartition" }).click();
  await expect(page.getByText("Répartition enregistrée : 2 postes.")).toBeVisible();
  expect((await getEventBudget(setup.organizationId, setup.eventId))!.allocatedCents).toBe(3500000 - 280000 - 70000 + 300000 + 50000);

  await expectCommonCriteria(page);
  await expectNoAxeViolation(page);
});

test("UX-05 — budget de plus de douze lignes : sur téléphone, les catégories se replient, leurs totaux en vue", async ({ page }) => {
  const setup = await weddingWithBudget();
  const slots = await listEventVendorSlots(setup.organizationId, setup.eventId);
  for (const slot of slots.slice(0, 5)) await addBudgetLine({ organizationId: setup.organizationId, eventId: setup.eventId, eventVendorSlotId: slot.id, label: `${slot.label}, complément` });
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/budget/${setup.eventId}`);
  await page.waitForLoadState("networkidle");

  const table = page.getByRole("table", { name: "Estimé, réel, engagé, payé" });
  const caterer = table.getByRole("rowgroup", { name: "Traiteur" });
  const edit = table.getByRole("button", { name: "Modifier « Traiteur, complément »" });
  await expect(caterer.getByRole("row").first()).toContainText("10 850,00 €");
  if (isPhone(page)) {
    // Quatorze lignes : la catégorie est repliée, ses totaux restent ; « Voir les 2 lignes » la déplie.
    await expect(edit).toBeHidden();
    await expectCommonCriteria(page);
    await caterer.getByRole("button", { name: /^Voir les 2 lignes/ }).click();
    await expect(edit).toBeVisible();
    // Une ligne ouverte ou modifiée garde sa catégorie dépliée.
    await edit.click();
    await page.getByRole("region", { name: /^Ligne « Traiteur, complément »/ }).getByLabel("Estimé — Traiteur, complément").fill("300");
    await caterer.getByRole("button", { name: /^Masquer les 2 lignes/ }).click();
    await expect(edit).toBeVisible();
    await expect(page.getByText("1 ligne modifiée, pas encore enregistrée.")).toBeVisible();
  } else {
    // En taille ordinateur, rien ne se replie.
    await expect(edit).toBeVisible();
    await expect(table.getByRole("button", { name: /^Voir les/ })).toHaveCount(0);
  }
  await expectNoAxeViolation(page);
});

test("UX-12 — mariés : coordonnées en grille, trois écrans au plus en taille ordinateur", async ({ page }) => {
  const setup = await wedding();
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/events/${setup.eventId}`);
  await openEventTab(page, "Mariés");

  const lea = page.getByRole("form", { name: /Léa Martin/ });
  const box = async (label: string) => (await lea.getByLabel(label, { exact: true }).boundingBox())!;
  if (!isPhone(page)) {
    // E-mail et téléphone côte à côte ; code postal et ville sur une même ligne, sous l'adresse.
    expect((await box("E-mail")).y).toBe((await box("Téléphone")).y);
    expect((await box("Téléphone")).x).toBeGreaterThan((await box("E-mail")).x);
    expect((await box("Adresse")).y).toBeGreaterThan((await box("E-mail")).y);
    expect((await box("Code postal")).y).toBe((await box("Ville")).y);
    expect((await box("Code postal")).y).toBeGreaterThan((await box("Adresse")).y);
    expect((await box("Code postal")).width).toBeLessThanOrEqual(260);
    // Les deux personnes côte à côte.
    const maxime = (await page.getByRole("form", { name: /Maxime Dubois/ }).boundingBox())!;
    expect(maxime.x).toBeGreaterThan((await lea.boundingBox())!.x);
  }
  const measures = await expectCommonCriteria(page);
  if (!isPhone(page)) expect(measures.screens).toBeLessThanOrEqual(3);
  await expectNoAxeViolation(page);

  // Les coordonnées s'enregistrent comme avant.
  await lea.getByLabel("Téléphone", { exact: true }).fill("06 12 34 56 78");
  await lea.getByLabel("Code postal", { exact: true }).fill("24000");
  await lea.getByLabel("Ville", { exact: true }).fill("Périgueux");
  await lea.getByRole("button", { name: "Enregistrer les coordonnées de Léa Martin" }).click();
  await expect(lea.getByText("Coordonnées enregistrées.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("form", { name: /Léa Martin/ }).getByLabel("Ville", { exact: true })).toHaveValue("Périgueux");
});

test("UX-05, UX-07 — rétroplanning : cibles de 44 px ; cocher une tâche garde son « Annuler »", async ({ page }) => {
  const setup = await wedding();
  for (const [label, dueDate] of [
    ["Signer le contrat du lieu", "2026-12-15"],
    ["Choisir le traiteur", "2027-01-20"],
    ["Envoyer les faire-part", "2027-02-10"],
  ] as const) {
    await addEventTask(setup.organizationId, setup.eventId, { label, dueDate, responsible: "planner" });
  }
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/events/${setup.eventId}`);
  await openEventTab(page, "Rétroplanning");

  const check = page.getByRole("button", { name: "Marquer « Choisir le traiteur » comme faite" });
  const box = (await check.boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  await expectCommonCriteria(page);
  await expectNoAxeViolation(page);

  // La case garde son comportement : cochée tout de suite, « Annuler » la rétablit (UX-07).
  await check.click();
  await expect(page.getByRole("button", { name: "Marquer « Choisir le traiteur » comme à faire" })).toBeVisible();
  await expect.poll(async () => (await listEventTasks(setup.organizationId, setup.eventId)).find((task) => task.label === "Choisir le traiteur")?.done).toBe(true);
  const undo = page.getByRole("status").filter({ hasText: "Tâche « Choisir le traiteur » faite." });
  await undo.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("button", { name: "Marquer « Choisir le traiteur » comme faite" })).toBeVisible();
  await expect.poll(async () => (await listEventTasks(setup.organizationId, setup.eventId)).find((task) => task.label === "Choisir le traiteur")?.done).toBe(false);
  await expectCommonCriteria(page);
});
