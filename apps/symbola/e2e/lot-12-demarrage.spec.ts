// Lot 12 — fiche évènement (L12-EVT-12 à L12-EVT-15) et agenda cliquable (L12-HUB-13), en taille
// ordinateur et en 375 px, axe-core. Le premier démarrage (ONB-03/04) est devenu le questionnaire
// d'accueil du lot 33b : e2e/hub-09-10-demarrage.spec.ts.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { addDefaultVendorSlots, createProspect, createProspectSource, createTaskTemplate } from "../modules/events/service";
import { changeEventStatus, expectEventStep, readyOrganization, signIn as signInByLink } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function login(page: Page, email: string, _password: string, landing: RegExp) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, landing);
}

async function owner(ready: boolean) {
  const email = `planner-demarrage-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-demarrage";
  const { sql, db } = createAppConnection();
  try {
    const organization = ready ? await readyOrganization(db, `Org ${randomUUID()}`) : await createOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    return { organizationId: organization.id, userId: user.id, email, password };
  } finally {
    await sql.end();
  }
}

test("L12-EVT-12 / L12-EVT-13 / L12-EVT-15 / EVT-01 — statut en boutons, rétroplanning ouvert dès l'option, lieux du programme", async ({ page }) => {
  const account = await owner(true);
  await addDefaultVendorSlots(account.organizationId, [{ label: "Lieu de réception", icon: "venue" }]);
  await createTaskTemplate(account.organizationId, "Mariage", []);
  const source = await createProspectSource(account.organizationId, "Salon");
  const event = await createProspect({
    organizationId: account.organizationId,
    createdByUserId: account.userId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Inès" }],
    eventDate: "2027-06-12",
  });
  await login(page, account.email, account.password, /\/$/);

  // Lot 34a (EVT-01, D8) : le rétroplanning est ouvert dès l'option ; ce modèle vide n'a rien créé.
  await page.goto(`/events/${event.id}?onglet=taches`);
  await expect(page.getByRole("button", { name: "Appliquer le modèle" })).toBeVisible();

  // Lot 13 (L13-EVT-19) : frise du statut ; l'étape choisie se confirme, puis
  // le rétroplanning est proposé.
  await expectEventStep(page, "Une demande en cours");
  await changeEventStatus(page, "Confirmé");
  // Sur l'onglet Rétroplanning, le modèle s'applique sur place ; ailleurs,
  // une carte le propose.
  await expect(page.getByRole("button", { name: "Appliquer le modèle" })).toBeVisible();
  await page.goto(`/events/${event.id}`);
  await expect(page.getByRole("heading", { name: "Prochaine étape : appliquer le rétroplanning" })).toBeVisible();
  await expectNoAxeViolation(page);

  // Lieux saisis une fois, proposés ensuite dans le programme.
  await page.goto(`/events/${event.id}?onglet=programme`);
  await page.getByLabel("Nouveau lieu (ex. Lieu des préparatifs)").fill("Domaine des Tilleuls");
  await page.getByRole("button", { name: "Ajouter le lieu" }).click();
  await expect(page.getByText("✓ Lieu ajouté.")).toBeVisible();
  await expect(page.locator("#event-place-options option[value='Domaine des Tilleuls']")).toHaveCount(1);
  await expectNoAxeViolation(page);
});

test("L12-HUB-13 — un clic sur une date libre de l'agenda crée un évènement à cette date", async ({ page }) => {
  const account = await owner(true);
  await createProspectSource(account.organizationId, "Salon");
  await login(page, account.email, account.password, /\/$/);

  await page.goto("/events?affichage=calendrier&agenda=3");
  const agenda = page.locator("[data-tour='events-agenda']");
  // Aucun menu fermé ne reste affiché (image fantôme sous Safari, recette lot 12).
  await expect(agenda.getByRole("link", { name: "Nouvel évènement à cette date" }).first()).toBeHidden();
  // Un seul menu ouvert à la fois ; un clic ailleurs ou Échap le referme.
  const other = agenda.locator("details.agenda-create").nth(25);
  await other.locator("summary").click();
  await expect(other).toHaveAttribute("open", "");
  const day = agenda.locator("details.agenda-create").nth(10);
  await day.locator("summary").click();
  await expect(day).toHaveAttribute("open", "");
  await expect(other).not.toHaveAttribute("open");
  await page.getByRole("heading", { name: "Agenda" }).click();
  await expect(day).not.toHaveAttribute("open");
  await day.locator("summary").click();
  await page.keyboard.press("Escape");
  await expect(day).not.toHaveAttribute("open");
  await expect(day.getByRole("link", { name: "Nouvel évènement à cette date" })).toBeHidden();
  await expectNoAxeViolation(page);
  await day.locator("summary").click();
  // Lot 40c (WCAG 2.5.8) : le menu ouvert recouvre des dates voisines, que l'on rejoint en le
  // refermant (Échap, clic ailleurs) : exception « équivalent ». axe-core contrôle la page menus
  // fermés (ci-dessus), puis le menu lui-même.
  const menu = await new AxeBuilder({ page }).include("details.agenda-create[open] > ul").analyze();
  expect(menu.violations, JSON.stringify(menu.violations, null, 2)).toEqual([]);
  // Lot 70e : une seule entrée, « Nouvel évènement à cette date ».
  await day.getByRole("link", { name: "Nouvel évènement à cette date" }).click();
  await expect(page).toHaveURL(/\/events\/new\?date=\d{4}-\d{2}-\d{2}$/);
  const date = new URL(page.url()).searchParams.get("date")!;
  await expect(page.getByRole("heading", { name: "Nouvel évènement" })).toBeVisible();
  await expect(page.getByLabel(/^Date/)).toHaveValue(date);

  await page.getByRole("radio", { name: /^Signé, en préparation/ }).check();
  await page.getByLabel(/^Nom de l'évènement/).fill("Léa");
  await page.getByRole("button", { name: "Créer l'évènement" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  await expectEventStep(page, "Signé, en préparation");
});
