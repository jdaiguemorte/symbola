// Lot 35c (RGP-11 ; décision D8 ; ADR 0100) — fermer l'espace : la Propriétaire ouvre « Fermer
// l'espace », lit le rappel de l'export et la date de suppression, se trompe de nom (refusé), puis
// ferme ; les écrans renvoient à la fermeture, l'export reste ouvert ; une Planner apprend que
// l'espace est fermé ; la Propriétaire rouvre, et l'espace reprend. En taille ordinateur et en
// 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { createProspect, createProspectSource } from "../modules/events/service";
import { logout, openSettingsTab, readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const name = `Atelier ${randomUUID().slice(0, 6)}`;
    const organizationId = (await readyOrganization(db, name)).id;
    const ownerEmail = `camille-${randomUUID()}@symbola.test`;
    const plannerEmail = `planner-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email: ownerEmail, password: "mot-de-passe-fermeture-e2e", role: "owner" });
    await createUser(db, { organizationId, email: plannerEmail, password: "mot-de-passe-fermeture-e2e", role: "member" });
    const source = await createProspectSource(organizationId, "Salon");
    await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-06-12" });
    return { name, ownerEmail, plannerEmail };
  } finally {
    await sql.end();
  }
}

test("RGP-11 — la Propriétaire ferme l'espace (nom écrit, double authentification), garde l'export, puis le rouvre ; une Planner le trouve fermé", async ({ page }) => {
  test.setTimeout(180_000);
  const { name, ownerEmail, plannerEmail } = await atelier();
  await signIn(page, ownerEmail, /\/$/);
  await openSettingsTab(page, "Fermer l'espace");
  await expect(page).toHaveURL(/\/parametres\/fermeture$/);
  await expect(page.getByRole("heading", { level: 1, name: "Fermer l'espace" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Exportez d'abord vos données" }).getByRole("link", { name: "Exporter mes données" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ce qui se passe" })).toContainText("tout est supprimé");
  await expectNoAxeViolation(page);

  await page.waitForLoadState("networkidle");
  const form = page.getByRole("form", { name: "Fermer l'espace" });
  await form.getByLabel(/Pour confirmer, écrivez le nom de l'espace/).fill("Un autre nom");
  await form.getByRole("button", { name: "Fermer l'espace" }).click();
  await expect(form.getByRole("alert")).toHaveText("Le nom écrit n'est pas celui de l'espace.");
  await form.getByLabel(/Pour confirmer, écrivez le nom de l'espace/).fill(name);
  await form.getByRole("button", { name: "Fermer l'espace" }).click();
  // L'écran devient celui de l'espace fermé : date de suppression, export, réouverture.
  await expect(page.getByRole("heading", { level: 1, name: "Espace fermé" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Suppression le");

  // Fermé : les écrans renvoient à la fermeture ; l'export reste ouvert.
  await page.goto("/events");
  await expect(page).toHaveURL(/\/parametres\/fermeture$/);
  await expect(page.getByRole("heading", { level: 1, name: "Espace fermé" })).toBeVisible();
  await expect(page.getByText(/Encore \d+ jours pour exporter vos données ou rouvrir l'espace\./)).toBeVisible();
  await expectNoAxeViolation(page);
  await page.goto("/parametres/export");
  await expect(page.getByRole("heading", { level: 1, name: "Exporter mes données" })).toBeVisible();
  await logout(page);

  // La Planner : l'espace est fermé, sans rien d'autre.
  await signIn(page, plannerEmail);
  await page.goto("/events");
  await expect(page).toHaveURL(/\/parametres\/fermeture$/);
  await expect(page.getByText(/Cet espace est fermé : il sera supprimé le/)).toBeVisible();
  await expectNoAxeViolation(page);
  await logout(page);

  // La Propriétaire rouvre : l'espace reprend.
  await signIn(page, ownerEmail);
  await page.goto("/parametres/fermeture");
  await page.waitForLoadState("networkidle");
  await page.getByRole("form", { name: "Rouvrir l'espace" }).getByRole("button", { name: "Rouvrir l'espace" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fermer l'espace" })).toBeVisible();
  await page.goto("/events");
  await expect(page).toHaveURL(/\/events$/);
});
