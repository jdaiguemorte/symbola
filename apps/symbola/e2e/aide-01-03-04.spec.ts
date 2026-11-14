// AIDE-11 (lot 13, remplace la visite guidée d'AIDE-01) — les repères de
// l'écran s'affichent d'office à la première ouverture, puis seulement au
// clic sur « ? ». AIDE-03 — l'aide est consultable et cherchable depuis le
// hub. (AIDE-04, liste des premiers pas : retirée au lot 13, L13-HUB-15.)
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { clickMenuLink, landmarksPanel, readyOrganization, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string): Promise<void> {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function createTestUser(): Promise<{ email: string; password: string }> {
  const email = `aide-e2e-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-aide-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org Aide ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  return { email, password };
}

// Repères ouverts d'office (sans la préférence posée par la configuration
// des autres parcours).
test.use({ storageState: { cookies: [], origins: [] } });

test("AIDE-11 / AIDE-03 — repères de l'accueil, aide consultable", async ({ page }) => {
  const { email, password } = await createTestUser();
  await loginAndSetupMfa(page, email, password);

  // Lot 13 (AIDE-11) : les repères de l'écran s'affichent d'office à la
  // première ouverture, sans bloquer l'écran.
  const panel = landmarksPanel(page, "Aujourd'hui");
  await expect(panel).toBeVisible();
  await expect(page.getByRole("button", { name: "Repère 1 : À traiter en premier" })).toBeVisible();
  let violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  // Un clic dans la liste des repères l'explique ; « Repère suivant » les
  // parcourt. Lot 32a (HUB-08) : les trois urgences, le reste par groupe, puis
  // les évènements en cours.
  await panel.getByRole("button", { name: "Le reste, par urgence" }).click();
  await expect(panel.getByRole("heading", { name: "Le reste, par urgence", level: 3 })).toBeVisible();
  await panel.getByRole("button", { name: "Repère suivant" }).click();
  await expect(panel.getByRole("heading", { name: "Mes évènements", level: 3 })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Repère suivant" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);

  // Déjà vus, ils ne se réaffichent pas d'eux-mêmes ; le bouton « ? » les rouvre.
  await page.reload();
  await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toBeVisible();
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "Aide sur cet écran" }).click();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "À traiter en premier", level: 3 })).toBeVisible();
  await panel.getByRole("button", { name: "Fermer l'aide" }).click();
  await expect(panel).toHaveCount(0);

  // Un écran sans repères : le même « ? » ouvre le même panneau, avec le
  // seul texte d'aide de l'écran.
  await page.goto("/taches");
  const help = page.getByRole("button", { name: "Aide sur cet écran" });
  await help.click();
  await expect(help).toHaveAttribute("aria-expanded", "true");
  const tasksPanel = landmarksPanel(page, "Les tâches de tous vos mariages");
  await expect(tasksPanel).toContainText("triées par échéance");
  await expect(tasksPanel.getByRole("list")).toHaveCount(0);
  violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);
  await help.click();
  await expect(tasksPanel).toHaveCount(0);
  await page.goto("/");

  // Lot 13 (L13-HUB-15) : plus de liste « premiers pas » ni de barre d'aide
  // permanente ; l'accueil montre ce qui attend (lot 32a : « Aujourd'hui »).
  await expect(page.getByRole("heading", { name: "Premiers pas" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "À traiter en premier" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Barre d'aide" })).toHaveCount(0);

  // AIDE-03, AIDE-12 : le centre d'aide présente chaque écran en vignette,
  // groupée par rubrique, et se cherche (l'aide, pas les données).
  await clickMenuLink(page, "Aide");
  await expect(page.getByRole("heading", { name: "Aide", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Événements" }).getByRole("link", { name: /Liste des événements/ })).toBeVisible();
  violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  // L'aide de la console d'Administration n'est pas proposée à l'équipe.
  await expect(page.getByRole("heading", { name: "Administration de la suite" })).toHaveCount(0);
  await page.getByLabel("Rechercher dans l'aide").fill("TVA");
  await expect(page.getByRole("link", { name: /Entreprise et TVA/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Liste des événements/ })).toHaveCount(0);
  await expect(page.locator(".help-search").getByRole("status")).toContainText("Écrans trouvés");

  await page.getByLabel("Rechercher dans l'aide").fill("xyznotfound");
  await expect(page.getByText("Aucun article ne correspond à votre recherche.")).toBeVisible();
});
