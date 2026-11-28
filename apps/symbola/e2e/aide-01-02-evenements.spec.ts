// AIDE-11/02, HUB-11 (lot 63f, ADR 0104 ; lot 74d) — module évènements : la liste vide ne propose pas sa
// visite, le « ? » la garde (« Revoir la visite de cet écran ») ; puis essai guidé sur un mariage fictif,
// supprimé à la fin de l'essai. En taille ordinateur et en 375 px,
// axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { changeEventStatus, helpPanel, openEventTab, readyOrganization, signIn as signInByLink, tourDialog } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Visite lancée d'office (sans la préférence posée par la configuration des autres parcours).
test.use({ storageState: { cookies: [], origins: [] } });

test("HUB-11 / AIDE-02 — visite du module évènements, puis essai guidé supprimé à la fin", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `planner-aide-evt-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-aide-evt-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Lot 74d (D2, C-69) : la liste vide ne lance aucune visite et ne la propose pas (pas de ligne
  // « Découvrir ») ; le « ? » garde « Revoir la visite de cet écran ».
  await page.goto("/events");
  const tour = tourDialog(page, "Liste des évènements");
  await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toBeVisible();
  await expect(tour).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Visite proposée" })).toHaveCount(0);
  const panel = helpPanel(page, "Liste des évènements");
  await page.getByRole("button", { name: "Aide sur cet écran" }).click();
  await expect(panel).toContainText("Revoir la visite de cet écran");
  await expectNoAxeViolation(page);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);

  // AIDE-02 : l'essai ouvre un mariage fictif complet, marqué comme tel.
  // Lot 20 (décision 2) : l'essai se lance depuis l'aide de l'écran.
  await page.getByRole("button", { name: "Aide sur cet écran" }).click();
  await panel.getByRole("button", { name: "Démarrer l'essai" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  // Lot 74d (D2) : la fiche ne lance plus sa visite d'elle-même.
  await expect(tourDialog(page, "Fiche de l'évènement")).toHaveCount(0);
  const trialUrl = page.url();
  const trialId = trialUrl.split("/").pop()!;
  await expect(page.getByRole("heading", { name: "Exemple — données fictives" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Camille & Sacha");
  await openEventTab(page, "Mariés");
  await expect(page.getByText("Pendant l'essai, aucun lien n'est envoyé")).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer le lien et l'envoyer" })).toHaveCount(0);
  await expectNoAxeViolation(page);

  // Une vraie opération sur les données fictives.
  await openEventTab(page, "Synthèse");
  await page.waitForLoadState("networkidle");
  await changeEventStatus(page, "Confirmé");
  const pdf = await page.request.get(`/events/${trialId}/programme/pdf?variant=couple`);
  expect(pdf.status()).toBe(200);

  await page.goto("/events");
  await expect(page.getByRole("row", { name: /Camille & Sacha/ })).toContainText("Exemple");
  await page.getByRole("button", { name: "Aide sur cet écran" }).click();
  await expect(panel.getByRole("link", { name: "Reprendre l'essai en cours" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Fin de l'essai : toutes ses données disparaissent.
  await page.goto(trialUrl);
  await page.getByRole("button", { name: "Supprimer l'exemple et ses données" }).click();
  await expect(page).toHaveURL(/\/events\?essai=termine$/);
  await expect(page.getByText("Essai terminé : ses données fictives ont été supprimées.")).toBeVisible();
  await expect(page.getByRole("row", { name: /Camille & Sacha/ })).toHaveCount(0);
  // Plus aucun évènement : l'essai est aussi proposé dans la page.
  await expect(page.getByRole("region", { name: "Essai guidé" }).getByRole("button", { name: "Démarrer l'essai" })).toBeVisible();
  await page.goto(trialUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
  await expectNoAxeViolation(page);
});
