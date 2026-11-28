// Lot 70d (CHR-02, CHR-03, CHR-04, CHR-10, PAR-10, UX-03, UX-07, UX-08, UX-12, UX-14, UX-15, NFR-02 ; C-14,
// C-31, C-33, C-37, C-40, C-55, D1, M2 ; page 2 des maquettes du lot 68) — l'écran « Tâches », à 1 440 et
// 375 px (projets « desktop » et « mobile-375 »), axe-core sur chaque état vide, la barre de sélection et
// le panneau des filtres. Un `test` par critère du § 5.4 de la spécification, plus les abus sur les filtres
// de l'adresse, la mesure de la première tâche à 375 px et celle de NFR-02 (500 tâches).
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser, setUserNames } from "@symbola/auth";
import { withActor } from "@symbola/db/actor";
import { appDatabase, createAppConnection } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import { addEventTask, addStandaloneTask, changeEventStatus, createProspect, createProspectSource, listTasks, updateEventTask } from "../modules/events/service";
import { createTakeover } from "../modules/hub/service";
import { feedback, readyOrganization, signIn } from "./helpers";
import { reportMeasure } from "./mesure";

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function expectNoAxeViolation(page: Page, include?: string) {
  const builder = new AxeBuilder({ page });
  if (include) builder.include(include);
  const result = await builder.analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 640;

function line(page: Page, label: string) {
  return page.locator(".task-line").filter({ has: page.getByRole("link", { name: label, exact: true }) });
}

// Un filtre, comme le ferait la planner : la barre à l'ordinateur, le panneau « Filtres » sur téléphone.
async function setFilter(page: Page, label: string, option: string) {
  if (isPhone(page)) {
    await page.getByRole("button", { name: /^Filtres/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filtres" });
    await sheet.getByRole("combobox", { name: label, exact: true }).selectOption({ label: option });
    await expect(page).toHaveURL(/\/taches\?/);
    await sheet.getByRole("button", { name: /^(Voir|Aucune tâche à voir)/ }).click();
    await expect(sheet).toBeHidden();
  } else {
    const before = page.url();
    await page.getByRole("form", { name: "Filtrer les tâches" }).getByRole("combobox", { name: label, exact: true }).selectOption({ label: option });
    await expect.poll(() => page.url()).not.toBe(before);
  }
}

async function groupBy(page: Page, option: string) {
  if (isPhone(page)) {
    await page.getByRole("button", { name: /^Filtres/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filtres" });
    await sheet.getByRole("combobox", { name: "Grouper par" }).selectOption({ label: option });
    await page.waitForURL(/grouper=/);
    await sheet.getByRole("button", { name: /^(Voir|Aucune tâche à voir)/ }).click();
  } else {
    await page.locator(".task-board-options").getByRole("combobox", { name: "Grouper par" }).selectOption({ label: option });
    await page.waitForURL(/grouper=/);
  }
}

// L'agence de Camille (titulaire) et Bastien : deux mariages, cinq tâches à faire (deux en retard), une
// tâche faite et une tâche hors évènement qui se répète.
async function agence() {
  const email = `planner-70d-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const bastien = await createUser(db, { organizationId: organization.id, email: `bastien-${randomUUID()}@symbola.test`, role: "member" });
    await setUserNames(db, owner.id, { firstName: "Camille", lastName: "Roux" });
    await setUserNames(db, bastien.id, { firstName: "Bastien", lastName: "Leroy" });
    const source = await createProspectSource(organization.id, "Salon");
    const today = parisToday();
    const as = <T>(fn: () => Promise<T>) => withActor({ kind: "member", id: owner.id }, fn);
    const wedding = async (first: string, second: string, date: string) => {
      const event = await createProspect({ organizationId: organization.id, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: first, lastName: "Morel" }, { firstName: second, lastName: "Petit" }], eventDate: date });
      await changeEventStatus({ organizationId: organization.id, eventId: event.id, changedByUserId: owner.id, toStatus: "confirmed" });
      return event.id;
    };
    const lea = await wedding("Léa", "Maxime", "2027-06-12");
    const ines = await wedding("Inès", "Paul", "2027-09-04");
    const add = (eventId: string, label: string, days: number, responsible: "planner" | "clients", assigneeUserId?: string) =>
      as(() => addEventTask(organization.id, eventId, { label, dueDate: addDays(today, days), responsible, ...(assigneeUserId ? { assigneeUserId } : {}) }));
    const car = await add(lea, "Confirmer la voiture des mariés", -4, "planner", bastien.id);
    const contract = await add(lea, "Faire signer le contrat du photographe", -5, "planner", owner.id);
    const florist = await add(lea, "Choisir le fleuriste", 4, "clients");
    const tasting = await add(ines, "Organiser la dégustation finale", 5, "planner", owner.id);
    const seating = await add(ines, "Envoyer le plan de table au traiteur", 40, "planner", bastien.id);
    const brunch = await add(lea, "Réserver la salle du brunch", -1, "planner", owner.id);
    await as(() => updateEventTask({ organizationId: organization.id, taskId: brunch.id, done: true }));
    const vat = await as(() => addStandaloneTask(organization.id, { label: "Déclaration de TVA du trimestre", dueDate: addDays(today, 6), recurrence: "quarterly" }));
    return { email, ownerId: owner.id, bastienId: bastien.id, organizationId: organization.id, lea, ines, car, contract, florist, tasting, seating, brunch, vat, today };
  } finally {
    await sql.end();
  }
}

async function emptyAgency() {
  const email = `planner-70d-vide-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    return { email, ownerId: owner.id, organizationId: organization.id };
  } finally {
    await sql.end();
  }
}

test.describe("Lot 70d — l'écran « Tâches »", () => {
  test("CHR-03 crit. 1 — « Nouvelle tâche » est en haut de l'écran et ouvre le panneau en création", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await agence();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/taches");
    await expect(page.getByRole("heading", { level: 1, name: "Tâches" })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Les tâches de tous vos évènements et de l'agence");
    const create = page.getByRole("link", { name: "Nouvelle tâche", exact: true });
    await expect(create).toHaveCount(1);
    await expect(create).toBeInViewport();
    // Seule action principale de l'écran ; l'ancien bouton « Réglages » et la section du bas ont disparu.
    await expect(page.locator(".button-link-primary:visible, button.button-primary:visible")).toHaveCount(1);
    await expect(page.locator("#hors-evenement")).toHaveCount(0);
    await create.click();
    const panel = page.getByRole("dialog", { name: "Nouvelle tâche" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button", { name: "Créer la tâche" })).toBeVisible();
    await expect(panel.getByLabel("Évènement")).toHaveValue("");
    // « + Créer › Tâche » (lot 70e) ouvre le même panneau, et depuis une fiche, l'évènement est choisi.
    await page.goto(`/events/${setup.lea}`);
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await page.getByRole("link", { name: /^Tâche pour Léa & Maxime/ }).click();
    await expect(page).toHaveURL(new RegExp(`/taches\\?nouvelle=1&evenement=${setup.lea}`));
    await expect(page.getByRole("dialog", { name: "Nouvelle tâche" }).getByLabel("Évènement")).toHaveValue(setup.lea);
  });

  test("CHR-03 crit. 2 — chaque filtre a un nom ; une pastille par filtre posé ; « Effacer les filtres » ; gardés au calendrier et au retour d'une fiche", async ({ page }) => {
    test.setTimeout(150_000);
    const setup = await agence();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/taches");
    if (isPhone(page)) {
      await page.getByRole("button", { name: /^Filtres/ }).click();
      const sheet = page.getByRole("dialog", { name: "Filtres" });
      for (const name of ["Évènement", "Qui s'en charge", "Période", "Catégorie", "État", "Grouper par"]) await expect(sheet.getByRole("combobox", { name: name, exact: true })).toBeVisible();
      await expect(sheet.getByRole("link", { name: "Mes tâches" })).toBeVisible();
      await expect(sheet.getByRole("link", { name: "En retard" })).toBeVisible();
      await expect(sheet.getByRole("link", { name: "Cette semaine" })).toBeVisible();
      // Le seul bouton plein du panneau : « Voir les N tâches ».
      await expect(sheet.locator(".button-primary")).toHaveText("Voir les 6 tâches");
      await expectNoAxeViolation(page, ".task-filters-sheet");
      await sheet.getByRole("button", { name: "Voir les 6 tâches" }).click();
    } else {
      const bar = page.getByRole("form", { name: "Filtrer les tâches" });
      for (const name of ["Évènement", "Qui s'en charge", "Période", "Catégorie", "État"]) await expect(bar.getByRole("combobox", { name: name, exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Effacer les filtres" })).toHaveCount(0);
    }
    await setFilter(page, "Qui s'en charge", "Bastien Leroy");
    await expect(page).toHaveURL(new RegExp(`qui=${setup.bastienId}`));
    // Un identifiant dans l'adresse, jamais un nom.
    expect(page.url()).not.toMatch(/Bastien/i);
    await expect(page.locator(".task-lines .task-line")).toHaveCount(2);
    await setFilter(page, "Période", "En retard");
    await expect(page.locator(".task-lines .task-line")).toHaveCount(1);
    if (isPhone(page)) {
      await expect(page.getByRole("button", { name: /^Filtres/ })).toContainText("2");
    } else {
      const chips = page.getByRole("list", { name: "Filtres posés" });
      await expect(chips.getByRole("link", { name: "Retirer le filtre « Bastien Leroy »" })).toBeVisible();
      await expect(chips.getByRole("link", { name: "Effacer les filtres" })).toBeVisible();
      await chips.getByRole("link", { name: "Retirer le filtre « Bastien Leroy »" }).click();
      await expect(page).toHaveURL(/\/taches\?periode=retard$/);
      await expect(page.locator(".task-lines .task-line")).toHaveCount(2);
      await expect(page.getByRole("form", { name: "Filtrer les tâches" }).getByRole("combobox", { name: "Qui s'en charge", exact: true })).toHaveValue("");
    }
    // Au calendrier, les filtres restent ; au retour, aussi.
    const filtered = new URL(page.url()).search;
    await page.goto(`/taches${filtered}${filtered ? "&" : "?"}affichage=calendrier`);
    if (isPhone(page)) await page.getByRole("button", { name: /^Filtres/ }).click();
    await expect(page.getByRole("link", { name: "Liste" }).filter({ visible: true })).toHaveAttribute("href", `/taches${filtered}`);
    // Au retour d'une fiche : la même vue.
    await page.goto(`/taches${filtered}`);
    await line(page, "Confirmer la voiture des mariés").getByRole("button", { name: /^Autres actions/ }).click();
    await page.getByRole("menuitem", { name: /^Ouvrir l'évènement/ }).click();
    await expect(page).toHaveURL(/\/events\//);
    await page.goBack();
    await expect(page).toHaveURL(`/taches${filtered}`);
    await expect(line(page, "Confirmer la voiture des mariés")).toBeVisible();
    await expectNoAxeViolation(page);
  });

  test("CHR-03 crit. 3 — le décompte dit combien la liste montre sur combien, et se recoupe (à faire + faites = total)", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await agence();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/taches");
    const count = page.locator(".task-count");
    await expect(count).toHaveText("6 tâches à faire sur 7 · 2 en retard");
    await page.goto(`/taches?qui=${setup.bastienId}`);
    await expect(count).toHaveText("2 tâches sur 6 à faire · filtrées");
    await page.goto("/taches?etat=faites");
    await expect(count).toHaveText("1 tâche faite sur 7 · les plus récentes en tête");
    const viewer = { userId: setup.ownerId, role: "owner" as const, allPlannersSeeAll: true };
    const [todo, done] = await Promise.all([listTasks({ organizationId: setup.organizationId, today: setup.today, viewer }), listTasks({ organizationId: setup.organizationId, today: setup.today, viewer, filters: { state: "done" } })]);
    expect(todo.filtered + done.filtered).toBe(todo.total);
  });

  test("CHR-03 crit. 4, PAR-10 — « En retard » groupé par « Qui s'en charge » : les retards de chacun, avec son compte", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await agence();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/taches");
    await setFilter(page, "Période", "En retard");
    await groupBy(page, "Qui s'en charge");
    await expect(page).toHaveURL(/periode=retard/);
    await expect(page).toHaveURL(/grouper=qui/);
    await expect(page.locator(".task-count")).toHaveText("2 tâches en retard sur 6 à faire · 2 personnes");
    const headings = page.locator(".task-lines-month");
    await expect(headings).toHaveCount(2);
    await expect(headings.filter({ hasText: "Bastien" })).toContainText("1 en retard · 2 à faire");
    await expect(headings.filter({ hasText: "Vous" })).toContainText("1 en retard · 3 à faire");
    await expectNoAxeViolation(page);
  });

  test("CHR-02 crit. 5 — « Mes tâches » en un geste", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await agence();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/taches");
    const mine = page.locator(isPhone(page) ? ".task-filters-phone" : ".task-filters-desktop").getByRole("link", { name: "Mes tâches" });
    await expect(mine).not.toHaveAttribute("aria-current");
    await mine.click();
    await expect(page).toHaveURL(/\/taches\?qui=moi$/);
    await expect(page.locator(".task-lines .task-line")).toHaveCount(3);
    await expect(line(page, "Confirmer la voiture des mariés")).toHaveCount(0);
    await expect(page.locator(isPhone(page) ? ".task-filters-phone" : ".task-filters-desktop").getByRole("link", { name: "Mes tâches" })).toHaveAttribute("aria-current", "true");
  });

  test("UX-07, UX-15 crit. 6 — en mode sélection, cocher ne déplace aucune ligne ; la barre reste en place ; chaque action dit combien et s'annule", async ({ page }) => {
    test.setTimeout(150_000);
    const setup = await agence();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/taches");
    await page.getByRole("button", { name: "Sélectionner" }).click();
    const bar = page.getByRole("region", { name: "Actions sur les tâches sélectionnées" });
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("Cochez les tâches à changer");
    await expect(page.getByRole("button", { name: "Tout sélectionner (6)" })).toBeVisible();
    const positions = async () => page.locator(".task-lines .task-line").evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
    const barBox = async () => (await bar.boundingBox())!;
    const before = await positions();
    const barBefore = await barBox();
    await page.getByRole("checkbox", { name: "Choisir « Confirmer la voiture des mariés »" }).check();
    await page.getByRole("checkbox", { name: "Choisir « Faire signer le contrat du photographe »" }).check();
    expect(await positions()).toEqual(before);
    const barAfter = await barBox();
    expect(Math.round(barAfter.y)).toBe(Math.round(barBefore.y));
    await expect(bar).toContainText("2 tâches sélectionnées");
    // Aussi nette à l'ordinateur que sur téléphone : bord d'encre de 2 px, ombre.
    const style = await bar.evaluate((element) => ({ border: getComputedStyle(element).borderTopWidth, shadow: getComputedStyle(element).boxShadow }));
    expect(style.border).toBe("2px");
    expect(style.shadow).not.toBe("none");
    await expectNoAxeViolation(page, ".task-bulk");

    // « Changer la date de 2 tâches » : décaler de 7 jours ; « Annuler » rend les dates.
    await bar.getByRole("button", { name: /^(Changer la date…|Date)$/ }).click();
    const dates = page.getByRole("dialog", { name: "Changer la date de 2 tâches" });
    await expect(dates.getByRole("button", { name: "Appliquer à 2 tâches" })).toBeVisible();
    await expectNoAxeViolation(page, ".task-bulk-panel:popover-open");
    await dates.getByRole("button", { name: "Appliquer à 2 tâches" }).click();
    const message = feedback(page).filter({ hasText: "2 tâches décalées de 7 jours" });
    await expect(message).toBeVisible();
    await expect(line(page, "Confirmer la voiture des mariés")).not.toContainText("En retard");
    await message.getByRole("button", { name: "Annuler" }).click();
    await expect(feedback(page).filter({ hasText: "C'est rétabli pour 2 tâches." })).toBeVisible();
    await expect(line(page, "Confirmer la voiture des mariés")).toContainText("En retard de 4 jours");

    // « Fait » en lot : il dit combien, s'annule.
    await page.getByRole("button", { name: "Sélectionner" }).click();
    await page.getByRole("checkbox", { name: "Choisir « Choisir le fleuriste »" }).check();
    await page.getByRole("checkbox", { name: "Choisir « Organiser la dégustation finale »" }).check();
    await bar.getByRole("button", { name: "Fait", exact: true }).click();
    const done = feedback(page).filter({ hasText: "2 tâches faites" });
    await expect(done).toBeVisible();
    await expect(line(page, "Choisir le fleuriste")).toHaveCount(0);
    await done.getByRole("button", { name: "Annuler" }).click();
    await expect(line(page, "Choisir le fleuriste")).toBeVisible();

    // « Confier à… » : vous, Bastien, les clients ; un prestataire seulement pour un seul évènement.
    await page.getByRole("button", { name: "Sélectionner" }).click();
    await page.getByRole("checkbox", { name: "Choisir « Organiser la dégustation finale »" }).check();
    await page.getByRole("checkbox", { name: "Choisir « Choisir le fleuriste »" }).check();
    await bar.getByRole("button", { name: /^(Confier à…|Confier)$/ }).click();
    const assign = page.getByRole("dialog", { name: "Confier 2 tâches à…" });
    await expect(assign).toContainText("Un prestataire : choisissez des tâches d'un seul évènement.");
    await assign.getByRole("button", { name: /Bastien Leroy/ }).click();
    const assigned = feedback(page).filter({ hasText: "2 tâches confiées" });
    await expect(assigned).toBeVisible();
    await expect(line(page, "Choisir le fleuriste")).toContainText("Bastien");
    await assigned.getByRole("button", { name: "Annuler" }).click();
    await expect(line(page, "Choisir le fleuriste")).toContainText("Les mariés");

    // Échap quitte le mode sélection.
    await page.getByRole("button", { name: "Sélectionner" }).click();
    await page.keyboard.press("Escape");
    await expect(bar).toHaveCount(0);
  });

  test("UX-08 crit. 7 — espace neuf : « Pas encore de tâche », une seule action principale (« Nouvel évènement »), aucune pastille de retard", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await emptyAgency();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/taches");
    await expect(page.getByRole("heading", { name: "Pas encore de tâche" })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Déclaration de TVA");
    await expect(page.getByRole("main").locator(".button-link-primary")).toHaveText(["Nouvel évènement"]);
    await expect(page.getByRole("main").getByRole("link", { name: "Nouvelle tâche hors évènement" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Lire l'aide" })).toBeVisible();
    await expect(page.getByText(/en retard/)).toHaveCount(0);
    await expectNoAxeViolation(page);
    await page.getByRole("link", { name: "Nouvelle tâche hors évènement" }).click();
    await expect(page.getByRole("dialog", { name: "Nouvelle tâche" }).getByLabel("Évènement")).toHaveValue("");
  });

  test("UX-08 crit. 7 — tout est fait ; aucun résultat ; le mariage repris sans tâches est signalé", async ({ page }) => {
    test.setTimeout(150_000);
    const setup = await agence();
    await signIn(page, setup.email, /\/$/);
    // Aucun résultat : le titre dit combien de filtres, « Effacer les filtres » et « Retirer « … » ».
    await page.goto(`/taches?evenement=${setup.ines}&qui=${setup.bastienId}&periode=retard`);
    await expect(page.getByRole("heading", { name: "Aucune tâche ne répond à ces trois filtres" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Retirer « En retard »" })).toHaveAttribute("href", `/taches?evenement=${setup.ines}&qui=${setup.bastienId}`);
    await expectNoAxeViolation(page);
    await page.getByRole("main").getByRole("link", { name: "Effacer les filtres" }).last().click();
    await expect(page).toHaveURL(/\/taches$/);

    // Le mariage repris : « À vérifier », deux suites ; le décompte le dit.
    // Lot 71f : l'origine posée par la reprise (lot 71a), et la date de sa reprise, le 24 novembre.
    const hugo = await createProspect({ organizationId: setup.organizationId, createdByUserId: setup.ownerId, prospectSourceId: null, clients: [{ firstName: "Léa", lastName: "Durand" }, { firstName: "Hugo", lastName: "Martin" }], eventDate: "2027-07-03", takeover: true });
    const hugoId = hugo.id;
    await createTakeover(appDatabase(), { organizationId: setup.organizationId, userId: setup.ownerId, eventId: hugo.id, now: new Date("2026-11-24T10:00:00Z") });
    await page.reload();
    const banner = page.getByRole("region", { name: "À vérifier : Léa & Hugo" });
    await expect(banner).toContainText("À vérifier : « Léa & Hugo », repris le 24 nov., n'a pas encore de tâches.");
    // Lot 71b (HUB-14) : la ligne 5 de la page de reprise du mariage.
    await expect(banner.getByRole("link", { name: "Reprendre la liste de votre tableur" })).toHaveAttribute("href", `/reprise?evenement=${hugoId}&ligne=tasks`);
    await expect(banner.getByRole("link", { name: "Partir d'un modèle Symbola" })).toHaveAttribute("href", `/events/${hugoId}?onglet=taches`);
    await expect(page.locator(".task-count")).toContainText("1 évènement sans tâches");
    await expectNoAxeViolation(page);

    // Tout est fait : rien à faire, sans filtre.
    const viewer = { userId: setup.ownerId, role: "owner" as const, allPlannersSeeAll: true };
    const open = await listTasks({ organizationId: setup.organizationId, today: setup.today, viewer });
    for (const task of open.tasks) await withActor({ kind: "member", id: setup.ownerId }, () => updateEventTask({ organizationId: setup.organizationId, taskId: task.id, done: true }));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tout est fait" })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Aucune tâche à faire");
    await expectNoAxeViolation(page);
    await page.getByRole("link", { name: "Voir les tâches faites" }).click();
    await expect(page).toHaveURL(/\/taches\?etat=faites$/);
  });

  test("CHR-04, D1 crit. 8 — une tâche cochée par erreur se retrouve en deux gestes, en tête des faites, et « Rouvrir » la remet à faire", async ({ page }) => {
    test.setTimeout(150_000);
    const setup = await agence();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/taches");
    await line(page, "Organiser la dégustation finale").getByRole("button", { name: /^Fait/ }).click();
    await expect(feedback(page).filter({ hasText: "Tâche faite : Organiser la dégustation finale" })).toBeVisible();
    // Après dix secondes, « Annuler » n'est plus là : « État : Faites ».
    await setFilter(page, "État", "Faites");
    await expect(page).toHaveURL(/etat=faites/);
    const first = page.locator(".task-lines .task-line").first();
    await expect(first).toContainText("Organiser la dégustation finale");
    await expect(page.locator(".task-lines-month").first()).toContainText("Aujourd'hui");
    if (isPhone(page)) await expect(first).toContainText(/Cochée à \d+ h \d+ par vous/);
    else {
      await expect(page.locator(".task-lines-head")).toContainText("Faite le");
      await expect(page.locator(".task-lines-head")).toContainText("Cochée par");
      await expect(first).toContainText("Échéance :");
      await expect(first).toContainText("Vous");
    }
    // Gris, sans barré.
    expect(await first.locator(".task-title-link").evaluate((link) => getComputedStyle(link).textDecorationLine)).not.toContain("line-through");
    await expectNoAxeViolation(page, ".task-lines");
    await first.getByRole("button", { name: /^Rouvrir/ }).click();
    await expect(line(page, "Organiser la dégustation finale")).toHaveCount(0);
    await page.goto("/taches");
    await expect(line(page, "Organiser la dégustation finale")).toBeVisible();
    // Depuis l'accueil, « Les revoir » mène à la même vue.
    await line(page, "Organiser la dégustation finale").getByRole("button", { name: /^Fait/ }).click();
    await expect(feedback(page).filter({ hasText: "Tâche faite" })).toBeVisible();
    await page.goto("/");
    await page.getByRole("link", { name: "Les revoir" }).click();
    await expect(page).toHaveURL(/\/taches\?etat=faites/);
    await expect(page.locator(".task-lines .task-line").first()).toContainText("Organiser la dégustation finale");
  });

  test("CHR-10 crit. 9 — une tâche hors évènement s'affiche, se filtre « Hors évènement » et se coche comme une autre ; la suivante naît", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await agence();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/taches");
    await expect(line(page, "Déclaration de TVA du trimestre")).toContainText("Hors évènement");
    await setFilter(page, "Évènement", "Hors évènement");
    await expect(page).toHaveURL(/evenement=hors/);
    await expect(page.locator(".task-lines .task-line")).toHaveCount(1);
    await line(page, "Déclaration de TVA du trimestre").getByRole("button", { name: /^Fait/ }).click();
    await expect(feedback(page).filter({ hasText: "Tâche faite : Déclaration de TVA du trimestre" })).toBeVisible();
    // La suivante, trois mois plus tard (règle du lot 53).
    await page.reload();
    const next = new Date(`${addDays(setup.today, 6)}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 3);
    const viewer = { userId: setup.ownerId, role: "owner" as const, allPlannersSeeAll: true };
    const standalone = await listTasks({ organizationId: setup.organizationId, today: setup.today, viewer, filters: { event: { kind: "none" } } });
    expect(standalone.tasks.map((task) => task.dueDate)).toEqual([next.toISOString().slice(0, 10)]);
    await expect(page.locator(".task-lines .task-line")).toHaveCount(1);
  });

  test("CHR-03 crit. 10 — les anciennes adresses mènent à la vue équivalente", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await agence();
    await signIn(page, setup.email, /\/$/);
    const cases: [string, string][] = [
      ["/taches?vue=en-retard", "/taches?periode=retard"],
      ["/taches?vue=faites", "/taches?etat=faites"],
      ["/taches?vue=toutes&qui=planner", "/taches?etat=toutes"],
      ["/taches?vue=a-faire&qui=clients", "/taches?qui=clients"],
      [`/taches?vue=a-faire&tache=${setup.car.id}`, `/taches?tache=${setup.car.id}`],
    ];
    for (const [from, to] of cases) {
      await page.goto(from);
      await expect(page).toHaveURL(to);
    }
    await expect(page.getByRole("dialog", { name: "Confirmer la voiture des mariés" })).toBeVisible();
  });

  test("SEC-10 à SEC-13 — abus : `evenement` et `qui` d'une autre organisation ne montrent rien d'elle", async ({ page }) => {
    test.setTimeout(150_000);
    const victim = await agence();
    const intruder = await agence();
    await signIn(page, intruder.email, /\/$/);
    for (const path of [`/taches?evenement=${victim.lea}`, `/taches?qui=${victim.bastienId}`, `/taches?evenement=${victim.lea}&etat=toutes&affichage=calendrier`]) {
      await page.goto(path);
      await expect(page.locator(".task-lines .task-line")).toHaveCount(0);
      await expect(page.locator(`[href*="${victim.car.id}"]`)).toHaveCount(0);
    }
    await page.goto(`/taches?evenement=${victim.lea}`);
    await expect(page.locator(".task-count")).toContainText("sur 6 à faire");
  });

  test("UX-14, crit. 9 du 70c — à 375 px, la part de « Tâches » au-dessus de la première tâche tient en 140 px", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!isPhone(page), "mesure à 375 px");
    const setup = await agence();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/taches");
    const first = page.locator(".task-lines .task-line").first();
    await expect(first).toBeVisible();
    const measure = await page.evaluate(() => {
      const main = document.querySelector("main")!.getBoundingClientRect().top + window.scrollY;
      const task = document.querySelector(".task-lines .task-line")!.getBoundingClientRect().top + window.scrollY;
      return { main: Math.round(main), task: Math.round(task) };
    });
    // L'écran lui-même (titre, « Filtres », « Mes tâches », décompte, premier mois) : 140 px au plus. La
    // barre du haut, au-dessus de « main », passe de sa hauteur actuelle à 60 px au paquet 70f : la
    // première tâche arrivera alors à 200 px au plus (critère 9 du 70c, en `fixme` dans sa spec).
    console.log(`Lot 70d — 375 px : début de l'écran à ${measure.main} px, première tâche à ${measure.task} px (${measure.task - measure.main} px pour l'écran).`);
    expect(measure.task - measure.main).toBeLessThanOrEqual(140);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("NFR-02 — la liste filtrée d'une agence de 500 tâches répond en moins de 300 ms", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "mesure : une fois par version, sous Chromium");
    test.skip(testInfo.config.workers !== 1, "mesure : un seul parcours à la fois (la CI, ou --workers=1 en local)");
    test.setTimeout(300_000);
    const setup = await agence();
    const today = parisToday();
    // 500 tâches en tout : réparties sur les deux mariages et les deux personnes.
    for (let index = 0; index < 493; index += 1) {
      await withActor({ kind: "member", id: setup.ownerId }, () =>
        addEventTask(setup.organizationId, index % 2 === 0 ? setup.lea : setup.ines, { label: `Tâche ${index}`, dueDate: addDays(today, (index % 120) - 30), responsible: index % 5 === 0 ? "clients" : "planner", ...(index % 5 === 0 ? {} : { assigneeUserId: index % 3 === 0 ? setup.bastienId : setup.ownerId }) }),
      );
    }
    await signIn(page, setup.email, /\/$/);
    // La liste montre d'abord les 100 tâches les plus urgentes ; « Afficher les N suivantes » montre le reste.
    await page.goto("/taches");
    await expect(page.locator(".task-lines .task-line")).toHaveCount(100);
    await expect(page.locator(".task-count")).toContainText("499 tâches à faire sur 500");
    await expect(page.locator(".task-more")).toContainText("Les 100 premières tâches sur 499.");
    await page.getByRole("link", { name: "Afficher les 399 suivantes" }).click();
    await expect(page.locator(".task-lines .task-line")).toHaveCount(499);
    const request = page.context().request;
    const urls = ["/taches", `/taches?periode=retard&grouper=qui`, `/taches?qui=${setup.bastienId}&periode=15j`, `/taches?evenement=${setup.lea}&grouper=evenement`, "/taches?etat=faites"];
    for (const url of urls) await request.get(url);
    const series: number[] = [];
    for (let round = 0; round < 3; round += 1) {
      const times: number[] = [];
      for (let repeat = 0; repeat < 4; repeat += 1) {
        for (const url of urls) {
          const start = performance.now();
          const response = await request.get(url);
          await response.body();
          times.push(performance.now() - start);
          expect(response.status(), url).toBe(200);
        }
      }
      const sorted = [...times].sort((a, b) => a - b);
      series.push(Math.round(sorted[Math.ceil(0.95 * sorted.length) - 1]!));
    }
    const median = [...series].sort((a, b) => a - b)[1]!;
    reportMeasure(testInfo, { mesure: "Lot 70d — NFR-02, « Tâches » avec 500 tâches (médiane des 95e centiles de 3 séries)", valeur: median, seuil: 300, detail: `séries : ${series.join(", ")} ms` });
    expect(median).toBeLessThan(300);
  });
});
