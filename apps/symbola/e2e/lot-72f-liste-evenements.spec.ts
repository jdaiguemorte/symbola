// Lot 72f (EVT-07, EVT-06, UX-01, UX-05, UX-13, SEC-12, SEC-13 ; C-14, C-29, C-81, P-21, E7, E8, M8 ; spécification
// du lot 72, § 5.6 ; page 17 des maquettes du lot 68) — la liste des évènements, à 1 440 et à 375 px (projets
// « desktop » et « mobile-375 »), axe-core sur chaque vue. Jouée par la titulaire d'une agence de trois personnes
// et par une collaboratrice restreinte (lot 52). Un `test` par critère, et les abus.
// Le critère 7 (200 évènements avec leurs comptes, sous le seuil de l'ADR 0115) est mesuré par le parcours NFR-02
// de la même page (lot-71f-fiche-reprise.spec.ts) : la page y joint les comptes de tâches à chaque affichage.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { createOrganization, createUser, setUserNames } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addEventTask, changeEventStatus, createProspect, createProspectSource, setEventTeamMember, updateEventTask } from "../modules/events/service";
import { completeSetup, saveOnboardingStep, setEventVisibility } from "../modules/hub/service";
import { signIn } from "./helpers";

const expect = baseExpect.configure({ timeout: 20_000 });

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 640;

async function expectNoSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

function parisDay(offsetDays = 0): string {
  const day = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
}

type Person = { id: string; email: string };
type Agency = { organizationId: string; nadia: Person; hugo: Person; lina: Person; sourceId: string; events: Record<"chloe" | "sarah" | "ines" | "louise" | "emma" | "rose", string> };

// La Maison Belkacem en petit : Nadia (titulaire), Hugo et Lina (Planners). Chloé & Thomas (Hugo ; cinq tâches,
// une faite, trois en retard), Sarah & Malik (Lina ; deux tâches, une en retard) le même jour qu'Inès & Paul (une
// demande, sans tâche) ; Louise & Arthur (Nadia, signé sans tâche) le même jour qu'Emma & Jules et Rose & Léo.
async function agency(options: { restricted?: boolean } = {}): Promise<Agency> {
  const { sql, db } = createAppConnection();
  try {
    const created = await createOrganization(db, `Maison 72f ${randomUUID()}`);
    const organizationId = created.id;
    await completeSetup(db, organizationId);
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    const person = async (first: string, last: string, role: "owner" | "member"): Promise<Person> => {
      const email = `${first.toLowerCase()}-72f-${randomUUID()}@symbola.test`;
      const user = await createUser(db, { organizationId, email, role });
      await setUserNames(db, user.id, { firstName: first, lastName: last });
      return { id: user.id, email };
    };
    const nadia = await person("Nadia", "Belkacem", "owner");
    const hugo = await person("Hugo", "Lemaire", "member");
    const lina = await person("Lina", "Morel", "member");
    const source = await createProspectSource(organizationId, `Salon ${randomUUID().slice(0, 6)}`);
    const wedding = async (first: string, second: string, days: number, signed: boolean, sourced = false) => {
      const event = await createProspect({ organizationId, createdByUserId: nadia.id, prospectSourceId: sourced ? source.id : null, clients: [{ firstName: first, lastName: "Martin" }, { firstName: second }], eventDate: parisDay(days) });
      if (signed) await changeEventStatus({ organizationId, eventId: event.id, changedByUserId: nadia.id, toStatus: "confirmed" });
      return event.id;
    };
    const chloe = await wedding("Chloé", "Thomas", 45, true, true);
    const sarah = await wedding("Sarah", "Malik", 59, true);
    const ines = await wedding("Inès", "Paul", 59, false);
    const louise = await wedding("Louise", "Arthur", 129, true);
    const emma = await wedding("Emma", "Jules", 129, false);
    const rose = await wedding("Rose", "Léo", 129, false);
    await setEventTeamMember({ organizationId, eventId: chloe, userId: hugo.id, role: "lead", byUserId: nadia.id });
    await setEventTeamMember({ organizationId, eventId: sarah, userId: lina.id, role: "lead", byUserId: nadia.id });
    await setEventTeamMember({ organizationId, eventId: louise, userId: nadia.id, role: "lead", byUserId: nadia.id });
    const task = (eventId: string, label: string, days: number) => addEventTask(organizationId, eventId, { label, dueDate: parisDay(days), responsible: "planner" });
    await task(chloe, "Faire signer le contrat du photographe", -9);
    await task(chloe, "Réserver la navette des invités", -4);
    await task(chloe, "Choisir le DJ", -2);
    await task(chloe, "Valider le menu", 3);
    const done = await task(chloe, "Envoyer le questionnaire", 5);
    await updateEventTask({ organizationId, taskId: done.id, done: true });
    await task(sarah, "Envoyer le plan de table au traiteur", -3);
    await task(sarah, "Valider le faire-part", 10);
    if (options.restricted) await setEventVisibility(db, { organizationId, allPlannersSeeAll: false, byUserId: nadia.id });
    return { organizationId, nadia, hugo, lina, sourceId: source.id, events: { chloe, sarah, ines, louise, emma, rose } };
  } finally {
    await sql.end();
  }
}

const list = (page: Page) => page.getByRole("region", { name: "Liste des évènements" });
const row = (page: Page, name: string) => list(page).getByRole("row", { name: new RegExp(`^${name}`) });
const visiblePrimaries = (page: Page) => page.locator("main .button-primary:visible, main .button-link-primary:visible");

test.describe("EVT-07 — La liste des évènements (lot 72f)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("critère 1 — un seul bouton plein ; « Reprendre et importer » et les réglages au menu « ⋯ »", async ({ page }) => {
    const setup = await agency();
    await signIn(page, setup.nadia.email);
    await page.goto("/events");
    await expect(row(page, "Chloé & Thomas")).toBeVisible();
    await expect(visiblePrimaries(page)).toHaveCount(isPhone(page) ? 0 : 1);
    await expectNoAxeViolation(page);
    if (isPhone(page)) return;
    await expect(visiblePrimaries(page)).toHaveText("Nouvel évènement");
    await expect(page.locator("main .page-header").getByRole("link", { name: /Reprendre et importer|Réglages/ })).toHaveCount(0);
    await page.getByRole("button", { name: /^Autres actions/ }).click();
    await expect(page.getByRole("menuitem", { name: "Reprendre et importer" })).toHaveAttribute("href", /\/import\?type=evenements/);
    await expect(page.getByRole("menuitem", { name: "Paramètres des évènements" })).toBeVisible();
    await expectNoAxeViolation(page);
    await page.getByRole("menuitem", { name: "Paramètres des évènements" }).click();
    await expect(page).toHaveURL(/\/reglages\/evenements/);
  });

  test("colonnes — Évènement et son type, Date et son compte à rebours, Statut en mots de la frise, Tâches faites, Lieu et Planner principal ; le tri par en-tête", async ({ page }) => {
    const setup = await agency();
    await signIn(page, setup.nadia.email);
    await page.goto("/events");
    const chloe = row(page, "Chloé & Thomas");
    await expect(chloe).toContainText("dans 45 jours");
    await expect(chloe).toContainText("Signé, en préparation");
    await expect(chloe).toContainText("1 sur 5 · 3 en retard");
    await expect(row(page, "Inès & Paul")).toContainText("Une demande en cours");
    await expect(row(page, "Inès & Paul")).toContainText("Demande : pas de tâches");
    await expect(row(page, "Louise & Arthur")).toContainText("Pas encore de tâches");
    await expect(list(page).getByRole("link", { name: "Chloé & Thomas", exact: true })).toHaveAttribute("href", `/events/${setup.events.chloe}`);
    await expectNoSideScroll(page);
    await expectNoAxeViolation(page);
    if (isPhone(page)) return;
    await expect(list(page).getByRole("columnheader")).toHaveText(["Évènement", "Date ↑", "Statut", "Tâches faites", "Lieu", "Planner principal"]);
    await expect(chloe).toContainText("non renseigné");
    await expect(chloe).toContainText("Hugo Lemaire");
    await expect(row(page, "Inès & Paul")).toContainText("non choisi");
    // Le tri : par nom, puis l'ordre inversé ; les filtres posés restent.
    await page.goto(`/events?source=${setup.sourceId}`);
    await expect(list(page).getByRole("row")).toHaveCount(2);
    await page.goto("/events");
    await list(page).getByRole("link", { name: "Évènement" }).click();
    await expect(page).toHaveURL(/tri=evenement/);
    await expect(page.getByRole("heading", { name: "6 évènements, par nom" })).toBeVisible();
    await expect(list(page).getByRole("row").nth(1)).toHaveAccessibleName(/^Chloé & Thomas/);
    await list(page).getByRole("link", { name: /^Évènement/ }).click();
    await expect(page).toHaveURL(/sens=desc/);
    await expect(list(page).getByRole("row").nth(1)).toHaveAccessibleName(/^Sarah & Malik/);
    await list(page).getByRole("link", { name: "Tâches faites" }).click();
    await expect(list(page).getByRole("row").nth(1)).toHaveAccessibleName(/^Chloé & Thomas/);
    await expect(list(page).getByRole("columnheader", { name: /Tâches faites/ })).toHaveAttribute("aria-sort", "descending");
  });

  test("critère 2 — « Tâches faites » égale l'onglet « Tâches » de la fiche et la ligne de la vue d'agence", async ({ page }) => {
    test.skip(isPhone(page), "les trois mêmes nombres, regardés une fois");
    const setup = await agency();
    await signIn(page, setup.nadia.email);
    await page.goto("/events");
    await expect(row(page, "Chloé & Thomas")).toContainText("1 sur 5 · 3 en retard");
    await page.goto("/?vue=agence");
    const byEvent = page.getByRole("region", { name: /^Par évènement/ });
    await expect(byEvent.getByRole("row", { name: /Chloé & Thomas/ })).toContainText("1 sur 5");
    await page.goto(`/events/${setup.events.chloe}`);
    await expect(page.getByRole("navigation", { name: "Sections de l'évènement" }).getByRole("tab", { name: /^Tâches/ })).toContainText("3 en retard");
  });

  test("critère 3 — deux évènements le même jour disent « 2 le même jour », trois « 3 le même jour », sans pastille", async ({ page }) => {
    const setup = await agency();
    await signIn(page, setup.nadia.email);
    await page.goto("/events");
    await expect(row(page, "Sarah & Malik")).toContainText("2 le même jour");
    await expect(row(page, "Inès & Paul")).toContainText("2 le même jour");
    for (const name of ["Louise & Arthur", "Emma & Jules", "Rose & Léo"]) await expect(row(page, name)).toContainText("3 le même jour");
    await expect(row(page, "Chloé & Thomas")).not.toContainText("le même jour");
    await expect(list(page).locator(".badge-ambre")).toHaveCount(0);
    await expect(list(page)).not.toContainText("Même jour :");
  });

  test("critère 4 — la charge des mois est dans la vue « Calendrier », réduite aux mois qui ont un évènement, et plus sous la liste", async ({ page }) => {
    test.skip(isPhone(page), "la vue « Calendrier » s'ouvre de l'en-tête de l'ordinateur");
    const setup = await agency();
    await signIn(page, setup.nadia.email);
    await page.goto("/events");
    await expect(row(page, "Chloé & Thomas")).toBeVisible();
    await expect(page.getByRole("region", { name: /Charge/ })).toHaveCount(0);
    await page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: "Calendrier" }).click();
    await expect(page).toHaveURL(/affichage=calendrier/);
    const load = page.getByRole("region", { name: "Charge des mois à venir, en tableau" });
    await expect(load).toBeVisible();
    const months = new Set([45, 59, 129].map((days) => parisDay(days).slice(0, 7)));
    await expect(load.locator("tbody tr")).toHaveCount(months.size);
    await expectNoAxeViolation(page);
  });

  test("critère 5 — les filtres et la vue restent d'une vue à l'autre et au retour d'une fiche", async ({ page }) => {
    test.skip(isPhone(page), "la bascule des vues est à l'en-tête de l'ordinateur");
    const setup = await agency();
    await signIn(page, setup.nadia.email);
    await page.goto(`/events?search=Chlo&tri=evenement`);
    await expect(list(page).getByRole("row")).toHaveCount(2);
    await page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: "Calendrier" }).click();
    await expect(page).toHaveURL(/affichage=calendrier/);
    await expect(page).toHaveURL(/search=Chlo/);
    await page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: "Colonnes" }).click();
    await expect(page).toHaveURL(/\/events\/pipeline\?.*search=Chlo/);
    await page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: "Liste" }).click();
    await expect(page).toHaveURL(/\/events\?.*search=Chlo/);
    await expect(page.getByRole("searchbox", { name: "Rechercher" })).toHaveValue("Chlo");
    await expect(list(page).getByRole("row")).toHaveCount(2);
    await list(page).getByRole("link", { name: "Chloé & Thomas", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${setup.events.chloe}`));
    await page.goBack();
    await expect(page).toHaveURL(/search=Chlo/);
    await expect(list(page).getByRole("row")).toHaveCount(2);
    // La période garde les filtres, sans le statut de l'autre période.
    await page.getByRole("navigation", { name: "Période" }).getByRole("link", { name: /^Terminés/ }).click();
    await expect(page).toHaveURL(/tab=termines/);
    await expect(page).toHaveURL(/search=Chlo/);
  });

  test("critère 6 — à 375 px, la première carte à 126 px au plus, les filtres en panneau du bas, aucun défilement de côté", async ({ page }) => {
    test.skip(!isPhone(page), "un critère du téléphone");
    const setup = await agency();
    await signIn(page, setup.nadia.email);
    await page.goto("/events");
    const first = list(page).locator("tbody tr").first();
    await expect(first).toBeVisible();
    const box = await first.boundingBox();
    expect(box!.y).toBeLessThanOrEqual(126);
    await expectNoSideScroll(page);
    await expect(page.getByRole("navigation", { name: "Période" }).getByRole("link", { name: /^À venir · 6/ })).toBeVisible();
    await expect(page.getByLabel("Statut")).toBeHidden();
    await page.getByRole("button", { name: "Filtres" }).click();
    await page.getByLabel("Venu par").selectOption(setup.sourceId);
    await expect(page).toHaveURL(new RegExp(`source=${setup.sourceId}`));
    await expectNoAxeViolation(page);
    await page.getByRole("button", { name: "Voir 1 évènement" }).click();
    await expect(page.getByRole("button", { name: "Filtres · 1" })).toBeVisible();
    await expect(list(page).locator("tbody tr")).toHaveCount(1);
    await expectNoSideScroll(page);
  });

  test("abus — un statut, un tri, une période inconnus, une source et une planner d'une autre organisation sont ignorés, sans erreur", async ({ page }) => {
    const setup = await agency();
    const { sql, db } = createAppConnection();
    let foreignSource: string;
    let foreignUser: string;
    try {
      const other = await createOrganization(db, `Autre 72f ${randomUUID()}`);
      await completeSetup(db, other.id);
      foreignSource = (await createProspectSource(other.id, "Salon de B")).id;
      foreignUser = (await createUser(db, { organizationId: other.id, email: `b-72f-${randomUUID()}@symbola.test`, role: "owner" })).id;
      const foreignEvent = await createProspect({ organizationId: other.id, createdByUserId: foreignUser, prospectSourceId: foreignSource, clients: [{ firstName: "Mariage", lastName: "de B" }], eventDate: parisDay(45) });
      await setEventTeamMember({ organizationId: other.id, eventId: foreignEvent.id, userId: foreignUser, role: "lead", byUserId: foreignUser });
    } finally {
      await sql.end();
    }
    await signIn(page, setup.nadia.email);
    for (const query of [`source=${foreignSource}`, `planner=${foreignUser}`, `planner=${setup.hugo.id}x`, "status=in_preparation", "status=closed", "tri=prix&sens=haut", "tab=nimporte", "origine=partout", "year=1"]) {
      const response = await page.goto(`/events?${query}`);
      expect(response?.status(), query).toBe(200);
      await expect(list(page).locator("tbody tr"), query).toHaveCount(6);
      await expect(page.locator("main")).not.toContainText("Mariage");
    }
    // Une planner de l'agence filtre bien ses évènements.
    if (!isPhone(page)) {
      await page.goto(`/events?planner=${setup.hugo.id}`);
      await expect(list(page).locator("tbody tr")).toHaveCount(1);
      await expect(page.getByLabel("Planner principal")).toHaveValue(setup.hugo.id);
    }
  });

  test("abus — une collaboratrice restreinte (lot 52) ne voit que ses évènements, ni leurs nombres ni leurs dates partagées", async ({ page }) => {
    const setup = await agency({ restricted: true });
    await signIn(page, setup.lina.email);
    await page.goto("/events");
    await expect(row(page, "Sarah & Malik")).toContainText("0 sur 2 · 1 en retard");
    await expect(list(page).locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("main")).not.toContainText("Chloé");
    // Inès & Paul (même jour) n'est pas à elle : la date ne dit pas « 2 le même jour ».
    await expect(row(page, "Sarah & Malik")).not.toContainText("le même jour");
    await expect(page.getByRole("navigation", { name: "Période" }).getByRole("link", { name: /^À venir · 1/ })).toBeVisible();
    await page.goto(`/events?planner=${setup.hugo.id}`);
    await expect(list(page).locator("tbody tr")).toHaveCount(1);
    await expectNoAxeViolation(page);
  });
});
