// Lot 72c (PAR-10, HUB-03, HUB-08, EVT-06, SEC-12, SEC-13 ; C-14, A7, J3, J4, M8 ; spécification du lot 72,
// § 5.3 ; maquette 14 du lot 68) — « Moi · L'agence » sur « Aujourd'hui », à 1 280 et à 375 px (projets
// « desktop » et « mobile-375 »), axe-core sur chaque vue. Joué comme planner seule, comme gérante (la titulaire
// d'une agence de trois personnes) et comme collaboratrice restreinte (lot 52). Un `test` par critère.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { createOrganization, createUser, setUserNames } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addEventTask, changeEventStatus, createProspect, createProspectSource, setEventTeamMember } from "../modules/events/service";
import { completeSetup, saveOnboardingStep, setEventVisibility } from "../modules/hub/service";
import { signIn } from "./helpers";

const expect = baseExpect.configure({ timeout: 20_000 });

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;

// À 375 px : aucune commande sous 44 px (un lien dans une phrase est exclu), aucun défilement de côté.
async function expectPhoneRules(page: Page) {
  if (!isPhone(page)) return;
  const small = await page.evaluate(() => {
    const words = (element: Element | null) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
    const inSentence = (link: HTMLElement) => getComputedStyle(link).display === "inline" && words(link.parentElement).length > words(link).length;
    return [...document.querySelectorAll<HTMLElement>("main button, main summary, main a[href], main select")]
      .filter((element) => !(element.tagName === "A" && inSentence(element)))
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ element, box }) => box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden")
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ element, box }) => `${element.tagName} « ${words(element).slice(0, 40)} » ${Math.round(box.width)}×${Math.round(box.height)}`);
  });
  expect(small).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

function parisDay(offsetDays = 0): string {
  const day = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
}

type Person = { id: string; email: string };
type Agency = { organizationId: string; nadia: Person; hugo: Person; lina: Person; events: { chloe: string; sarah: string; louise: string } };

async function organization(name: string) {
  const { sql, db } = createAppConnection();
  try {
    const created = await createOrganization(db, `${name} ${randomUUID()}`);
    await completeSetup(db, created.id);
    await saveOnboardingStep(db, created.id, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    const person = async (first: string, last: string, role: "owner" | "member"): Promise<Person> => {
      const email = `${first.toLowerCase()}-72c-${randomUUID()}@symbola.test`;
      const user = await createUser(db, { organizationId: created.id, email, role });
      await setUserNames(db, user.id, { firstName: first, lastName: last });
      return { id: user.id, email };
    };
    return { organizationId: created.id, person, db, end: () => sql.end() };
  } catch (error) {
    await sql.end();
    throw error;
  }
}

async function wedding(organizationId: string, byUserId: string, first: string, second: string, days: number) {
  const source = await createProspectSource(organizationId, `Salon ${randomUUID().slice(0, 6)}`);
  const event = await createProspect({ organizationId, createdByUserId: byUserId, prospectSourceId: source.id, clients: [{ firstName: first, lastName: "Martin" }, { firstName: second }], eventDate: parisDay(days) });
  await changeEventStatus({ organizationId, eventId: event.id, changedByUserId: byUserId, toStatus: "confirmed" });
  return event.id;
}

// La Maison Belkacem en petit (maquette 14) : Nadia (titulaire), Hugo et Lina (Planners). Chloé & Thomas (Hugo,
// trois retards), Sarah & Malik (Lina, un retard), Louise & Arthur (Nadia, à jour), et une tâche attendue des
// mariés en retard.
async function agency(options: { restricted?: boolean } = {}): Promise<Agency> {
  const org = await organization("Maison 72c");
  try {
    const nadia = await org.person("Nadia", "Belkacem", "owner");
    const hugo = await org.person("Hugo", "Lemaire", "member");
    const lina = await org.person("Lina", "Morel", "member");
    const { organizationId } = org;
    const chloe = await wedding(organizationId, nadia.id, "Chloé", "Thomas", 45);
    const sarah = await wedding(organizationId, nadia.id, "Sarah", "Malik", 59);
    const louise = await wedding(organizationId, nadia.id, "Louise", "Arthur", 129);
    await setEventTeamMember({ organizationId, eventId: chloe, userId: hugo.id, role: "lead", byUserId: nadia.id });
    await setEventTeamMember({ organizationId, eventId: sarah, userId: lina.id, role: "lead", byUserId: nadia.id });
    await setEventTeamMember({ organizationId, eventId: louise, userId: nadia.id, role: "lead", byUserId: nadia.id });
    const task = (eventId: string, label: string, days: number, assignee: string | null, responsible: "planner" | "clients" = "planner") =>
      addEventTask(organizationId, eventId, { label, dueDate: parisDay(days), responsible, ...(assignee ? { assigneeUserId: assignee } : {}) });
    await task(chloe, "Faire signer le contrat du photographe", -9, hugo.id);
    await task(chloe, "Réserver la navette des invités", -4, hugo.id);
    await task(chloe, "Choisir le DJ", -2, hugo.id);
    await task(chloe, "Valider le menu", 0, hugo.id);
    await task(chloe, "Envoyer le questionnaire", 3, nadia.id);
    await task(sarah, "Envoyer le plan de table au traiteur", -3, lina.id);
    await task(sarah, "Valider le faire-part", -1, null, "clients");
    await task(louise, "Bloquer les chambres", 30, nadia.id);
    if (options.restricted) await setEventVisibility(org.db, { organizationId, allPlannersSeeAll: false, byUserId: nadia.id });
    return { organizationId, nadia, hugo, lina, events: { chloe, sarah, louise } };
  } finally {
    await org.end();
  }
}

const toggle = (page: Page) => page.getByRole("navigation", { name: "Ce que montre l'accueil" });
const people = (page: Page) => page.getByRole("region", { name: "Par personne" });
const byEvent = (page: Page) => page.getByRole("region", { name: /^Par évènement/ });
const primaries = (page: Page) => page.locator("main .button-primary, main .button-link-primary");
const personRow = (page: Page, name: string) => people(page).getByRole("row", { name: new RegExp(name) });

test.describe("PAR-10, HUB-03 — « Moi · L'agence » (lot 72c)", () => {
  // La connexion passe par le lien et le fournisseur d'identité.
  test.describe.configure({ timeout: 120_000 });

  test("critère 1 — planner seule : aucune bascule, et ?vue=agence rend la vue « Moi » sans erreur", async ({ page }) => {
    const org = await organization("Atelier 72c");
    let camille: Person;
    try {
      camille = await org.person("Camille", "Roussel", "owner");
      const lea = await wedding(org.organizationId, camille.id, "Léa", "Maxime", 199);
      await addEventTask(org.organizationId, lea, { label: "Faire signer le contrat du photographe", dueDate: parisDay(-5), responsible: "planner" });
    } finally {
      await org.end();
    }
    await signIn(page, camille.email);
    await page.goto("/?vue=agence");
    await expect(page.getByRole("heading", { level: 1, name: "Aujourd'hui" })).toBeVisible();
    await expect(toggle(page)).toHaveCount(0);
    await expect(people(page)).toHaveCount(0);
    await expect(page.getByRole("region", { name: /^À traiter en premier/ })).toContainText("Faire signer le contrat du photographe");
    await expectNoAxeViolation(page);
  });

  test("critère 1 et M8 — la gérante : la bascule, « Moi » par défaut ; l'option active en encre, pas dans la couleur d'action ; la bascule n'est pas une action principale", async ({ page }) => {
    const context = await agency();
    await signIn(page, context.nadia.email);
    await page.goto("/");
    const moi = toggle(page).getByRole("link", { name: "Moi" });
    await expect(moi).toHaveAttribute("aria-current", "page");
    // « Moi » : les tâches de Nadia, pas celles confiées à Hugo (portée du lot 72a).
    await expect(page.getByRole("region", { name: /^À traiter en premier/ })).toContainText("Envoyer le questionnaire");
    await expect(page.getByRole("region", { name: /^À traiter en premier/ })).not.toContainText("Faire signer le contrat du photographe");
    const colors = await moi.evaluate((element) => {
      const probe = document.createElement("span");
      probe.className = "bg-primary";
      document.body.append(probe);
      const primary = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { active: getComputedStyle(element).backgroundColor, primary };
    });
    expect(colors.active).not.toBe(colors.primary);
    expect(colors.active).toBe("rgb(20, 24, 31)");
    await expect(toggle(page).locator(".button-primary, .button-link-primary")).toHaveCount(0);
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);
  });

  test("critères 2 et 3 — « L'agence » : qui est en retard, quels mariages ; les sommes se recomptent ; « Voir ses tâches » ouvre « Tâches » filtré et groupé par évènement", async ({ page }) => {
    const context = await agency();
    await signIn(page, context.nadia.email);
    await page.goto("/");
    await toggle(page).getByRole("link", { name: "L'agence" }).click();
    await expect(page).toHaveURL(/\?vue=agence$/);
    await expect(toggle(page).getByRole("link", { name: "L'agence" })).toHaveAttribute("aria-current", "page");
    // La vue d'agence est une lecture : aucune action principale, la bascule n'en est pas une.
    await expect(primaries(page)).toHaveCount(0);
    // 3 (Hugo) + 1 (Lina) + 1 (attendu des mariés) = 5, dans deux évènements.
    await expect(page.locator(".today-count")).toHaveText("L'agence : 5 tâches en retard, dans 2 évènements");
    await expect(personRow(page, "Nadia Belkacem")).toContainText("(vous)");
    await expect(personRow(page, "Hugo Lemaire").locator("td").first()).toHaveText("3");
    await expect(personRow(page, "Lina Morel").locator("td").first()).toHaveText("1");
    await expect(personRow(page, "Attendu des mariés ou d'un prestataire").locator("td").first()).toHaveText("1");
    // Par évènement : Chloé & Thomas (3 retards) avant Sarah & Malik (1) ; Louise & Arthur, à jour, replié et absent de la page.
    const rows = byEvent(page).locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Chloé & Thomas");
    await expect(rows.nth(0)).toContainText("Hugo Lemaire");
    await expect(rows.nth(0)).toContainText("0 sur 5");
    await expect(rows.nth(1)).toContainText("Sarah & Malik");
    await expect(byEvent(page)).not.toContainText("Louise & Arthur");
    await expect(byEvent(page)).toContainText("1 évènement à jour");
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);
    // Afficher les évènements à jour : leurs lignes arrivent alors seulement.
    await byEvent(page).getByRole("link", { name: "Afficher" }).click();
    await expect(byEvent(page)).toContainText("Louise & Arthur");
    // Le dernier choix est gardé sur l'appareil.
    await page.goto("/");
    await expect(people(page)).toBeVisible();
    // « Voir ses tâches » : « Tâches » sur Hugo, groupé par évènement.
    await personRow(page, "Hugo Lemaire").getByRole("link", { name: /^Voir/ }).click();
    await expect(page).toHaveURL(new RegExp(`/taches\\?qui=${context.hugo.id}&grouper=evenement`));
    await expect(page.getByRole("main")).toContainText("Faire signer le contrat du photographe");
    await expect(page.getByRole("main")).not.toContainText("Envoyer le plan de table au traiteur");
    // Retour à « Moi ».
    await page.goto("/?vue=moi");
    await expect(people(page)).toHaveCount(0);
    await page.goto("/");
    await expect(people(page)).toHaveCount(0);
  });

  test("critère 4 — une collaboratrice restreinte (lot 52) ne voit que ses évènements et leurs nombres", async ({ page }) => {
    const context = await agency({ restricted: true });
    await signIn(page, context.lina.email);
    await page.goto("/?vue=agence");
    // Sarah & Malik seulement : son retard et celui des mariés ; rien de Chloé & Thomas, ni le nom, ni les trois retards de Hugo.
    await expect(page.locator(".today-count")).toHaveText("L'agence : 2 tâches en retard, dans 1 évènement");
    await expect(byEvent(page).locator("tbody tr")).toHaveCount(1);
    await expect(page.getByRole("main")).not.toContainText("Chloé & Thomas");
    await expect(page.getByRole("main")).not.toContainText("Faire signer le contrat du photographe");
    const hugo = personRow(page, "Hugo Lemaire");
    await expect(hugo.locator("td").first()).toHaveText("0");
    await expectNoAxeViolation(page);
  });
});
