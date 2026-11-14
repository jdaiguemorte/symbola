// Lot 28c — taux de TVA d'une ligne et HT pour un client professionnel (BUD-09,
// D5), export XLSX et PDF du budget (BUD-10, D6), évaluation et tarifs
// indicatifs du carnet (PRE-01, D8). En taille ordinateur et en 375 px,
// axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { readImportFile } from "@symbola/import-engine";
import { expect, test, type Page } from "@playwright/test";
import { addDefaultVendorSlots, createProspect, createProspectSource, listEventVendorSlots } from "../modules/events/service";
import { updateBudgetLine } from "../modules/budget/service";
import { createQuote, setQuoteClientKind } from "../modules/quotes/service";
import { createVendor } from "../modules/vendors/service";
import { readyOrganization, signIn as signInByLink } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function plannerLogin(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

const PASSWORD = "mot-de-passe-budget-28c";

async function plannerOrganization() {
  const email = `planner-28c-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const userId = (await createUser(db, { organizationId: organization.id, email, password: PASSWORD, role: "owner" })).id;
    return { organizationId: organization.id, userId, email };
  } finally {
    await sql.end();
  }
}

async function weddingWithCaterer(organizationId: string, userId: string) {
  await addDefaultVendorSlots(organizationId, ["Traiteur"]);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: source.id, clients: [{ firstName: "Léa" }] });
  const [caterer] = await listEventVendorSlots(organizationId, event.id);
  await updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId: caterer!.id, field: "committed", amountCents: 120000, changedByUserId: userId });
  return event.id;
}

test("BUD-09 / BUD-10 — taux de TVA d'une ligne, HT pour un client professionnel, export XLSX et PDF à la mise en forme de l'organisation", async ({ page }) => {
  const planner = await plannerOrganization();
  const eventId = await weddingWithCaterer(planner.organizationId, planner.userId);
  await plannerLogin(page, planner.email, PASSWORD);

  await page.goto(`/budget/${eventId}`);
  await page.waitForLoadState("networkidle");
  // Particulier (aucun devis) : TTC seul.
  await expect(page.getByText("Montants TTC (client particulier).")).toBeVisible();
  const table = page.getByRole("table", { name: "Estimé, devisé, engagé, payé" });
  await expect(table).not.toContainText("HT ");

  // Taux de la ligne : 10 %, saisi comme au catalogue.
  await table.getByRole("button", { name: "Modifier « Traiteur »" }).click();
  const editor = page.getByRole("region", { name: "Ligne « Traiteur » : montants, prestataire, documents et échéances" });
  await expect(editor.getByLabel("Taux de TVA (%) de la ligne « Traiteur »")).toHaveValue("20");
  await editor.getByLabel("Taux de TVA (%) de la ligne « Traiteur »").fill("10");
  await editor.getByRole("button", { name: "Enregistrer le libellé, le prestataire et la TVA" }).click();
  await expect(editor.getByText("Ligne mise à jour.")).toBeVisible();
  await expectNoAxeViolation(page);

  // Export XLSX : feuilles « Budget » et « Échéances », montants en euros.
  const exports = page.getByRole("navigation", { name: "Exporter le budget" });
  const [xlsx] = await Promise.all([page.waitForEvent("download"), exports.getByRole("link", { name: "Exporter en XLSX" }).click()]);
  expect(xlsx.suggestedFilename()).toMatch(/^budget-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const workbook = readImportFile(new Uint8Array(await readFile((await xlsx.path())!)), { maxBytes: 5_000_000, maxRows: 100 });
  expect(workbook.ok).toBe(true);
  if (workbook.ok) {
    expect(workbook.table.headers.slice(0, 6)).toEqual(["Catégorie", "Ligne", "Prestataire", "Estimé TTC", "Devisé TTC", "Engagé TTC"]);
    const total = workbook.table.rows.at(-1)!;
    expect([total[0], total[5]]).toEqual(["Total", "1200"]);
  }
  // Export PDF.
  const [pdf] = await Promise.all([page.waitForEvent("download"), exports.getByRole("link", { name: "Exporter en PDF" }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^budget-\d{4}-\d{2}-\d{2}\.pdf$/);
  expect((await readFile((await pdf.path())!)).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // Le devis de l'événement est à un professionnel : HT sous chaque TTC, sans réglage.
  const quote = await createQuote({ organizationId: planner.organizationId, eventId, createdByUserId: planner.userId });
  await setQuoteClientKind(planner.organizationId, quote.id, "professional");
  await page.reload();
  await expect(page.getByText(/^Client professionnel \(devis de l'événement\)/)).toBeVisible();
  await expect(table.getByRole("row").filter({ hasText: "Modifier « Traiteur »" })).toContainText("HT 1 090,91 €");
  await expectNoAxeViolation(page);

  // L'export d'un événement d'une autre organisation répond comme un objet inexistant.
  const other = await plannerOrganization();
  const otherEventId = await weddingWithCaterer(other.organizationId, other.userId);
  expect((await page.request.get(`/budget/${otherEventId}/export?format=xlsx`)).status()).toBe(404);
  expect((await page.request.get(`/budget/${eventId}/export?format=csv`)).status()).toBe(404);
});

test("PRE-01 — évaluation et tarifs indicatifs d'une fiche du carnet, filtre « au moins 4 »", async ({ page }) => {
  const planner = await plannerOrganization();
  await createVendor(planner.organizationId, { name: "Fleurs d'Élodie", typeId: null, city: "Lille", rating: 5 });
  await createVendor(planner.organizationId, { name: "DJ Nova", typeId: null, city: "Lille", rating: 3 });
  const { vendor: studio } = await createVendor(planner.organizationId, { name: "Studio Lumière", typeId: null, city: "Lille" });
  await plannerLogin(page, planner.email, PASSWORD);

  // Sur la fiche complète : évaluation et tarifs indicatifs.
  await page.goto(`/prestataires/${studio.id}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Évaluation").selectOption({ label: "4 sur 5" });
  await page.getByLabel("Tarifs indicatifs").fill("Forfait journée 1 900 €");
  // Le formulaire se recharge avec la fiche enregistrée : on attend la réponse
  // de l'enregistrement, puis on relit la page.
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes(`/prestataires/${studio.id}`)),
    page.getByRole("button", { name: "Enregistrer", exact: true }).click(),
  ]);
  await page.reload();
  await expect(page.getByLabel("Évaluation")).toHaveValue("4");
  await expect(page.getByLabel("Tarifs indicatifs")).toHaveValue("Forfait journée 1 900 €");
  await expectNoAxeViolation(page);

  // Dans le carnet : « au moins 4 sur 5 » ne garde que les fiches notées 4 ou 5.
  await page.goto("/prestataires?note=4");
  await expect(page.getByLabel("Évaluation")).toHaveValue("4");
  const names = page.locator("[data-vendor-id] > a");
  await expect(names).toHaveText(["Fleurs d'Élodie", "Studio Lumière"]);
  await expect(page.locator(`[data-vendor-id="${studio.id}"]`)).toContainText("4 sur 5");
  await expectNoAxeViolation(page);

  // La fiche ouverte montre l'évaluation et les tarifs.
  await page.goto(`/prestataires?note=4&fiche=${studio.id}`);
  const panel = page.getByRole("complementary").filter({ has: page.getByRole("heading", { name: "Studio Lumière" }) });
  await expect(panel).toContainText("Tarifs indicatifs");
  await expect(panel).toContainText("Forfait journée 1 900 €");
  await expect(panel).toContainText("4 sur 5");
  await expectNoAxeViolation(page);
});
