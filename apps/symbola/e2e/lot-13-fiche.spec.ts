// Lot 13 (L13-EVT-19) — fiche événement : frise datée du statut, bandeau
// « Prochaine étape », vue d'ensemble en chiffres. Ordinateur et 375 px,
// axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { formatCalendarDate, parisToday } from "@symbola/i18n";
import { createProspect, createProspectSource, createTaskTemplate } from "../modules/events/service";
import { changeEventStatus, readyOrganization } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
}

test("L13-EVT-19 — frise datée du statut, prochaine étape et chiffres clés", async ({ page }) => {
  const email = `planner-fiche-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-fiche";
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let userId: string;
  try {
    organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    userId = (await createUser(db, { organizationId, email, password, role: "owner" })).id;
  } finally {
    await sql.end();
  }
  await createTaskTemplate(organizationId, "Mariage", []);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: source.id, clients: [{ firstName: "Inès" }], eventDate: "2027-06-12" });
  await login(page, email, password);

  // Prospect : la frise date l'étape en cours ; le bandeau propose le devis.
  await page.goto(`/events/${event.id}`);
  const today = formatCalendarDate(parisToday(), "fr");
  const steps = page.getByRole("list", { name: "Statut de l'événement" });
  await expect(steps.getByRole("listitem").filter({ hasText: "Prospect" })).toContainText(today);
  await expect(steps.getByRole("listitem").filter({ hasText: "Réalisé" })).toContainText("après le");
  await expect(page.getByRole("heading", { name: "Prochaine étape : envoyer le devis" })).toBeVisible();

  // La vue d'ensemble tient en chiffres.
  await expect(page.getByText("Lignes pourvues", { exact: true })).toBeVisible();
  await expect(page.getByText("Tâches en retard", { exact: true })).toBeVisible();
  await expectNoAxeViolation(page);

  // Changer d'étape demande confirmation ; « Annuler » ne change rien.
  await page.getByRole("button", { name: "Passer en Confirmé" }).click();
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(steps.getByRole("listitem").filter({ hasText: "Prospect" })).toHaveAttribute("aria-current", "step");
  await changeEventStatus(page, "Confirmé");
  await expect(steps.getByRole("listitem").filter({ hasText: "Confirmé" })).toContainText(today);

  // Confirmé sans tâches : appliquer le rétroplanning ; « Plus tard » le masque, même rechargé.
  await expect(page.getByRole("heading", { name: "Prochaine étape : appliquer le rétroplanning" })).toBeVisible();
  await page.getByRole("button", { name: "Plus tard" }).click();
  await expect(page.getByRole("heading", { name: /^Prochaine étape/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: /^Prochaine étape/ })).toHaveCount(0);
  await expectNoAxeViolation(page);
});
