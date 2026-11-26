// Lot 14c (IMP-08) — reprise des évènements depuis les fiches PDF d'un
// logiciel de planification tiers (fiches entièrement fictives du corpus) :
// dépôt de plusieurs fiches dont une refusée, motif au rapport des écarts,
// statut choisi dans l'aperçu, confirmation, fiche évènement complétée
// (coordonnées des mariés, budget souhaité, lieux), annulation. En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { prospectSources } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { openEventTab, openSettingsTab, readyOrganization, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Corpus de test (Playwright est lancé depuis apps/symbola).
const corpus = (name: string) => path.resolve(process.cwd(), "../../packages/testing/import-corpus/files/logiciel-tiers", name);

// Lot 15 (IMP-10) : les fiches sont lues en tâche de fond ; la page montre
// l'avancement. Lot 16 (IMP-11) : à la fin, l'assistant passe de lui-même à
// l'étape suivante (ici « Vérifier et confirmer » : aucun doublon à vérifier).
async function waitForSheetsRead(page: Page) {
  await expect.poll(() => page.url().endsWith("/confirmation"), { timeout: 30_000 }).toBe(true);
}

test("IMP-08 — reprendre ses évènements depuis les fiches PDF de l'outil actuel", async ({ page }) => {
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
  // Lot 16 (IMP-11) : la tuile « Reprendre mes évènements » ouvre le dépôt des fiches.
  await page.getByRole("navigation", { name: "Que voulez-vous reprendre ?" }).getByRole("link", { name: /Reprendre mes évènements/ }).click();
  await page.getByLabel("Fiches évènement (PDF, une ou plusieurs)").setInputFiles([
    { name: "fiche-evenement-complete.pdf", mimeType: "application/pdf", buffer: readFileSync(corpus("fiche-evenement-complete.pdf")) },
    { name: "fiche-evenement-trois-lieux.pdf", mimeType: "application/pdf", buffer: readFileSync(corpus("fiche-evenement-trois-lieux.pdf")) },
    { name: "pas-une-fiche.pdf", mimeType: "application/pdf", buffer: Buffer.from("Nom;Ville\nA;B", "utf-8") },
  ]);
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Lire le fichier" }).click();

  // Colonnes déjà reconnues ; lecture des fiches suivie, puis « Vérifier et confirmer ».
  await waitForSheetsRead(page);
  await expect(page.getByText("Fiche « pas-une-fiche.pdf » : ce n'est pas un PDF")).toBeVisible();
  // Bilan : 2 créations, aucune mise à jour, les colonnes de la fiche gardées en champ libre, 1 fiche rejetée.
  await expect(page.getByRole("region", { name: "Ce que va faire l'import" }).getByRole("definition")).toHaveText(["2", "0", "Note, Total Payé, Solde, Total", "1"]);
  await expectNoAxeViolation(page);

  const second = page.getByLabel(/Ligne 2 : Chloé PETIT & Antoine ROUX/);
  await expect(second).toHaveValue("confirmed");
  // Lot 63a (HUB-14, recette du 21/11) : le statut choisi s'enregistre dès le choix et reste
  // affiché, après l'enregistrement comme après un rechargement (le bouton « Enregistrer les
  // statuts » réaffichait le statut du fichier).
  await second.selectOption({ label: "En préparation" });
  await expect(page.getByText("Statut enregistré.")).toBeVisible();
  await expect(second).toHaveValue("in_preparation");
  await page.reload();
  await expect(page.getByLabel(/Ligne 2 : Chloé PETIT & Antoine ROUX/)).toHaveValue("in_preparation");
  await page.getByLabel(/Ligne 2 : Chloé PETIT & Antoine ROUX/).selectOption({ label: "Option" });
  await expect(page.getByText("Statut enregistré.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/Ligne 2 : Chloé PETIT & Antoine ROUX/)).toHaveValue("option");
  await expectNoAxeViolation(page);

  await page.getByLabel("Source pour les évènements sans source").selectOption({ label: "Outil actuel" });
  await page.getByRole("button", { name: "Importer 2 évènements" }).click();
  // Lot 63b (HUB-14, UX-07) : le bilan d'abord ; le détail du journal est replié.
  await page.getByText("Détails du journal (fichier, auteur, dates)").click();
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

  // Annulation : l'évènement modifié à la main est signalé ; l'autre disparaît.
  await page.goto("/import");
  await page.getByRole("link", { name: /fiche-evenement-complete\.pdf/ }).click();
  // Lot 63b (HUB-14, UX-07) : l'annulation est repliée sous le bilan.
  await page.getByText("Annuler cet import", { exact: true }).click();
  await page.getByRole("button", { name: "Annuler l'import" }).click();
  await expect(page.getByText("1 élément annulé ; 1 gardé car modifié à la main ; aucun gardé car utilisé.")).toBeVisible();
  await expectNoAxeViolation(page);
  await page.goto("/events");
  await expect(page.getByText("Chloé & Antoine")).toHaveCount(0);
});
