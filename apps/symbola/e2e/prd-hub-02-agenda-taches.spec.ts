// PRD-HUB-02 — agenda des mois à venir (3, 6 ou 12 mois), mariages confirmés et
// prospects datés, badge « 2 » le même week-end ; depuis le lot 32a (D3), sur
// l'écran « Évènements ». Tâches cochables depuis « Aujourd'hui » (HUB-08), avec
// « Annuler » (D7) ; écran « Tâches » de toute l'organisation. En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { parisToday } from "@symbola/i18n";
import { expect, test, type Page } from "@playwright/test";
import { addEventTask, changeEventStatus, createProspect, createProspectSource } from "../modules/events/service";
import { clickMenuLink, readyOrganization, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

function shift(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

test("PRD-HUB-02 / HUB-08 — agenda des mariages, tâches cochées depuis « Aujourd'hui », écran Tâches", async ({ page }) => {
  const email = `planner-hub02-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-hub02-e2e";
  const today = parisToday();
  // Un samedi du mois prochain et le dimanche qui suit : deux mariages le même week-end.
  const nextMonth = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const saturday = shift(nextMonth.toISOString().slice(0, 10), (6 - nextMonth.getUTCDay() + 7) % 7);
  const sunday = shift(saturday, 1);

  const { sql, db } = createAppConnection();
  let firstName = "";
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    firstName = `Inès${randomUUID().slice(0, 4)}`;
    const confirmed = await createProspect({
      organizationId: organization.id,
      createdByUserId: user.id,
      prospectSourceId: source.id,
      clients: [{ firstName, lastName: null }, { firstName: "Sacha", lastName: null }],
      eventDate: saturday,
    });
    await changeEventStatus({ organizationId: organization.id, eventId: confirmed.id, changedByUserId: user.id, toStatus: "confirmed" });
    await createProspect({
      organizationId: organization.id,
      createdByUserId: user.id,
      prospectSourceId: source.id,
      clients: [{ firstName: "Léa", lastName: null }, { firstName: "Hugo", lastName: null }],
      eventDate: sunday,
    });
    await addEventTask(organization.id, confirmed.id, { label: "Relancer le traiteur", dueDate: shift(today, -2), responsible: "planner" });
    await addEventTask(organization.id, confirmed.id, { label: "Envoyer le questionnaire", dueDate: shift(today, 5), responsible: "clients" });
    await addEventTask(organization.id, confirmed.id, { label: "Tâche lointaine", dueDate: shift(today, 60), responsible: "planner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Agenda : 3 mois par défaut (lot 16, L16-HUB-20), noms dans les cases, badge « 2 ».
  await page.goto("/events?affichage=calendrier");
  const agenda = page.getByRole("region", { name: "Agenda" });
  await expect(agenda.getByRole("link", { name: "3 mois" })).toHaveAttribute("aria-current", "true");
  const weekend = agenda.locator("summary", { hasText: firstName });
  await expect(agenda.getByText(`${firstName} & Sacha`).first()).toBeVisible();
  await expect(agenda.getByText("2 événements ce week-end").first()).toBeAttached();
  await expectNoAxeViolation(page);

  // « Voir l'année » : 12 mois ; le choix est retenu.
  await agenda.getByRole("link", { name: "Voir l'année" }).click();
  await expect(page).toHaveURL(/agenda=12/);
  await expect(agenda.getByText(new RegExp(`${firstName} & Sacha`)).first()).toBeAttached();
  await page.goto("/events?affichage=calendrier");
  await expect(agenda.getByRole("link", { name: "Voir l'année" })).toHaveAttribute("aria-current", "true");
  await agenda.getByRole("link", { name: "3 mois" }).click();
  await expect(page).toHaveURL(/agenda=3/);
  // Un clic sur le week-end propose les deux mariages, et ouvre la fiche.
  await weekend.first().click();
  await agenda.getByRole("link", { name: new RegExp(`${firstName} & Sacha`) }).first().click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(firstName) })).toBeVisible();

  // « Aujourd'hui » (HUB-08) : le retard d'abord, puis ce qu'attend le client ; pas la tâche
  // lointaine. Cocher la retire ; « Annuler » la rétablit (D7).
  await page.goto("/");
  const first = page.getByRole("region", { name: "À traiter en premier" });
  await expect(first.getByRole("listitem").first()).toContainText("Relancer le traiteur");
  await expect(first.getByRole("listitem").first()).toContainText("En retard de 2 jours");
  await expect(first.getByRole("listitem").first()).toContainText("Vous");
  await expect(first.getByRole("listitem").nth(1)).toContainText("Envoyer le questionnaire");
  await expect(first.getByRole("listitem").nth(1)).toContainText("Attend le client");
  await expect(page.getByText("Tâche lointaine")).toHaveCount(0);
  await first.getByRole("button", { name: "Fait : « Relancer le traiteur »" }).click();
  const undo = page.getByRole("status").filter({ hasText: "Tâche « Relancer le traiteur » faite." });
  await expect(undo).toBeVisible();
  await expect(first.getByText("Relancer le traiteur")).toHaveCount(0);
  await undo.getByRole("button", { name: "Annuler" }).click();
  await expect(first.getByText("Relancer le traiteur")).toBeVisible();
  await first.getByRole("button", { name: "Fait : « Relancer le traiteur »" }).click();
  await expect(first.getByText("Relancer le traiteur")).toHaveCount(0);

  // Écran Tâches : toutes les tâches à faire, avec leur mariage ; filtre « Toutes ».
  await clickMenuLink(page, "Tâches");
  await expect(page).toHaveURL(/\/taches/);
  await expect(page.getByRole("heading", { level: 1, name: "Tâches" })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Tâche lointaine" })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Relancer le traiteur" })).toHaveCount(0);
  await page.getByRole("link", { name: "Toutes", exact: true }).click();
  await expect(page.getByRole("rowheader", { name: "Relancer le traiteur" })).toBeVisible();
  await expectNoAxeViolation(page);

  // L13-HUB-15 : les délais de relance restent réglables (Paramètres).
  await page.goto("/parametres/relances");
  await page.getByLabel("Relancer un devis envoyé après (jours)").fill("5");
  await page.getByRole("button", { name: "Enregistrer les délais" }).click();
  await expect(page.getByText("✓ Délais enregistrés.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Relancer un devis envoyé après (jours)")).toHaveValue("5");
  await expectNoAxeViolation(page);
});
