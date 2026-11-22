// Lot 66a (HUB-28, CHR-05 ; D1 ; M17 ; ADR 0112) — Paramètres › Automatisations : l'heure d'envoi par
// défaut de l'organisation, et l'heure propre d'un automatisme (« Envoi à »), au quart d'heure ; vide,
// l'heure par défaut revient. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { getAutomationGate, getDefaultSendTime } from "../modules/hub/service";
import AxeBuilder from "./axe";
import { readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    const email = `planner-66a-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId, email, password: "mot-de-passe-66a", role: "owner" });
    return { organizationId, email };
  } finally {
    await sql.end();
  }
}

test("HUB-28 — Lot 66a : l'heure d'envoi par défaut et celle d'un automatisme, au quart d'heure", async ({ page }) => {
  test.setTimeout(90_000);
  const setup = await atelier();
  await signIn(page, setup.email);
  await page.goto("/parametres/automatisations");
  const defaults = page.getByRole("region", { name: "Heure d'envoi par défaut" });
  await expect(defaults.getByLabel("Envoi à")).toHaveValue("09:00");
  await expectNoAxeViolation(page);

  await defaults.getByLabel("Envoi à").selectOption("08:30");
  await defaults.getByRole("button", { name: "Enregistrer l'heure" }).click();
  await expect(defaults.getByRole("status")).toHaveText("Heure enregistrée.");
  await expect.poll(() => getDefaultSendTime(setup.organizationId)).toBe("08:30");

  // L'automatisme sans heure propre affiche l'heure par défaut ; il prend la sienne.
  const reminder = page.getByLabel("Heure d'envoi de « Relances d'impayés »");
  await page.reload();
  await expect(reminder).toHaveValue("");
  await expect(reminder.locator("option:checked")).toHaveText("08:30 (par défaut)");
  await reminder.selectOption("10:30");
  await page.getByRole("button", { name: "Enregistrer l'heure de « Relances d'impayés »" }).click();
  await expect.poll(async () => (await getAutomationGate(setup.organizationId, "invoice_reminder")).sendTime).toBe("10:30");
  // Revenir à l'heure par défaut.
  await page.reload();
  await page.getByLabel("Heure d'envoi de « Relances d'impayés »").selectOption("");
  await page.getByRole("button", { name: "Enregistrer l'heure de « Relances d'impayés »" }).click();
  await expect.poll(async () => (await getAutomationGate(setup.organizationId, "invoice_reminder")).sendTime).toBeNull();
  // Un automatisme sans heure fixe (le radar du matin) n'en propose pas.
  await expect(page.getByLabel(/Heure d'envoi de « Radar des risques/)).toHaveCount(0);
  await expectNoAxeViolation(page);
  if ((page.viewportSize()?.width ?? 1280) < 640) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});
