// Lot 70c (CHR-02, CHR-03, CHR-04, CHR-10, EVT-03, HUB-08, UX-05, UX-06, UX-07, UX-09, UX-14 ; D3, M1, M3, M4,
// M11, A8, A21, A22, C-34, C-35, C-36, C-38, C-39, C-83, C-90 ; pages 1 et 2 des maquettes du lot 68) — la
// ligne type d'une tâche et son panneau unique, à 1 440 et 375 px, axe-core sur la ligne, le menu, le
// panneau et le petit panneau des dates ; navigation au clavier. Un `test` par critère du § 5.3 de la
// spécification.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser, setUserNames } from "@symbola/auth";
import { withActor } from "@symbola/db/actor";
import { createAppConnection } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import { addEventTask, addStandaloneTask, changeEventStatus, createProspect, createProspectSource, getTask, listEventTasks, updateEventTask } from "../modules/events/service";
import { feedback, readyOrganization, signIn } from "./helpers";

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

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Atelier de Camille : le mariage confirmé de Léa et Maxime (12 juin 2027), trois tâches (une en retard,
// une aux mariés dans quatre jours, une plus tard), et une tâche hors évènement.
async function atelier() {
  const email = `planner-70c-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    await setUserNames(db, owner.id, { firstName: "Camille", lastName: "Roux" });
    const source = await createProspectSource(organization.id, "Salon");
    const event = await createProspect({
      organizationId: organization.id,
      createdByUserId: owner.id,
      prospectSourceId: source.id,
      clients: [
        { firstName: "Léa", lastName: "Morel" },
        { firstName: "Maxime", lastName: "Petit" },
      ],
      eventDate: "2027-06-12",
    });
    await changeEventStatus({ organizationId: organization.id, eventId: event.id, changedByUserId: owner.id, toStatus: "confirmed" });
    const today = parisToday();
    const as = <T>(fn: () => Promise<T>) => withActor({ kind: "member", id: owner.id }, fn);
    const late = await as(() => addEventTask(organization.id, event.id, { label: "Confirmer la voiture des mariés", dueDate: addDays(today, -4), responsible: "planner" }));
    const couple = await as(() => addEventTask(organization.id, event.id, { label: "Choisir le fleuriste", dueDate: addDays(today, 4), responsible: "clients" }));
    const later = await as(() => addEventTask(organization.id, event.id, { label: "Organiser la dégustation finale", dueDate: addDays(today, 40), responsible: "planner" }));
    const standalone = await as(() => addStandaloneTask(organization.id, { label: "Déclaration de TVA du trimestre", dueDate: addDays(today, 6), recurrence: "quarterly" }));
    return { email, ownerId: owner.id, organizationId: organization.id, eventId: event.id, late, couple, later, standalone, today };
  } finally {
    await sql.end();
  }
}

function line(page: Page, label: string) {
  return page.locator(".task-line").filter({ has: page.getByRole("link", { name: label, exact: true }) });
}

for (const size of [
  { name: "1 440 px", width: 1440, height: 900 },
  { name: "375 px", width: 375, height: 812 },
]) {
  test.describe(`Lot 70c — à ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    // Le projet « desktop » joue 1 440 px, le projet « mobile-375 » joue 375 px.
    test.beforeEach(({}, testInfo) => {
      test.skip((testInfo.project.name === "mobile-375") !== (size.width === 375), "taille jouée par l'autre projet");
    });

    test("CHR-02 crit. 1 à 3 — la même ligne sur « Tâches », la fiche et « Aujourd'hui » ; une cible, « Fait », un menu ; l'état en mots", async ({ page }) => {
      test.setTimeout(150_000);
      const setup = await atelier();
      await signIn(page, setup.email, /\/$/);

      // « Tâches » : titre, évènement, échéance et son état, qui s'en charge, « Fait », « ⋯ ».
      await page.goto("/taches");
      const late = line(page, "Confirmer la voiture des mariés");
      await expect(late).toContainText("Léa & Maxime");
      await expect(late).toContainText("En retard de 4 jours");
      await expect(late).toContainText("Vous");
      await expect(late.getByRole("button", { name: /^Fait/ })).toBeVisible();
      await expect(late.getByRole("button", { name: "Autres actions pour « Confirmer la voiture des mariés »" })).toBeVisible();
      // Une seule cible (le titre), aucune case hors du mode « Sélectionner », « Supprimer » dans le menu seulement.
      await expect(late.getByRole("link")).toHaveCount(1);
      await expect(page.locator(".task-lines input[type=checkbox]")).toHaveCount(0);
      await expect(late.getByRole("button", { name: /Supprimer/ })).toBeHidden();
      // Les mariés : le mot du type ; dans quatre jours : un mot et une icône, sans rouge.
      const couple = line(page, "Choisir le fleuriste");
      await expect(couple).toContainText("Les mariés");
      await expect(couple).toContainText("Dans 4 jours");
      const colors = await page.evaluate(() => ({
        late: getComputedStyle(document.querySelector('.task-state[data-kind="late"]')!).color,
        soon: getComputedStyle(document.querySelector('.task-state[data-kind="soon"]')!).color,
      }));
      expect(colors.late).toBe("rgb(179, 38, 30)");
      expect(colors.soon).not.toBe(colors.late);
      // Hors évènement : « Hors évènement ».
      await expect(line(page, "Déclaration de TVA du trimestre")).toContainText("Hors évènement");
      await expectNoAxeViolation(page, ".task-lines");

      // Le menu « ⋯ » : « Changer la date… », « Confier à… », « Ouvrir l'évènement », puis « Supprimer ».
      await late.getByRole("button", { name: "Autres actions pour « Confirmer la voiture des mariés »" }).click();
      const menu = page.getByRole("menu", { name: "Autres actions pour « Confirmer la voiture des mariés »" });
      await expect(menu.getByRole("menuitem")).toHaveText([/^Changer la date…/, /^Confier à…/, /^Ouvrir l'évènement/, /^Supprimer/]);
      await expectNoAxeViolation(page, ".task-menu:popover-open");
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();

      // La fiche : la même ligne, sans la colonne Évènement.
      await page.goto(`/events/${setup.eventId}?onglet=taches`);
      const inEvent = line(page, "Confirmer la voiture des mariés");
      await expect(inEvent).toContainText("En retard de 4 jours");
      await expect(inEvent.locator(".task-line-event")).toHaveCount(0);

      // « Aujourd'hui » : sans menu ; le nom du mariage est un lien séparé vers sa fiche (M4) ; « Ouvrir » a disparu.
      await page.goto("/");
      const today = line(page, "Confirmer la voiture des mariés");
      await expect(today.getByRole("link", { name: "Léa & Maxime" })).toHaveAttribute("href", `/events/${setup.eventId}?onglet=taches`);
      await expect(today.locator(".task-menu-button")).toHaveCount(0);
      await expect(today.getByRole("button", { name: /^Fait/ })).toBeVisible();
      await expect(today.getByRole("link", { name: /^Ouvrir/ })).toHaveCount(0);
      // Confiée aux mariés : « Fait » aussi, aucun bouton de relance (M3).
      await expect(line(page, "Choisir le fleuriste").getByRole("button")).toHaveText([/^Fait/]);
      if (size.width === 375) {
        await expectNoHorizontalScroll(page);
        const box = await today.getByRole("link", { name: "Léa & Maxime" }).boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
    });

    test("CHR-02 crit. 4 et 5 — le même panneau, ses mots ; « Enregistrer », « Fait » qui enregistre aussi, « Fermer sans enregistrer ? »", async ({ page }) => {
      test.setTimeout(150_000);
      const setup = await atelier();
      await signIn(page, setup.email, /\/$/);
      await page.goto("/taches");
      await line(page, "Choisir le fleuriste").getByRole("link", { name: "Choisir le fleuriste" }).click();
      const panel = page.getByRole("dialog", { name: "Choisir le fleuriste" });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("link", { name: "Léa & Maxime · 12 juin 2027" })).toBeVisible();
      await expect(panel.getByLabel("Qui s'en charge")).toBeVisible();
      await expect(panel).toContainText("Ils la voient dans leur espace, avec un rappel trois jours avant.");
      await expect(panel.getByRole("heading", { name: "Place dans le rétroplanning" })).toBeVisible();
      await expect(panel).not.toContainText(/Responsable|Qui la réalise|Rang et jalon/);
      await expectNoAxeViolation(page, "dialog.task-panel");

      // Sans changement, « Fermer » ferme tout de suite.
      // « Fermer » à l'ordinateur ; « ← Tâches » sur téléphone (il joue le même rôle).
      await panel.getByRole("button", { name: size.width === 375 ? "Tâches" : "Fermer", exact: true }).click();
      await expect(panel).toBeHidden();
      await expect(page).not.toHaveURL(/tache=/);

      // Avec un changement, Échap demande dans le pied, sans seconde fenêtre.
      await line(page, "Choisir le fleuriste").getByRole("link", { name: "Choisir le fleuriste" }).click();
      await panel.getByLabel(/^Note/).fill("Trois devis demandés");
      await page.keyboard.press("Escape");
      await expect(panel.getByText("Fermer sans enregistrer ?")).toBeVisible();
      await expect(panel).toContainText("La note de « Choisir le fleuriste » a changé");
      expect(await page.locator("dialog[open]").count()).toBe(1);
      await panel.getByRole("button", { name: "Revenir à la tâche" }).click();
      await expect(panel.getByText("Fermer sans enregistrer ?")).toBeHidden();

      // « Fait » enregistre aussi la note.
      await panel.getByRole("button", { name: "Fait", exact: true }).click();
      await expect(feedback(page)).toContainText("Tâche faite : Choisir le fleuriste");
      await expect(panel).toBeHidden();
      const saved = await getTask(setup.organizationId, setup.couple.id, setup.today);
      expect(saved).toMatchObject({ note: "Trois devis demandés", done: true });

      // « Enregistrer » garde tous les changements d'un coup.
      await line(page, "Organiser la dégustation finale").getByRole("link", { name: "Organiser la dégustation finale" }).click();
      const other = page.getByRole("dialog", { name: "Organiser la dégustation finale" });
      await other.getByLabel(/^Note/).fill("Menu en trois services");
      await other.getByLabel("Prioritaire").check();
      await other.getByRole("button", { name: "Enregistrer", exact: true }).click();
      await expect(feedback(page)).toContainText("Tâche enregistrée : Organiser la dégustation finale");
      expect(await getTask(setup.organizationId, setup.later.id, setup.today)).toMatchObject({ note: "Menu en trois services", priority: "high", done: false });
    });

    test("CHR-04 crit. 6 — une tâche faite montre quand et par qui, et « Rouvrir la tâche »", async ({ page }) => {
      test.setTimeout(120_000);
      const setup = await atelier();
      await withActor({ kind: "member", id: setup.ownerId }, () => updateEventTask({ organizationId: setup.organizationId, taskId: setup.later.id, done: true }));
      await signIn(page, setup.email, /\/$/);
      await page.goto(`/events/${setup.eventId}?onglet=taches&tache=${setup.later.id}`);
      const panel = page.getByRole("dialog", { name: "Organiser la dégustation finale" });
      await expect(panel).toContainText(/Faite le \d{1,2} \S+ à \d{1,2} h \d{2}, par vous/);
      await expect(panel.getByRole("button", { name: "Fait", exact: true })).toHaveCount(0);
      await panel.getByRole("button", { name: "Rouvrir la tâche" }).click();
      await expect(feedback(page)).toContainText("Tâche remise à faire : Organiser la dégustation finale");
      await expect.poll(async () => (await getTask(setup.organizationId, setup.later.id, setup.today))?.done).toBe(false);
    });

    test("CHR-02, CHR-10 crit. 7 — « Nouvelle tâche » avec ou sans évènement ; depuis la fiche, l'évènement est choisi", async ({ page }) => {
      test.setTimeout(150_000);
      const setup = await atelier();
      await signIn(page, setup.email, /\/$/);

      // Depuis la fiche : l'évènement d'office, pas de répétition ; « 30 jours avant le jour J » (A8).
      await page.goto(`/events/${setup.eventId}?onglet=taches`);
      await page.getByRole("link", { name: "Nouvelle tâche" }).click();
      const create = page.getByRole("dialog", { name: "Nouvelle tâche" });
      await expect(create.getByLabel("Évènement")).toHaveValue(setup.eventId);
      await expect(create).toContainText("Choisi d'office : vous venez de sa fiche.");
      await expect(create.getByLabel("Répétition")).toHaveCount(0);
      await create.getByLabel(/^Tâche/).fill("Réserver la navette des invités");
      await create.getByLabel(/^Ou en jours avant le jour J/).fill("30");
      await expect(create.getByLabel(/^Échéance/)).toHaveValue("2027-05-13");
      await expectNoAxeViolation(page, "dialog.task-panel");
      await create.getByRole("button", { name: "Créer la tâche" }).click();
      await expect(feedback(page)).toContainText("Tâche créée : Réserver la navette des invités");
      const created = (await listEventTasks(setup.organizationId, setup.eventId)).find((task) => task.label === "Réserver la navette des invités");
      expect(created).toMatchObject({ dueDate: "2027-05-13", offsetDays: -30, fixed: false });
      await expect(page).not.toHaveURL(/nouvelle=1/);

      // Depuis « Tâches » : « Aucun évènement » en tête, la répétition proposée.
      await page.goto("/taches");
      await page.getByRole("link", { name: "Nouvelle tâche" }).first().click();
      await expect(create.getByLabel("Évènement")).toHaveValue("");
      await expect(create).toContainText("Ce qui ne dépend d'aucun mariage : TVA, assurance, comptabilité.");
      await create.getByLabel(/^Tâche/).fill("Renouveler l'assurance");
      await create.getByLabel(/^Échéance/).fill(addDays(setup.today, 10));
      await create.getByLabel("Répétition").selectOption("yearly");
      await create.getByRole("button", { name: "Créer la tâche" }).click();
      await expect(feedback(page)).toContainText("Tâche créée : Renouveler l'assurance");
      await expect(line(page, "Renouveler l'assurance")).toContainText("Hors évènement");

      // Un formulaire vide : erreurs sous les champs, sans bulle du navigateur (lot 70b).
      await page.getByRole("link", { name: "Nouvelle tâche" }).first().click();
      await create.getByRole("button", { name: "Créer la tâche" }).click();
      await expect(create).toContainText("Donnez un nom à la tâche");
      await expect(create).toContainText("Choisissez une date d'échéance.");
    });

    test("CHR-02, UX-07 crit. 8 — « Changer la date… » depuis la ligne et le panneau ; « Annuler » rend la date et son état relatif", async ({ page }) => {
      test.setTimeout(150_000);
      const setup = await atelier();
      await signIn(page, setup.email, /\/$/);
      await page.goto(`/events/${setup.eventId}?onglet=taches`);
      const late = line(page, "Confirmer la voiture des mariés");
      await late.getByRole("button", { name: "Autres actions pour « Confirmer la voiture des mariés »" }).click();
      await page.getByRole("menuitem", { name: /^Changer la date…/ }).click();
      const dates = page.getByRole("dialog", { name: "Changer la date" });
      await expect(dates).toContainText("Confirmer la voiture des mariés · prévue le");
      await expect(dates).toContainText("Un clic ailleurs ferme sans rien changer.");
      await expectNoAxeViolation(page, ".task-date-panel:popover-open");
      await dates.getByRole("button", { name: /^Lundi prochain/ }).click();
      await expect(feedback(page)).toContainText("Date changée");
      await expect.poll(async () => (await listEventTasks(setup.organizationId, setup.eventId)).find((task) => task.id === setup.late.id)?.fixed).toBe(true);
      await feedback(page).getByRole("button", { name: "Annuler" }).click();
      await expect(feedback(page)).toContainText("C'est rétabli : Confirmer la voiture des mariés");
      const back = (await listEventTasks(setup.organizationId, setup.eventId)).find((task) => task.id === setup.late.id);
      expect(back).toMatchObject({ dueDate: setup.late.dueDate, fixed: false });

      // Depuis le panneau : le choix remplit le champ, enregistré avec le reste.
      await late.getByRole("link", { name: "Confirmer la voiture des mariés" }).click();
      const panel = page.getByRole("dialog", { name: "Confirmer la voiture des mariés" });
      await panel.getByRole("button", { name: "Changer…" }).click();
      await page.getByRole("dialog", { name: "Changer la date" }).getByRole("button", { name: /^Demain/ }).click();
      await expect(panel.getByLabel(/^Échéance/)).toHaveValue(addDays(setup.today, 1));
    });

    test("UX-14 crit. 9 — à 375 px : aucune commande sous 44 px, aucun défilement de côté", async ({ page }) => {
      test.skip(size.width !== 375, "critère du téléphone");
      test.setTimeout(120_000);
      const setup = await atelier();
      await signIn(page, setup.email, /\/$/);
      for (const path of ["/taches", `/events/${setup.eventId}?onglet=taches`, `/events/${setup.eventId}?onglet=taches&tache=${setup.late.id}`]) {
        await page.goto(path);
        await expectNoHorizontalScroll(page);
      }
      await page.goto("/taches");
      await expect(page.locator(".task-lines .task-line").first()).toBeVisible();
      // Les boutons visibles de la ligne (ceux des petits panneaux fermés n'ont pas de boîte).
      const actions = await page.locator(".task-lines .task-line-actions button").evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect()).filter((box) => box.width > 0 && (box.width < 44 || box.height < 44)).length);
      expect(actions).toBe(0);
      // Le panneau de la tâche : page entière, « ← Tâches », toutes les commandes à 44 px.
      await page.goto(`/taches?tache=${setup.late.id}`);
      const panel = page.getByRole("dialog", { name: "Confirmer la voiture des mariés" });
      await expect(panel.getByRole("button", { name: "Tâches", exact: true })).toBeVisible();
      const small = await panel.locator(".task-panel-foot button, .task-panel-head button").evaluateAll((buttons) =>
        buttons.filter((button) => (button as HTMLElement).offsetParent !== null).map((button) => button.getBoundingClientRect()).filter((box) => box.width < 44 || box.height < 44).length,
      );
      expect(small).toBe(0);
    });

    test.fixme("UX-14 crit. 9 — à 375 px, la première tâche de « Tâches » arrive à 200 px au plus", async () => {
      // Dépend de la barre du haut de 60 px (paquet 70f) et de l'en-tête de « Tâches » avec son bouton
      // « Filtres » (paquet 70d) : mesuré à la livraison de ces paquets.
    });

    test("EVT-03 crit. 10 — l'ancienne adresse du rétroplanning ouvre l'onglet « Tâches » et la bonne tâche ; clavier", async ({ page }) => {
      test.setTimeout(120_000);
      const setup = await atelier();
      await signIn(page, setup.email, /\/$/);
      await page.goto(`/events/${setup.eventId}?onglet=retroplanning&tache=${setup.late.id}`);
      await expect(page).toHaveURL(new RegExp(`onglet=taches&tache=${setup.late.id}`));
      await expect(page.getByRole("dialog", { name: "Confirmer la voiture des mariés" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Sections de l'évènement" }).getByRole("link", { name: /^Tâches/ })).toHaveAttribute("aria-current", "page");

      // Au clavier : Entrée sur le titre ouvre le panneau, Échap le ferme sans changement.
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Confirmer la voiture des mariés" })).toBeHidden();
      await expect(page).not.toHaveURL(/tache=/);
      await line(page, "Organiser la dégustation finale").getByRole("link", { name: "Organiser la dégustation finale" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: "Organiser la dégustation finale" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Organiser la dégustation finale" })).toBeHidden();
    });

    test("SEC-12, SEC-13 — abus : la tâche d'une autre organisation ne s'ouvre pas, ni par son adresse ni par « Dupliquer »", async ({ page }) => {
      test.setTimeout(120_000);
      const victim = await atelier();
      const intruder = await atelier();
      await signIn(page, intruder.email, /\/$/);
      for (const path of [`/taches?tache=${victim.late.id}`, `/?tache=${victim.late.id}`, `/taches?nouvelle=1&copie=${victim.late.id}`]) {
        await page.goto(path);
        await expect(page.getByRole("dialog", { name: "Confirmer la voiture des mariés" })).toHaveCount(0);
        await expect(page.locator(`[href*="${victim.late.id}"]`)).toHaveCount(0);
      }
      // La copie d'une tâche d'ailleurs ne reprend rien : un panneau vide.
      await expect(page.getByRole("dialog", { name: "Nouvelle tâche" }).getByLabel(/^Tâche/)).toHaveValue("");
    });
  });
}
