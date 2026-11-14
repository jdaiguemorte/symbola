// Lot 28a — BUD-01 (cinq montants : une ligne complète se saisit en un envoi, en
// moins d'une minute), BUD-02 (enveloppe et seuil d'alerte : l'alerte précède
// l'engagement) et PRE-02 (« Retenir » engage, les autres sont écartés). En
// taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import {
  addDefaultVendorSlots,
  addVendorCandidate,
  createProspect,
  createProspectSource,
  listEventVendorSlots,
  setEventWantedBudget,
  updateVendorCandidate,
} from "../modules/events/service";
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

const PASSWORD = "mot-de-passe-budget-28a";

async function weddingWithBudget() {
  const email = `planner-bud28-${randomUUID()}@symbola.test`;
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
  await addDefaultVendorSlots(organizationId, ["Lieu de réception", "Traiteur"]);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: source.id, clients: [{ firstName: "Inès" }] });
  const slots = await listEventVendorSlots(organizationId, event.id);
  const slot = (label: string) => slots.find((entry) => entry.label === label)!;
  return { organizationId, userId, email, eventId: event.id, venue: slot("Lieu de réception"), caterer: slot("Traiteur") };
}

test("BUD-01 — une ligne complète (estimé, devisé, engagé, payé) se saisit en un envoi, en moins d'une minute ; le reste à payer se calcule", async ({ page }) => {
  const wedding = await weddingWithBudget();
  await updateBudgetLine({
    organizationId: wedding.organizationId,
    eventId: wedding.eventId,
    eventVendorSlotId: wedding.caterer.id,
    field: "estimated",
    amountCents: 450000,
    changedByUserId: wedding.userId,
  });
  await plannerLogin(page, wedding.email, PASSWORD);

  await page.goto(`/budget/${wedding.eventId}`);
  await page.waitForLoadState("networkidle");
  const table = page.getByRole("table", { name: "Estimé, devisé, engagé, payé" });
  // Lot 28b : la catégorie « Traiteur » a sa ligne de total ; la ligne se repère par « Modifier ».
  const row = table.getByRole("row").filter({ hasText: "Modifier « Traiteur »" });
  await expect(row).toContainText("4 500,00 €");
  await expectNoAxeViolation(page);

  const started = Date.now();
  await row.getByText("Modifier « Traiteur »").click();
  // Lot 28b : le formulaire s'ouvre dans une rangée pleine largeur, sous la ligne.
  const editor = page.getByRole("region", { name: "Ligne « Traiteur » : montants, prestataire, documents et échéances" });
  await editor.getByLabel("Devisé — Traiteur").fill("4 480");
  await editor.getByLabel("Engagé — Traiteur").fill("4 480");
  await editor.getByLabel("Payé — Traiteur").fill("1 344");
  await editor.getByRole("button", { name: "Enregistrer la ligne" }).click();
  await expect(editor.getByText("Ligne enregistrée.")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(60_000);

  // Cinq montants, l'écart, et les totaux au centime près.
  await expect(row).toContainText("4 480,00 €");
  await expect(row).toContainText("1 344,00 €");
  await expect(row).toContainText("3 136,00 €");
  await expect(row).toContainText("Économie de 20,00 €");
  const totals = table.getByRole("row", { name: /Total/ });
  await expect(totals).toContainText("3 136,00 €");
  await expectNoAxeViolation(page);
});

test("BUD-02 — l'alerte précède l'engagement : le dépassement chiffré du seuil se confirme avant de retenir, puis un bandeau le rappelle", async ({ page }) => {
  const wedding = await weddingWithBudget();
  // Enveloppe de 30 000 € (seuil à 90 % : 27 000 €), lieu déjà engagé à 25 000 €.
  await setEventWantedBudget(wedding.organizationId, wedding.eventId, 3000000);
  await updateBudgetLine({
    organizationId: wedding.organizationId,
    eventId: wedding.eventId,
    eventVendorSlotId: wedding.venue.id,
    field: "committed",
    amountCents: 2500000,
    changedByUserId: wedding.userId,
  });
  const tables = await addVendorCandidate({ organizationId: wedding.organizationId, eventId: wedding.eventId, vendorSlotId: wedding.caterer.id, vendorName: "Les Tables de Flandre" });
  await updateVendorCandidate({ organizationId: wedding.organizationId, candidateId: tables.id, quoteAmountCents: 448000 });
  await addVendorCandidate({ organizationId: wedding.organizationId, eventId: wedding.eventId, vendorSlotId: wedding.caterer.id, vendorName: "Maison Verdier" });
  await plannerLogin(page, wedding.email, PASSWORD);

  await page.goto(`/events/${wedding.eventId}?onglet=budget&poste=${wedding.caterer.id}`);
  await page.waitForLoadState("networkidle");
  const candidates = page.getByRole("region", { name: "Prestataires consultés — Traiteur" });
  const card = candidates.getByRole("listitem", { name: "Les Tables de Flandre" });
  await card.getByRole("button", { name: "Retenir Les Tables de Flandre" }).click();
  await expect(card.getByRole("alert")).toHaveText(
    "Retenir ce prestataire porterait l'engagé à 29 480,00 €, soit 2 480,00 € au-delà du seuil d'alerte (90 % de l'enveloppe).",
  );
  // Rien n'est engagé tant que la planner ne confirme pas.
  await expect(card.getByLabel("Statut")).toHaveValue("quote_received");
  await expectNoAxeViolation(page);

  await card.getByRole("button", { name: "Retenir Les Tables de Flandre malgré le dépassement" }).click();
  await expect(candidates.getByRole("listitem", { name: "Les Tables de Flandre" }).getByLabel("Statut")).toHaveValue("retained");
  await expect(candidates.getByRole("listitem", { name: "Maison Verdier" }).getByLabel("Statut")).toHaveValue("dismissed");

  // L'engagé suit (événement interne traité en différé) ; le bandeau rappelle le dépassement.
  const banner = page.getByRole("alert").filter({ hasText: "L'engagé dépasse de 2 480,00 € le seuil d'alerte (90 % de l'enveloppe)." });
  await expect(async () => {
    await page.reload();
    await expect(banner).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expectNoAxeViolation(page);

  // Sur le budget : enveloppe, seuil, alerte ; le seuil se relève pour cet événement.
  await page.goto(`/budget/${wedding.eventId}`);
  await page.waitForLoadState("networkidle");
  const envelope = page.getByRole("region", { name: "Enveloppe et seuil d'alerte" });
  await expect(envelope).toContainText("Budget souhaité du client");
  await expect(envelope).toContainText("30 000,00 €");
  // Écart à l'enveloppe : 30 000 € − 29 480 € engagés.
  await expect(envelope.getByRole("definition").filter({ hasText: "520,00 €" })).toBeVisible();
  await expect(envelope.getByRole("alert")).toContainText("2 480,00 €");
  await expectNoAxeViolation(page);
  await envelope.getByLabel(/Seuil de cet événement/).fill("100");
  await envelope.getByRole("button", { name: "Enregistrer le seuil" }).click();
  await expect(envelope.getByText("Seuil enregistré.")).toBeVisible();
  await expect(envelope.getByRole("alert")).toHaveCount(0);
});
