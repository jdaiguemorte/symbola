// Lot 65g (HUB-14, BUD-04, PRE-02, CHR-08 ; recette staging du 22/11/2026, retours de la testeuse) :
// - un budget importé depuis un évènement va dans cet évènement, sans colonne pour le désigner ;
//   « Catégorie » et « Titre » sont reconnus, les colonnes calculées ignorées d'office, et l'écran
//   des colonnes n'est plus coupé ;
// - un poste vide se supprime depuis sa ligne, après confirmation ;
// - « Importer » sur le programme du jour J ouvre l'import en tête de la carte.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addDefaultVendorSlots, createProspect, createProspectSource } from "../modules/events/service";
import { updateBudgetLine } from "../modules/budget/service";
import { listEventVendorSlots } from "../modules/events/service";
import { readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function wedding() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    const email = `planner-65g-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-65g", role: "owner" });
    await addDefaultVendorSlots(organizationId, ["Traiteur", "Pièce montée / gâteau"]);
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Mélanie", lastName: "Roux" }, { firstName: "Valentin", lastName: "Petit" }], eventDate: "2027-06-12" });
    const caterer = (await listEventVendorSlots(organizationId, event.id)).find((slot) => slot.label === "Traiteur")!;
    await updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId: caterer.id, field: "estimated", amountCents: 800000, changedByUserId: owner.id });
    return { email, eventId: event.id };
  } finally {
    await sql.end();
  }
}

test("HUB-14, BUD-04 — Lot 65g : le budget de la testeuse s'importe depuis l'évènement ; l'écran des colonnes n'est pas coupé", async ({ page }) => {
  test.setTimeout(150_000);
  const setup = await wedding();
  await signIn(page, setup.email);
  await page.goto(`/events/${setup.eventId}?onglet=budget`);
  await page.getByRole("link", { name: "Importer", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/import\\?type=budget_lines&evenement=${setup.eventId}`));
  await expect(page.getByText("Les lignes iront dans l'évènement « Mélanie & Valentin »", { exact: false })).toBeVisible();
  await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles({
    name: "budget-mariage.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      // « Remarque » reste à choisir : l'étape des colonnes s'affiche (sinon elle se passe d'office).
      "Catégorie;Titre;Budget;Réel (devisé);Différence;Somme réglée;Reste à payer;Remarque\n" + "Animation;Photobooth;250;0;-250;0;0;à confirmer\n" + "Boisson;Tireuse et Futs;300;268;-32;0;268;\n",
      "utf-8",
    ),
  });
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  await expect(page).toHaveURL(/\/colonnes$/, { timeout: 30_000 });
  await expect(page.getByText("Symbola en a reconnu 7 sur 8.", { exact: false })).toBeVisible();
  // Chaque liste « devient » se voit en entier : la colonne n'est plus coupée par le cadre (sur
  // ordinateur ; sur téléphone, le tableau défile dans sa largeur).
  if ((page.viewportSize()?.width ?? 1280) >= 1024) {
  const clipped = await page.evaluate(() => {
    const wrap = document.querySelector(".columns-map .list-table-wrap") as HTMLElement;
    const right = wrap.getBoundingClientRect().right;
    return [...wrap.querySelectorAll("select")].filter((select) => select.getBoundingClientRect().right > right + 1).length;
  });
  expect(clipped).toBe(0);
  }
  await expectNoAxeViolation(page);
});

test("PRE-02 — Lot 65g : un poste vide se supprime depuis sa ligne, après confirmation ; un poste qui a un montant ne le propose pas", async ({ page }) => {
  test.setTimeout(90_000);
  const setup = await wedding();
  await signIn(page, setup.email);
  await page.goto(`/events/${setup.eventId}?onglet=budget`);
  const table = page.getByRole("region", { name: "Budget et prestataires, par poste" });
  await expect(table.getByRole("button", { name: "Supprimer le poste « Traiteur »" })).toHaveCount(0);
  await table.getByRole("button", { name: "Supprimer le poste « Pièce montée / gâteau »" }).click();
  const confirm = page.getByRole("dialog", { name: "Supprimer le poste « Pièce montée / gâteau » ?" });
  await expect(confirm).toContainText("Non requis");
  await confirm.getByRole("button", { name: "Supprimer le poste" }).click();
  await expect(table.getByRole("row").filter({ hasText: "Pièce montée / gâteau" })).toHaveCount(0);
  await expect(table.getByRole("row").filter({ hasText: "Traiteur" }).first()).toBeVisible();
});

test("CHR-08 — Lot 65g : « Importer » ouvre l'import du programme en tête de la carte, au-dessus de la diffusion", async ({ page }) => {
  test.setTimeout(90_000);
  const setup = await wedding();
  await signIn(page, setup.email);
  await page.goto(`/events/${setup.eventId}?onglet=programme`);
  await page.getByRole("link", { name: "Importer", exact: true }).click();
  await expect(page).toHaveURL(/importer=1/);
  const file = page.getByLabel("Fichier CSV, XLSX ou PDF");
  await expect(file).toBeVisible();
  await expect(file).toHaveCount(1);
  const importTop = (await page.locator("#importer-programme").boundingBox())!.y;
  const headingTop = (await page.getByRole("heading", { name: "Modèle de programme à appliquer" }).or(page.locator(".program-sources")).first().boundingBox())!.y;
  expect(importTop).toBeLessThan(headingTop);
});
