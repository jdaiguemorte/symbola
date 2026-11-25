// HUB-11 (lot 63f, ADR 0104 : la visite guidée remplace les repères du lot 13) — la visite de
// l'écran se lance d'office à la première ouverture : fond assombri, zone claire, bulle « Précédent,
// Suivant, Passer la visite » ; clavier (focus dans la bulle, piégé, rendu ; Échap) ; relancée par
// « ? › Revoir la visite » ; en bas de l'écran sur téléphone. AIDE-03 — l'aide est consultable et cherchable depuis le
// hub. (AIDE-04, liste des premiers pas : retirée au lot 13, L13-HUB-15.)
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { clickMenuLink, helpPanel, readyOrganization, signIn as signInByLink, tourDialog } from "./helpers";

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

// Visite lancée d'office (sans la préférence posée par la configuration des autres parcours).
test.use({ storageState: { cookies: [], origins: [] } });

test("HUB-11 / AIDE-03 — visite guidée de l'accueil, aide consultable", async ({ page }) => {
  const { email, password } = await createTestUser();
  await loginAndSetupMfa(page, email, password);

  // HUB-11 : la visite se lance d'office à la première ouverture ; le focus est dans la bulle.
  const tour = tourDialog(page, "Aujourd'hui");
  await expect(tour).toBeVisible();
  await expect(tour).toContainText("1 sur 4");
  await expect(tour.getByRole("heading", { name: "Votre priorité du jour", level: 2 })).toBeFocused();
  // La zone expliquée reste claire : le cadre est posé sur elle.
  const zone = await page.locator("[data-tour='home-first']").boundingBox();
  const spot = await page.locator(".tour-spot").boundingBox();
  expect(zone && spot).toBeTruthy();
  expect(Math.abs(spot!.x + 6 - zone!.x)).toBeLessThan(2);
  expect(Math.abs(spot!.y + 6 - zone!.y)).toBeLessThan(2);
  let violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);
  // Sur téléphone, la bulle est ancrée en bas de l'écran, sans découpe.
  const viewport = page.viewportSize()!;
  if (viewport.width < 768) {
    const bubble = (await tour.boundingBox())!;
    expect(Math.round(bubble.y + bubble.height)).toBe(viewport.height);
  }

  // « Suivant », « Précédent » ; le focus reste dans la bulle (Tab ne sort pas).
  await expect(tour.getByRole("button", { name: "Précédent" })).toHaveCount(0);
  await tour.getByRole("button", { name: "Suivant" }).click();
  await expect(tour.getByRole("heading", { name: "Le reste, par urgence", level: 2 })).toBeVisible();
  await tour.getByRole("button", { name: "Précédent" }).click();
  await expect(tour.getByRole("heading", { name: "Votre priorité du jour", level: 2 })).toBeVisible();
  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press("Tab");
    expect(await tour.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  for (let index = 0; index < 3; index += 1) await tour.getByRole("button", { name: "Suivant" }).click();
  await expect(tour).toContainText("4 sur 4");
  // Dernière étape : le « ? », d'où la visite se relance.
  await expect(tour.getByRole("heading", { name: "L'aide de chaque écran", level: 2 })).toBeVisible();
  // Lot 69 (C-02) : à la dernière étape, « Passer la visite » n'a plus de sens ; « Terminer » reste.
  await expect(tour.getByRole("button", { name: "Passer la visite" })).toHaveCount(0);
  await tour.getByRole("button", { name: "Terminer" }).click();
  await expect(tour).toHaveCount(0);

  // Déjà vue, elle ne revient pas d'elle-même ; « ? › Revoir la visite » la relance, Échap la ferme
  // et le focus revient au « ? ».
  await page.reload();
  const help = page.getByRole("button", { name: "Aide sur cet écran" });
  await expect(help).toBeVisible();
  await expect(tour).toHaveCount(0);
  await help.click();
  const panel = helpPanel(page, "Aujourd'hui");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Revoir la visite" }).click();
  await expect(tour.getByRole("heading", { name: "Votre priorité du jour", level: 2 })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);
  await expect(help).toBeFocused();

  // Un écran sans visite : le même « ? » ouvre le même tiroir, avec le seul texte d'aide de l'écran.
  await page.goto("/taches");
  await help.click();
  await expect(help).toHaveAttribute("aria-expanded", "true");
  const tasksPanel = helpPanel(page, "Les tâches de tous vos mariages");
  await expect(tasksPanel).toContainText("triées par échéance");
  await expect(tasksPanel.getByRole("button", { name: "Revoir la visite" })).toHaveCount(0);
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
  await expect(page.getByRole("region", { name: "Évènements" }).getByRole("link", { name: /Liste des évènements/ })).toBeVisible();
  violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  // L'aide de la console d'Administration n'est pas proposée à l'équipe.
  await expect(page.getByRole("heading", { name: "Exploitation de la suite" })).toHaveCount(0);
  await page.getByLabel("Rechercher dans l'aide").fill("TVA");
  await expect(page.getByRole("link", { name: /Entreprise et TVA/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Liste des évènements/ })).toHaveCount(0);
  await expect(page.locator(".help-search").getByRole("status")).toContainText("Écrans trouvés");

  await page.getByLabel("Rechercher dans l'aide").fill("xyznotfound");
  await expect(page.getByText("Aucun article ne correspond à votre recherche.")).toBeVisible();
});
