// Lot 13 (L13-PRE-12) — carnet de prestataires : types en pastilles avec leur
// nombre ; lot 73b : la liste ou la carte, et le nom qui ouvre la fiche.
// Géocodeur simulé, pas de fond de carte installé.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { createVendor } from "../modules/vendors/service";
import { readyOrganization, signIn as signInByLink } from "./helpers";
import { bookFilters, bookResults, closeBookFilters } from "./vendor-book";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function login(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

// Lot 73b (V2, V3 ; P6) : la carte devient une vue (« Liste · Carte », l'une ou l'autre, à toutes les
// tailles) ; le nom ouvre la fiche directement, l'aperçu latéral et `?fiche=` disparaissent.
test("L13-PRE-12 — la vue « Liste · Carte » ; le nom ouvre la fiche (lot 73b, V2, V3)", async ({ page }) => {
  const email = `planner-carnet-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-carnet";
  const { sql, db } = createAppConnection();
  let organizationId: string;
  try {
    organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    await createUser(db, { organizationId, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  const { vendor: verdier } = await createVendor(organizationId, { name: "Maison Verdier", typeId: null, city: "Lille", phone: "03 20 00 00 00" });
  await createVendor(organizationId, { name: "Studio Lumière", typeId: null, city: "Arras" });
  await login(page, email, password);

  await page.goto("/prestataires");
  // Lot 16 (L16-PRE-14) : pastilles par famille ; ces fiches sans type sont « à classer ».
  await expect(page.getByRole("navigation", { name: "Familles de prestataires" }).getByRole("link", { name: "Tous · 2" })).toBeVisible();
  const list = bookResults(page);
  await expect(list.getByRole("link", { name: "Maison Verdier", exact: true })).toBeVisible();

  // La liste ou la carte, jamais les deux.
  const map = page.getByRole("region", { name: /Carte : 2 prestataires placés/ });
  await expect(map).toHaveCount(0);
  await page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: "Carte" }).click();
  await expect(map).toBeVisible();
  await expect(page.locator("table.vendor-table")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: "Liste" }).click();
  await expect(list.getByRole("link", { name: "Maison Verdier", exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/vue=carte/);

  // La recherche filtre ; le nom ouvre la fiche, en un clic.
  const filters = await bookFilters(page);
  await filters.getByLabel("Rechercher").fill("verdier");
  await expect(page).toHaveURL(/q=verdier/);
  await closeBookFilters(page);
  await expect(list).toContainText("03 20 00 00 00");
  await expectNoAxeViolation(page);
  await list.getByRole("link", { name: "Maison Verdier", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/prestataires/${verdier.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Maison Verdier" })).toBeVisible();
});
