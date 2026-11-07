// Lot 14c (IMP-08) — reprise des événements depuis les fiches PDF d'un
// logiciel de planification tiers (fiches entièrement fictives du corpus) :
// dépôt de plusieurs fiches dont une refusée, motif au rapport des écarts,
// statut choisi dans l'aperçu, confirmation, fiche événement complétée
// (coordonnées des mariés, budget souhaité, lieux), annulation. En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { prospectSources } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { openEventTab, openSettingsTab, readyOrganization } from "./helpers";

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

// Corpus de test (Playwright est lancé depuis apps/symbola).
const corpus = (name: string) => path.resolve(process.cwd(), "../../packages/testing/import-corpus/files/logiciel-tiers", name);

test("IMP-08 — reprendre ses événements depuis les fiches PDF de l'outil actuel", async ({ page }) => {
  const email = `planner-imp08-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-imp08-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    await withOrganization(db, organization.id, (tx) => tx.insert(prospectSources).values({ organizationId: organization.id, label: "Outil actuel" }));
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  await openSettingsTab(page, "Importer");
  await page.getByLabel("Fiches événement (PDF, une fiche par événement)").check();
  await page.getByLabel("Fiches événement (PDF, une ou plusieurs)").setInputFiles([
    { name: "fiche-evenement-complete.pdf", mimeType: "application/pdf", buffer: readFileSync(corpus("fiche-evenement-complete.pdf")) },
    { name: "fiche-evenement-trois-lieux.pdf", mimeType: "application/pdf", buffer: readFileSync(corpus("fiche-evenement-trois-lieux.pdf")) },
    { name: "pas-une-fiche.pdf", mimeType: "application/pdf", buffer: Buffer.from("Nom;Ville\nA;B", "utf-8") },
  ]);
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Lire le fichier" }).click();

  // Colonnes déjà reconnues : on va directement aux rapprochements, puis aux écarts.
  await expect(page.getByRole("link", { name: "Continuer : reconnaître les colonnes" })).toHaveCount(0);
  await expectNoAxeViolation(page);
  await page.getByRole("link", { name: "Continuer : rapprocher des éléments existants" }).click();
  await expectNoAxeViolation(page);
  await page.getByRole("link", { name: "Continuer : rapport des écarts" }).click();
  await expect(page.getByText("Fiche « pas-une-fiche.pdf » : ce n'est pas un PDF")).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("link", { name: "Continuer : aperçu et confirmation" }).click();

  await expect(page.getByText("2 créations, aucune mise à jour, 1 ligne rejetée.")).toBeVisible();
  const second = page.getByLabel(/Ligne 2 : Chloé PETIT & Antoine ROUX/);
  await expect(second).toHaveValue("confirmed");
  await second.selectOption({ label: "Prospect" });
  await page.getByRole("button", { name: "Enregistrer les statuts" }).click();
  await expect(page.getByLabel(/Ligne 2 : Chloé PETIT & Antoine ROUX/)).toHaveValue("prospect");
  await expectNoAxeViolation(page);

  await page.getByLabel("Source pour les événements sans source").selectOption({ label: "Outil actuel" });
  await page.getByRole("button", { name: "Confirmer l'import" }).click();
  await expect(page.getByText("2 créations, aucune mise à jour, aucune ligne inchangée, 1 ligne rejetée")).toBeVisible();

  // La fiche de Léa et Hugo : budget souhaité, lieux, coordonnées des mariés.
  await page.goto("/events");
  await page.getByRole("link", { name: /Léa & Hugo/ }).first().click();
  await expect(page.getByText("25 000,00 €").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Champs importés" })).toContainText("Cérémonie laïque");
  await openEventTab(page, "Mariés");
  const lea = page.getByRole("form", { name: "Coordonnées de Léa MARTIN" });
  await expect(lea.getByLabel("E-mail")).toHaveValue("lea.martin@example.org");
  await expect(lea.getByLabel("Téléphone")).toHaveValue("06 39 98 01 01");
  await lea.getByLabel("Téléphone").fill("06 39 98 01 09");
  await lea.getByRole("button", { name: "Enregistrer les coordonnées de Léa MARTIN" }).click();
  await expect(lea.getByText("Coordonnées enregistrées.")).toBeVisible();
  await expectNoAxeViolation(page);

  // Annulation : l'événement modifié à la main est signalé ; l'autre disparaît.
  await page.goto("/import");
  await page.getByRole("link", { name: /fiche-evenement-complete\.pdf/ }).click();
  await page.getByRole("button", { name: "Annuler l'import" }).click();
  await expect(page.getByText("1 élément annulé ; 1 gardé car modifié à la main ; aucun gardé car utilisé.")).toBeVisible();
  await expectNoAxeViolation(page);
  await page.goto("/events");
  await expect(page.getByText("Chloé & Antoine")).toHaveCount(0);
});
