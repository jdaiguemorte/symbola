// Lot 14b (IMP-07) — reprise des prestataires depuis l'export Excel d'un
// logiciel de planification tiers (fichier entièrement fictif du corpus) :
// colonnes reconnues d'après leur contenu, types rapprochés ou regroupés,
// rapprochement d'une fiche existante, champs libres, confirmation, fiche
// complétée, annulation. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { vendors, vendorTypes } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { openSettingsTab, readyOrganization } from "./helpers";

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
  // Canevas de la carte exclu, comme dans les parcours du carnet (lot 11).
  const result = await new AxeBuilder({ page }).exclude(".vendor-map-canvas").analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("IMP-07 — reprendre ses prestataires depuis l'export Excel de l'outil actuel", async ({ page }) => {
  const email = `planner-imp07-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-imp07-e2e";
  let existingId = "";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    existingId = await withOrganization(db, organization.id, async (tx) => {
      await tx.insert(vendorTypes).values({ organizationId: organization.id, label: "Photographe", color: "#2f5d7c", position: 0 });
      const [vendor] = await tx.insert(vendors).values({ organizationId: organization.id, name: "Domaine des Tilleuls", city: "Poitiers", phone: "05 00 00 00 00" }).returning();
      return vendor!.id;
    });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  await openSettingsTab(page, "Importer");
  await page.getByLabel("Prestataires du carnet (une ligne par prestataire)").check();
  // Corpus de test (Playwright est lancé depuis apps/symbola).
  await page
    .getByLabel("Fichier (CSV, Excel .xlsx ou JSON)")
    .setInputFiles(path.resolve(process.cwd(), "../../packages/testing/import-corpus/files/logiciel-tiers/prestataires.xlsx"));
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  await page.getByRole("link", { name: "Continuer : reconnaître les colonnes" }).click();

  // Colonnes : « Site Internet » et « Critères avancés » suivent leur contenu.
  await expect(page.getByText("Proposé d'après le contenu de la colonne, pas son intitulé (colonnes inversées dans le fichier) : vérifiez.")).toHaveCount(2);
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Enregistrer les colonnes" }).click();
  await page.getByRole("link", { name: "Continuer : rapprocher des éléments existants" }).click();

  // Types : « Photographe » est rapproché du type du carnet ; « Photographe &
  // Vidéaste » y est regroupé à la main.
  const typesSection = page.getByRole("region", { name: "Types de prestataires du fichier" });
  await expect(typesSection.getByLabel("Type de carnet pour « Photographe »")).toHaveValue(/.+/);
  await typesSection.getByLabel("Type de carnet pour « Photographe & Vidéaste »").selectOption({ label: "Photographe" });
  await typesSection.getByRole("button", { name: "Enregistrer les types" }).click();
  await expect(typesSection.getByLabel("Type de carnet pour « Photographe & Vidéaste »")).toHaveValue(/.+/);
  await expectNoAxeViolation(page);

  await page.getByRole("button", { name: "Valider le rapprochement proposé" }).click();
  await page.getByRole("link", { name: "Continuer : rapport des écarts" }).click();
  for (const column of ["Tva Intracommunautaire", "Code APE", "Statut Juridique"]) {
    await page.getByRole("group", { name: column }).getByLabel("Garder en champ libre sur la fiche").check();
  }
  await page.getByRole("group", { name: "Département" }).getByLabel("Ignorer").check();
  await page.getByRole("button", { name: "Enregistrer les choix" }).click();
  await page.getByRole("link", { name: "Continuer : aperçu et confirmation" }).click();

  await expect(page.getByText("24 créations, 1 mise à jour, aucune ligne rejetée.")).toBeVisible();
  await expect(page.getByText(/Ligne \d+ : Château de la Roche Fictive — Niort/)).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Confirmer l'import" }).click();
  await expect(page.getByText("24 créations, 1 mise à jour, aucune ligne inchangée, aucune ligne rejetée")).toBeVisible();

  // La fiche existante est complétée : site, SIRET, champs importés, étiquettes.
  await page.goto(`/prestataires/${existingId}`);
  await expect(page.getByRole("link", { name: "Site web" })).toHaveAttribute("href", "https://www.domaine-tilleuls.example.org");
  await expect(page.getByLabel("N° SIRET")).toHaveValue("12345678900011");
  const imported = page.getByRole("region", { name: "Champs importés" });
  await expect(imported).toContainText("Code APE");
  await expect(imported).toContainText("5510Z");
  await expect(page.getByLabel("Hébergement sur place")).toBeChecked();
  await expectNoAxeViolation(page);

  // Annulation : la fiche existante retrouve ses valeurs, les créées disparaissent.
  await page.goto("/import");
  await page.getByRole("link", { name: "prestataires.xlsx" }).click();
  await page.getByRole("button", { name: "Annuler l'import" }).click();
  await expect(page.getByText(/éléments annulés ; aucun gardé car modifié ; aucun gardé car utilisé\./)).toBeVisible();
  await expectNoAxeViolation(page);
  await page.goto(`/prestataires/${existingId}`);
  await expect(page.getByRole("link", { name: "Site web" })).toHaveCount(0);
  await expect(page.getByLabel("Téléphone")).toHaveValue("05 00 00 00 00");
  await page.goto("/prestataires");
  await expect(page.getByText("Château de la Roche Fictive")).toHaveCount(0);
});
