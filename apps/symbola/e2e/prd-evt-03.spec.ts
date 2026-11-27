// PRD-EVT-03 — lignes du budget (lot 12, ex-« postes ») : liste par défaut (modèle de départ),
// barre d'avancement, prestataire retenu (nom obligatoire avec un montant, montant
// facultatif ; lot 28a, PRE-02), case « Non requis », postes modifiables
// évènement par évènement. En
// taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { closeSlotWindow, openEventTab, openSlotRubric, readyOrganization, signIn as signInByLink, slotWindow } from "./helpers";
import { createEventByForm } from "./new-event";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("PRD-EVT-03 — lignes du budget par défaut, barre d'avancement et prestataire retenu", async ({ page }) => {
  const email = `planner-evt03-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-evt03-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Liste par défaut : modèle de départ, puis ajustement.
  await page.goto("/events/parametres");
  await page.getByRole("button", { name: "Charger le modèle de départ" }).click();
  await expect(page.getByText("12 lignes ajoutées depuis le modèle de départ.")).toBeVisible();
  await page.getByRole("button", { name: "Retirer la ligne « Transport des invités »" }).click();
  await expect(page.getByRole("button", { name: "Retirer la ligne « Transport des invités »" })).toHaveCount(0);
  await page.getByRole("button", { name: "Charger le modèle de départ" }).click();
  await expect(page.getByText("1 ligne ajoutée depuis le modèle de départ.")).toBeVisible();
  await page.getByRole("button", { name: "Retirer la ligne « Transport des invités »" }).click();
  await expect(page.getByRole("button", { name: "Retirer la ligne « Transport des invités »" })).toHaveCount(0);
  // Lot 13 (L13-HUB-16) : les sources ont leur rubrique.
  await page.goto("/events/parametres/sources");
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await expectNoAxeViolation(page);

  // Un nouvel évènement reçoit les 11 lignes par défaut.
  await createEventByForm(page, { name: "Camille", clientFirstName: "Camille" });
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Aucune ligne pourvue sur 11")).toBeVisible();
  await expectNoAxeViolation(page);

  // Onglet Budget : un clic sur une ligne ouvre sa fenêtre (lot 65b, M14) ; ses réglages sont dans
  // « Réglages du poste ».
  await openEventTab(page, "Budget");
  await expect(page.getByText("Aucune ligne pourvue sur 11")).toBeVisible();
  await page.getByRole("button", { name: "Photographe", exact: true }).click();
  await openSlotRubric(page, "Photographe", "Réglages du poste");

  // Un montant exige le nom du prestataire retenu ; le montant est facultatif.
  const photographer = slotWindow(page, "Photographe").getByRole("group", { name: "Photographe" });
  await expect(photographer.getByText("À trouver")).toBeVisible();
  await photographer.getByLabel("Montant de son devis en euros (facultatif)").fill("2 500,50");
  await photographer.getByRole("button", { name: "Enregistrer la ligne" }).click();
  await expect(photographer.getByText("Indiquez le nom du prestataire retenu pour saisir un montant.")).toBeVisible();
  await photographer.getByLabel("Ajouter un prestataire retenu (nom)").fill("Studio Lumière");
  await photographer.getByRole("button", { name: "Enregistrer la ligne" }).click();
  await expect(photographer.getByText("Ligne enregistrée.")).toBeVisible();
  await closeSlotWindow(page, "Photographe");
  await expect(page.getByText("1 ligne pourvue sur 11")).toBeVisible();
  const photographerRow = page.getByRole("row", { name: /^Photographe/ });
  await expect(photographerRow).toContainText("Studio Lumière");
  await expect(photographerRow).toContainText("Retenu");
  await expect(photographerRow).toContainText(/2\s500,50\s€/);

  // Une ligne « Non requise » sort du compte des lignes requises.
  await page.getByRole("button", { name: "Vidéaste", exact: true }).click();
  await openSlotRubric(page, "Vidéaste", "Réglages du poste");
  const videographer = slotWindow(page, "Vidéaste").getByRole("group", { name: "Vidéaste" });
  await videographer.getByLabel("Ligne non requise pour cet évènement").check();
  await videographer.getByRole("button", { name: "Enregistrer la ligne" }).click();
  await expect(videographer.getByText("Ligne enregistrée.")).toBeVisible();
  await closeSlotWindow(page, "Vidéaste");
  await expect(page.getByText("1 ligne pourvue sur 10")).toBeVisible();

  // Lignes modifiables évènement par évènement.
  await page.getByLabel("Nouvelle ligne du budget pour cet évènement").fill("Wedding designer");
  await page.getByRole("button", { name: "Ajouter la ligne", exact: true }).click();
  await expect(page.getByRole("button", { name: "Wedding designer", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Papeterie", exact: true }).click();
  await openSlotRubric(page, "Papeterie", "Réglages du poste");
  await slotWindow(page, "Papeterie").getByRole("button", { name: "Retirer la ligne « Papeterie »" }).click();
  await expect(page.getByRole("button", { name: "Papeterie", exact: true })).toHaveCount(0);
  await expect(page.getByText("1 ligne pourvue sur 10")).toBeVisible();
  await expectNoAxeViolation(page);
});
