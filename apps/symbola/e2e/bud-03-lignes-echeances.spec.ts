// Lot 28b — lignes sous chaque catégorie (BUD-01, Q33), échéancier des
// prestataires et rappels dans « Aujourd'hui » (BUD-03, D7, D12, D13). En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { parisToday } from "@symbola/i18n";
import { expect, test, type Page } from "@playwright/test";
import { addDefaultVendorSlots, addVendorCandidate, createProspect, createProspectSource, listEventVendorSlots } from "../modules/events/service";
import { updateBudgetLine } from "../modules/budget/service";
import { readyOrganization, signIn as signInByLink } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function plannerLogin(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

const PASSWORD = "mot-de-passe-budget-28b";

function inDays(days: number): string {
  return new Date(Date.parse(`${parisToday()}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

test("BUD-01 / BUD-03 — une catégorie à plusieurs lignes, l'échéancier d'un prestataire et son rappel dans « Aujourd'hui »", async ({ page }) => {
  const email = `planner-bud28b-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let userId: string;
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    organizationId = organization.id;
    userId = (await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" })).id;
  } finally {
    await sql.end();
  }
  await addDefaultVendorSlots(organizationId, ["Traiteur"]);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: source.id, clients: [{ firstName: "Léa" }] });
  const [caterer] = await listEventVendorSlots(organizationId, event.id);
  await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer!.id, vendorName: "Maison Haddad" });
  await updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId: caterer!.id, field: "estimated", amountCents: 1087100, changedByUserId: userId });
  await plannerLogin(page, email, PASSWORD);

  await page.goto(`/budget/${event.id}`);
  await page.waitForLoadState("networkidle");
  const table = page.getByRole("table", { name: "Estimé, devisé, engagé, payé" });
  const lineRow = (label: string) => table.getByRole("row").filter({ hasText: `Modifier « ${label} »` });
  // Lot 28b : le formulaire d'une ligne s'ouvre dans une rangée pleine largeur, sous la ligne.
  const editor = (label: string) => page.getByRole("region", { name: `Ligne « ${label} » : montants, prestataire, documents et échéances` });
  const openLine = async (label: string) => {
    if (!(await editor(label).isVisible())) await lineRow(label).getByRole("button", { name: `Modifier « ${label} »` }).click();
    await expect(editor(label)).toBeVisible();
  };

  // La ligne de la simulation devient « Dîner, 120 couverts », du traiteur.
  await openLine("Traiteur");
  await editor("Traiteur").getByLabel("Libellé de la ligne « Traiteur »").fill("Dîner, 120 couverts");
  await editor("Traiteur").getByLabel("Prestataire de la ligne « Traiteur »").selectOption({ label: "Maison Haddad" });
  await editor("Traiteur").getByRole("button", { name: "Enregistrer le libellé, le prestataire et la TVA" }).click();
  const dinner = lineRow("Dîner, 120 couverts");
  await expect(dinner).toContainText("Maison Haddad");

  // Une seconde ligne dans la catégorie.
  const category = table.getByRole("rowgroup", { name: "Traiteur" });
  await category.getByRole("button", { name: "Ajouter une ligne à « Traiteur »" }).click();
  const newLine = page.getByRole("region", { name: "Nouvelle ligne de « Traiteur »" });
  await newLine.getByLabel("Libellé de la nouvelle ligne de « Traiteur »").fill("Vin d'honneur");
  await newLine.getByLabel("Prestataire de la nouvelle ligne de « Traiteur »").selectOption({ label: "Maison Haddad" });
  await newLine.getByRole("button", { name: "Ajouter une ligne" }).click();
  await expect(lineRow("Vin d'honneur")).toContainText("Maison Haddad");
  await expectNoAxeViolation(page);

  // Engagés : 6 600 € et 3 000 € (9 600 € pour le traiteur).
  for (const [label, amount] of [
    ["Dîner, 120 couverts", "6 600"],
    ["Vin d'honneur", "3 000"],
  ] as const) {
    await openLine(label);
    await editor(label).getByLabel(`Engagé — ${label}`).fill(amount);
    await editor(label).getByRole("button", { name: "Enregistrer la ligne" }).click();
    await expect(editor(label).getByText("Ligne enregistrée.")).toBeVisible();
  }
  await expect(category.getByRole("row").first()).toContainText("9 600,00 €");

  // Acompte de 30 % de l'engagé du traiteur (D12), à payer dans deux jours.
  const dinnerEditor = editor("Dîner, 120 couverts");
  await openLine("Dîner, 120 couverts");
  await dinnerEditor.getByLabel("Libellé (acompte, solde…)").fill("Acompte du traiteur");
  await dinnerEditor.getByRole("combobox", { name: /^Montant/ }).selectOption("percent");
  await dinnerEditor.getByLabel("Montant ou pourcentage").fill("30");
  await dinnerEditor.getByLabel("Date d'échéance").fill(inDays(2));
  await dinnerEditor.getByRole("button", { name: "Ajouter l'échéance" }).click();
  await expect(dinnerEditor.getByText("Échéance ajoutée.")).toBeVisible();
  await expect(dinnerEditor).toContainText("2 880,00 €");
  await expectNoAxeViolation(page);

  // Le rappel apparaît dans « Aujourd'hui » (lot 32a : une ligne de la liste des urgences).
  await page.goto("/");
  const reminder = page.getByRole("main").getByRole("listitem").filter({ hasText: "Acompte du traiteur · Maison Haddad" });
  await expect(reminder).toContainText(/2\s880,00\s€/);
  await expect(reminder).toContainText("Attend le client");
  await expectNoAxeViolation(page);

  // Payée : le payé de la ligne en est la somme (D13), le rappel disparaît.
  await page.goto(`/budget/${event.id}`);
  await page.waitForLoadState("networkidle");
  await openLine("Dîner, 120 couverts");
  await dinnerEditor.getByRole("button", { name: "Marquer « Acompte du traiteur » payée" }).click();
  await expect(dinnerEditor).toContainText(/payée le/);
  await expect(dinner).toContainText("3 720,00 €");
  const schedule = page.getByRole("region", { name: "Échéancier des prestataires" });
  await expect(schedule.getByRole("region", { name: "Maison Haddad" })).toContainText("Engagé 9 600,00 € · payé 2 880,00 € · reste 6 720,00 €");
  await expectNoAxeViolation(page);

  await page.goto("/");
  await expect(page.getByRole("main")).not.toContainText("Acompte du traiteur");
});
