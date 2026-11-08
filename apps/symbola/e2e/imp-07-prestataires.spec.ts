// Lot 14b (IMP-07) — reprise des prestataires depuis l'export Excel d'un
// logiciel de planification tiers (fichier entièrement fictif du corpus) :
// colonnes reconnues d'après leur contenu, types rapprochés ou regroupés,
// rapprochement d'une fiche existante, champs libres, confirmation, fiche
// complétée, annulation. En taille ordinateur et en 375 px, axe-core.
// Lot 16 (IMP-11, IMP-12) : le même parcours dans l'assistant linéaire.
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
  const result = await new AxeBuilder({ page }).analyze();
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
  // Lot 16 (IMP-11) : « Que voulez-vous reprendre ? » en trois tuiles.
  await page.getByRole("navigation", { name: "Que voulez-vous reprendre ?" }).getByRole("link", { name: /Reprendre mes prestataires/ }).click();
  // Corpus de test (Playwright est lancé depuis apps/symbola).
  await page
    .getByLabel("Fichier (CSV, Excel .xlsx ou JSON)")
    .setInputFiles(path.resolve(process.cwd(), "../../packages/testing/import-corpus/files/logiciel-tiers/prestataires.xlsx"));
  await page.getByRole("button", { name: "Lire le fichier" }).click();

  // Colonnes : export reconnu, rien à décider (« Site Internet » et « Critères
  // avancés » suivent leur contenu ; département ignoré, TVA, APE et statut en
  // champ libre) : l'étape est faite d'office, l'assistant ouvre « Types ».
  await expect(page).toHaveURL(/\/types$/);
  const steps = page.getByRole("navigation", { name: "Étapes de l'import" });
  await expect(steps.getByRole("listitem").filter({ hasText: "Colonnes" })).toContainText(/colonnes reconnues, 3 en champ libre, 1 ignorée/);
  await expect(steps.getByRole("listitem").filter({ hasText: "Types" })).toHaveAttribute("aria-current", "step");
  await expectNoAxeViolation(page);

  // IMP-12 — types par famille : « Photographe » rejoint le type du carnet ;
  // « Coiffeur(se) » et « Maquillage », le type de départ « Coiffure et maquillage ».
  const beauty = page.getByRole("region", { name: "Types du fichier — Beauté et tenues" });
  await expect(beauty.getByLabel("Ce que devient « Coiffeur(se) »")).toHaveValue("starter:hair_makeup");
  await expect(beauty.getByLabel("Ce que devient « Maquillage »")).toHaveValue("starter:hair_makeup");
  const photo = page.getByRole("region", { name: "Types du fichier — Photo et vidéo" });
  await expect(photo.getByLabel("Ce que devient « Photographe »")).toHaveValue(/^existing:/);
  await photo.getByLabel("Ce que devient « Photographe & Vidéaste »").selectOption({ label: "Photographe" });
  await page.getByRole("group", { name: "Actions de l'étape" }).getByRole("button", { name: "Continuer" }).click();

  // Doublons : la fiche existante est proposée en mise à jour.
  await expect(page).toHaveURL(/\/rapprochements/);
  await expect(page.getByRole("navigation", { name: "Filtrer les lignes" }).getByRole("link", { name: "À vérifier · 1" })).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: /Mettre à jour l'existant pour Domaine des Tilleuls/ }).click();
  await expect(page.getByRole("navigation", { name: "Filtrer les lignes" }).getByRole("link", { name: "Mises à jour · 1" })).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("group", { name: "Actions de l'étape" }).getByRole("button", { name: "Continuer" }).click();

  // Vérifier et confirmer : bilan des effets, valeurs après correction.
  await expect(page).toHaveURL(/\/confirmation$/);
  const effects = page.getByRole("region", { name: "Ce que va faire l'import" });
  await expect(effects.getByRole("definition").first()).toHaveText("24");
  await expect(page.getByText(/Ligne \d+ : Château de la Roche Fictive — \d{5} Niort/)).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Importer 25 prestataires" }).click();
  await expect(page.getByText("24 créations, 1 mise à jour, aucune ligne inchangée, aucune ligne rejetée")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir les 25 prestataires" })).toBeVisible();
  // Lot 15 (GEO-01) : le placement sur la carte se fait ensuite, avec son avancement.
  const placement = page.getByRole("region", { name: "Placement sur la carte" });
  await expect(placement).toContainText(/prestataires? placés?/, { timeout: 30_000 });
  await expectNoAxeViolation(page);

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
