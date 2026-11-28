// ONB-01/02 — questionnaire d'onboarding interruptible/reprenable,
// changement de régime de TVA daté, seuils de franchise Admin.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { completeSetup } from "../modules/hub/service";
import { expect, test, type Page } from "@playwright/test";
import { readyOrganization, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, /\/(exploitation)?$/);
}

// Lot 72b (C-18 ; J5) : le bandeau du haut de l'accueil est devenu l'étape « Régler l'essentiel » de « Pour
// bien démarrer », qui guide vers la fiche entreprise sans jamais bloquer l'entrée.
test("ONB-01-01 — « Pour bien démarrer » guide vers la fiche entreprise incomplète, sans bloquer l'accès", async ({ page }) => {
  const email = `titulaire-onb-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-onb-e2e";

  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await completeSetup(db, organization.id);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, email, password);
  // L'accueil reste accessible : aucune redirection forcée (PRD : ne
  // jamais bloquer l'entrée dans la plateforme).
  const firstSteps = page.getByRole("region", { name: "Pour bien démarrer" });
  await expect(firstSteps).toContainText("0 étape faite sur 4");
  await expect(page.getByText("Votre fiche entreprise n'est pas encore complète.")).toHaveCount(0);

  // Lot 74f (C-68, C-10) : la fiche entreprise est demandée quand elle sert, à l'étape « Devis et factures »
  // du parcours, dont « Régler l'essentiel » est la première marche.
  await firstSteps.getByRole("link", { name: "Voir le parcours" }).click();
  await expect(page).toHaveURL(/\/tutoriels$/);
  await page.getByRole("link", { name: "Régler l'essentiel : société, adresse, TVA" }).click();
  await expect(page).toHaveURL(/\/demarrage\/essentiel$/, { timeout: 20_000 });
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);
});

test("ONB-01-02 — chaque étape sauvegardée survit à une interruption", async ({
  page,
}) => {
  const email = `titulaire-onb2-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-onb-e2e";

  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, email, password);
  await page.goto("/parametres/entreprise");

  // Étape 1, puis « interruption » (on quitte la page).
  await page.getByLabel("SIREN").fill("123456789");
  await page.getByLabel("Forme juridique").selectOption("sasu");
  await page.getByLabel("Métier").selectOption("wedding_planner");
  // Lot 74h : la fiche s'enregistre par sa barre, qui dit l'heure.
  await page.getByRole("button", { name: "Enregistrer la fiche" }).click();
  await expect(page.getByText(/^Tout est enregistré · à /)).toBeVisible();

  // Reprend plus tard : le SIREN déjà saisi est toujours là.
  await page.goto("/parametres/entreprise");
  await expect(page.getByLabel("SIREN")).toHaveValue("123456789");

  await page.getByRole("button", { name: "Changer de régime…" }).click();
  await page.getByLabel("Date d'effet").fill("2027-01-01");
  await page.getByRole("button", { name: "Changer de régime", exact: true }).click();
  await expect(page.getByText("Régime de TVA mis à jour.")).toBeVisible();
});

test("ONB-02-01 — l'Admin fixe les seuils de franchise, jamais codés en dur", async ({ page }) => {
  const adminEmail = `admin-onb-${randomUUID()}@symbola.test`;
  const adminPassword = "mot-de-passe-admin-onb-e2e";

  const { sql, db } = createAppConnection();
  try {
    await createUser(db, { organizationId: null, email: adminEmail, password: adminPassword, role: "admin" });
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, adminEmail, adminPassword);
  await page.goto("/exploitation/parametres");
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  await page.getByLabel("Seuil de franchise — prestations de services (€)").fill("37500");
  await page.getByLabel("Seuil de franchise — vente de marchandises (€)").fill("85000");
  // Lot 31a : l'écran porte aussi « Enregistrer la liste » (mentions obligatoires).
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Seuil de franchise — prestations de services (€)")).toHaveValue("37500");
});
