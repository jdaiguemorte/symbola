// HUB-02 — accueil : agenda des mois à venir (3, 6 ou 12 mois), mariages
// confirmés et prospects datés, badge « 2 » le même week-end, tâches de la
// quinzaine cochables ; écran « Tâches » de toute l'organisation. En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { parisToday } from "@symbola/i18n";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { addEventTask, changeEventStatus, createProspect, createProspectSource } from "../modules/events/service";
import { clickMenuLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
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

test("HUB-02 — agenda des mariages, tâches de la quinzaine cochées depuis l'accueil, écran Tâches", async ({ page }) => {
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
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
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

  // Agenda : 12 mois par défaut, les deux dates du week-end, badge « 2 ».
  const agenda = page.getByRole("region", { name: "Agenda" });
  await expect(agenda.getByRole("link", { name: "12 mois" })).toHaveAttribute("aria-current", "true");
  const weekend = agenda.locator("summary", { hasText: firstName });
  await expect(agenda.getByText(new RegExp(`${firstName} & Sacha`)).first()).toBeAttached();
  await expect(agenda.getByText("2 événements ce week-end").first()).toBeAttached();
  await expectNoAxeViolation(page);

  // 3 mois : les noms s'affichent dans les cases ; le choix est retenu.
  await agenda.getByRole("link", { name: "3 mois" }).click();
  await expect(page).toHaveURL(/agenda=3/);
  await expect(agenda.getByText(`${firstName} & Sacha`).first()).toBeVisible();
  await page.goto("/");
  await expect(agenda.getByRole("link", { name: "3 mois" })).toHaveAttribute("aria-current", "true");
  // Un clic sur le week-end propose les deux mariages, et ouvre la fiche.
  await weekend.first().click();
  await agenda.getByRole("link", { name: new RegExp(`${firstName} & Sacha`) }).first().click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(firstName) })).toBeVisible();

  // Tâches de la quinzaine : retard et échéance proche, pas la lointaine ; cocher la retire.
  await page.goto("/");
  const block = page.getByRole("region", { name: "À faire cette quinzaine" });
  await expect(block.getByText("Relancer le traiteur")).toBeVisible();
  await expect(block.getByText("Envoyer le questionnaire")).toBeVisible();
  await expect(block.getByText("Tâche lointaine")).toHaveCount(0);
  await expect(block.getByText(/En retard/)).toBeVisible();
  await block.getByRole("button", { name: "Cocher la tâche Relancer le traiteur" }).click();
  await expect(block.getByText("Relancer le traiteur")).toHaveCount(0);

  // Écran Tâches : toutes les tâches à faire, avec leur mariage ; filtre « Toutes ».
  await clickMenuLink(page, "Tâches");
  await expect(page).toHaveURL(/\/taches/);
  await expect(page.getByRole("heading", { level: 1, name: "Tâches" })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Tâche lointaine" })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Relancer le traiteur" })).toHaveCount(0);
  await page.getByRole("link", { name: "Toutes", exact: true }).click();
  await expect(page.getByRole("rowheader", { name: "Relancer le traiteur" })).toBeVisible();
  await expectNoAxeViolation(page);
});
