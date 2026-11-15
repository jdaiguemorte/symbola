// Lot 36b (HUB-14, SC-10, CRM-03 ; D2, D11) — Sophie importe ses 600 contacts : correspondance des
// colonnes proposée, « Catégorie » gardée sur la fiche, prestataires et lieux écartés, un doublon
// d'adresse ignoré, confirmation, puis annulation en bloc. Un foyer relie deux personnes ; une
// entreprise porte son SIRET. En taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { createContact } from "../modules/hub/service";
import { clickMenuLink, readyOrganization, signIn } from "./helpers";

const FILE = path.resolve(process.cwd(), "../../docs/recette/contacts-import-test-600.csv");

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function atelier(label: string) {
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID()}`);
    const email = `${label}-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-contacts-36b", role: "owner" });
    return { organizationId: organization.id, email };
  } finally {
    await sql.end();
  }
}

const continueStep = (page: Page) => page.getByRole("group", { name: "Actions de l'étape" }).getByRole("button", { name: "Continuer" }).click();

test("SC-10 / HUB-14 — importer 600 contacts : colonnes proposées, prestataires écartés, doublon ignoré, puis annulation en bloc", async ({ page }) => {
  test.setTimeout(180_000);
  const { email } = await atelier("sophie");
  await signIn(page, email, /\/$/);

  await clickMenuLink(page, "Contacts");
  await page.getByRole("link", { name: "Importer des contacts" }).click();
  await expect(page).toHaveURL(/\/import\?type=contacts/);
  await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles(FILE);
  await page.getByRole("button", { name: "Lire le fichier" }).click();

  // Colonnes : tout est reconnu, sauf « Catégorie », gardée sur la fiche.
  await expect(page).toHaveURL(/\/colonnes$/);
  await page.getByLabel("Champ pour la colonne « Catégorie »").selectOption("free");
  await expectNoAxeViolation(page);
  await continueStep(page);

  // Lignes : les prestataires et les lieux sont écartés (valeurs regroupées sans casse ni espaces).
  await expect(page).toHaveURL(/\/lignes$/);
  const category = page.getByRole("group", { name: "Écarter des lignes selon « Catégorie »" });
  await category.getByLabel(/^prestataire \(125 lignes\)$/).check();
  await category.getByLabel(/^lieu \(67 lignes\)$/).check();
  await expectNoAxeViolation(page);
  await continueStep(page);

  // Doublons : une adresse déjà vue plus haut complète la première ; l'une est ignorée.
  await expect(page).toHaveURL(/\/rapprochements/);
  const steps = page.getByRole("navigation", { name: "Étapes de l'import" });
  await expect(steps.getByRole("listitem").filter({ hasText: "lignes écartées" })).toContainText("192 lignes écartées");
  await expect(page.getByText(/Même adresse e-mail que la ligne \d+ : cette ligne complète la première\./).first()).toBeVisible();
  await page.getByRole("button", { name: /^Ignorer la ligne / }).first().click();
  await expect(page.getByText("Cette ligne sera ignorée.").first()).toBeVisible();
  await expectNoAxeViolation(page);
  await continueStep(page);

  await expect(page).toHaveURL(/\/confirmation$/);
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: /^Importer \d+ contacts$/ }).click();
  // 192 lignes écartées et le doublon ignoré ne sont pas importés.
  await expect(page.getByText(/\d+ créations, (aucune mise à jour|\d+ mises? à jour), \d+ lignes? inchangées?, 193 lignes rejetées/)).toBeVisible();
  await page.getByRole("link", { name: /^Voir les \d+ contacts$/ }).click();

  // Le contact importé : nom et prénom séparés, la catégorie dans une note.
  await expect(page).toHaveURL(/\/contacts$/);
  await page.getByRole("search", { name: "Chercher un contact" }).getByLabel("Nom, e-mail ou téléphone").fill("HENRY");
  await page.getByRole("button", { name: "Chercher" }).click();
  await page.getByRole("region", { name: "Liste des contacts" }).getByRole("link", { name: "Mathieu HENRY" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Mathieu HENRY" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Notes de l'équipe" })).toContainText("Catégorie : client");
  await expectNoAxeViolation(page);

  // L'annulation en bloc retire les contacts importés.
  await page.goto("/import");
  await page.getByRole("link", { name: "contacts-import-test-600.csv" }).click();
  await page.getByRole("button", { name: "Annuler l'import" }).click();
  await expect(page.getByText(/éléments annulés/)).toBeVisible();
  await expectNoAxeViolation(page);
  await clickMenuLink(page, "Contacts");
  await expect(page.getByText("Aucun contact pour l'instant. Les clients de vos évènements deviennent des contacts.")).toBeVisible();
});

test("CRM-03 / D2 — un foyer relie deux personnes avec leur rôle ; une entreprise porte son SIRET", async ({ page }) => {
  const { organizationId, email } = await atelier("camille");
  const lastName = `Martin${randomUUID().slice(0, 4)}`;
  await createContact(organizationId, { firstName: "Léa", lastName, email: `lea-${randomUUID()}@exemple.test` });
  await createContact(organizationId, { firstName: "Maxime", lastName: "Dubois" });
  await signIn(page, email, /\/$/);

  // Un foyer, créé depuis la liste.
  await page.goto("/contacts");
  await page.waitForLoadState("networkidle");
  await page.locator("summary", { hasText: "Ajouter un contact" }).click();
  const form = page.getByRole("form", { name: "Ajouter un contact" });
  await form.getByRole("radio", { name: "Foyer" }).check();
  await form.getByLabel("Nom du foyer").fill(`Famille ${lastName}`);
  await form.getByRole("button", { name: "Ajouter le contact" }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Famille ${lastName}` })).toBeVisible();
  await expect(page.getByText("Fiche du foyer")).toBeVisible();

  // Léa rejoint le foyer, avec son rôle.
  await page.waitForLoadState("networkidle");
  const members = page.getByRole("region", { name: "Membres du foyer" });
  await expect(members).toContainText("Personne pour l'instant.");
  await members.getByLabel("Cherchez la personne par son nom, son e-mail ou son téléphone").fill(lastName);
  await members.getByRole("button", { name: `Choisir Léa ${lastName}` }).click();
  await members.getByLabel("Rôle (facultatif)").fill("Mariée");
  await members.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(members.getByRole("status").filter({ hasText: "Personne ajoutée." })).toBeVisible();
  await expect(members.getByRole("listitem").filter({ hasText: `Léa ${lastName}` })).toContainText("Mariée");
  await expectNoAxeViolation(page);

  // La fiche de Léa dit de quel foyer elle fait partie.
  await members.getByRole("link", { name: `Léa ${lastName}` }).click();
  await expect(page.getByRole("region", { name: "Foyers et entreprises" })).toContainText(`Famille ${lastName}`);

  // Une entreprise : SIRET nettoyé ; un numéro illisible est refusé.
  await page.goto("/contacts");
  await page.waitForLoadState("networkidle");
  await page.locator("summary", { hasText: "Ajouter un contact" }).click();
  const company = page.getByRole("form", { name: "Ajouter un contact" });
  await company.getByRole("radio", { name: "Entreprise" }).check();
  await company.getByLabel("Raison sociale").fill(`Maison ${lastName}`);
  await company.getByLabel("SIREN ou SIRET").fill("1234");
  await company.getByRole("button", { name: "Ajouter le contact" }).click();
  await expect(company.getByRole("alert")).toContainText("Le SIREN compte 9 chiffres, le SIRET 14.");
  // Après l'erreur, la nature et la raison sociale saisies sont toujours là.
  await expect(company.getByRole("radio", { name: "Entreprise" })).toBeChecked();
  await expect(company.getByLabel("Raison sociale")).toHaveValue(`Maison ${lastName}`);
  await company.getByLabel("SIREN ou SIRET").fill("123 456 789 00012");
  await company.getByRole("button", { name: "Ajouter le contact" }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Maison ${lastName}` })).toBeVisible();
  await expect(page.getByLabel("SIREN ou SIRET")).toHaveValue("12345678900012");
  await expectNoAxeViolation(page);
});
