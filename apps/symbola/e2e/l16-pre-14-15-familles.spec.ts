// Lot 16 (L16-PRE-14, L16-PRE-15, ADR 0040) — familles de types de prestataires :
// une organisation existante voit ses types rangés par famille dans le
// carnet, puis renomme, fusionne, scinde « Beauté et tenues » et supprime un
// type en déplaçant ses fiches. Ordinateur et 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { createVendor, createVendorType } from "../modules/vendors/service";
import { readyOrganization, signIn as signInByLink } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function login(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

const families = (page: Page) => page.getByRole("navigation", { name: "Familles de prestataires" });
const panel = (page: Page, title: string) => page.getByRole("complementary", { name: title });
const typesTable = (page: Page) => page.getByRole("region", { name: "Tableau des types" });

test("L16-PRE-14 / L16-PRE-15 — types rangés par famille, renommés, fusionnés, familles scindées", async ({ page }) => {
  test.slow();
  const email = `planner-familles-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-familles";
  const { sql, db } = createAppConnection();
  let organizationId: string;
  try {
    organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    await createUser(db, { organizationId, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  // Organisation antérieure au lot 16 : des types créés un par libellé par un import.
  const types: Record<string, string> = {};
  for (const label of ["Coiffeur(se)", "Maquillage", "Robe de mariée", "Mannequin"]) types[label] = (await createVendorType(organizationId, label, "#78716c")).id;
  await createVendor(organizationId, { name: "Studio Brune", typeId: types["Coiffeur(se)"]!, city: "Lille" });
  await createVendor(organizationId, { name: "Salon Rivière", typeId: types["Maquillage"]!, city: "Arras" });
  await createVendor(organizationId, { name: "Atelier Ivoire", typeId: types["Robe de mariée"]!, city: "Douai" });
  await createVendor(organizationId, { name: "Agence Silhouette", typeId: types["Mannequin"]!, city: "Lens" });
  await login(page, email, password);

  // L16-PRE-14 — carnet : pastilles par famille non vide, « à classer » signalé.
  await page.goto("/prestataires");
  await expect(families(page).getByRole("link", { name: "Tous · 4" })).toBeVisible();
  await expect(families(page).getByRole("link", { name: "Beauté et tenues · 3" })).toBeVisible();
  await expect(families(page).getByRole("link", { name: "À classer · 1" })).toBeVisible();
  await expect(families(page).getByRole("link", { name: /Traiteur/ })).toHaveCount(0);
  await expect(page.getByText("1 prestataire à classer :")).toBeVisible();
  // Sur téléphone, les familles tiennent sur une ligne défilante.
  if (page.viewportSize()!.width < 640) expect((await families(page).boundingBox())!.height).toBeLessThan(60);
  await expectNoAxeViolation(page);

  await families(page).getByRole("link", { name: "Beauté et tenues · 3" }).click();
  const second = page.getByRole("navigation", { name: "Types de la famille Beauté et tenues" });
  await expect(second.getByRole("link", { name: "Toute la famille · 3" })).toHaveAttribute("aria-current", "true");
  await expect(second.getByRole("link", { name: "Coiffeur(se) · 1" })).toBeVisible();
  const results = page.getByRole("region", { name: /^\d+ résultats?/ });
  await expect(results).toContainText("Atelier Ivoire");
  await expect(results).not.toContainText("Agence Silhouette");
  await second.getByRole("link", { name: "Robe de mariée · 1" }).click();
  await expect(results.getByRole("heading", { level: 2 })).toHaveText("1 résultat");
  await expectNoAxeViolation(page);

  // L16-PRE-15 — renommer un type : les fiches suivent.
  await page.goto("/prestataires/parametres");
  await expect(page.getByRole("heading", { level: 1, name: "Familles et types de prestataires" })).toBeVisible();
  await typesTable(page).getByRole("link", { name: "Maquillage", exact: true }).click();
  await panel(page, "Maquillage").getByLabel("Nom du type").fill("Coiffure et maquillage");
  await panel(page, "Maquillage").getByRole("button", { name: "Enregistrer le type" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Type enregistré." })).toBeVisible();
  await expectNoAxeViolation(page);

  // Fusionner « Coiffeur(se) » dans « Coiffure et maquillage ».
  await page.goto("/prestataires/parametres");
  await typesTable(page).getByRole("link", { name: "Coiffeur(se)", exact: true }).click();
  const hair = panel(page, "Coiffeur(se)");
  await hair.getByLabel("Fusionner « Coiffeur(se) » dans").selectOption({ label: "Coiffure et maquillage" });
  await hair.getByRole("button", { name: "Continuer" }).click();
  await expect(panel(page, "Coiffeur(se)")).toContainText("1 fiche passera de « Coiffeur(se) » à « Coiffure et maquillage ».");
  await panel(page, "Coiffeur(se)").getByRole("button", { name: "Fusionner « Coiffeur(se) » dans « Coiffure et maquillage »" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Types fusionnés" })).toBeVisible();
  await expect(typesTable(page).getByRole("link", { name: "Coiffeur(se)", exact: true })).toHaveCount(0);

  // Les familles appartiennent à l'organisation : « Tenues » créée, « Beauté et tenues » renommée « Beauté ».
  await page.goto("/prestataires/parametres");
  await page.getByRole("link", { name: "Nouvelle famille" }).click();
  const newFamily = panel(page, "Nouvelle famille");
  await newFamily.getByLabel("Nom de la famille").fill("Tenues");
  await newFamily.getByLabel("Pictogramme").selectOption("attire");
  await newFamily.getByRole("button", { name: "Créer la famille" }).click();
  await expect(panel(page, "Tenues")).toBeVisible();
  await expectNoAxeViolation(page);
  await page.goto("/prestataires/parametres");
  await typesTable(page).getByRole("link", { name: "Robe de mariée", exact: true }).click();
  await panel(page, "Robe de mariée").getByLabel("Famille").selectOption({ label: "Tenues" });
  await panel(page, "Robe de mariée").getByRole("button", { name: "Enregistrer le type" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Type enregistré." })).toBeVisible();
  await page.goto("/prestataires/parametres");
  await page.getByRole("region", { name: "Tableau des familles" }).getByRole("link", { name: "Beauté et tenues" }).click();
  await panel(page, "Beauté et tenues").getByLabel("Nom de la famille").fill("Beauté");
  await panel(page, "Beauté et tenues").getByRole("button", { name: "Enregistrer la famille" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Famille enregistrée." })).toBeVisible();

  // Supprimer un type qui a une fiche : il faut dire où elle va.
  await page.goto("/prestataires/parametres");
  await typesTable(page).getByRole("link", { name: "Mannequin", exact: true }).click();
  const model = panel(page, "Mannequin");
  await model.getByLabel("Déplacer sa fiche vers").selectOption({ label: "Aucun type (à classer)" });
  await model.getByRole("button", { name: "Supprimer « Mannequin » et déplacer ses fiches" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Type supprimé" })).toBeVisible();
  await expectNoAxeViolation(page);

  // Le carnet suit : deux familles, et la fiche sans type reste « à classer ».
  await page.goto("/prestataires");
  await expect(families(page).getByRole("link", { name: "Beauté · 2" })).toBeVisible();
  await expect(families(page).getByRole("link", { name: "Tenues · 1" })).toBeVisible();
  await expect(families(page).getByRole("link", { name: "À classer · 1" })).toBeVisible();
  if (page.viewportSize()!.width >= 1024) {
    const legend = page.getByRole("list", { name: "Légende de la carte" });
    await expect(legend).toContainText("Beauté");
    await expect(legend).toContainText("Tenues");
  }
});
