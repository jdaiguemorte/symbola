// IMP-04 — rapport des écarts. Lot 16 (IMP-11) : la colonne sans équivalent se
// décide à l'étape « Colonnes », les lignes rejetées à « Vérifier et
// confirmer ». IMP-04 (d'origine) : une colonne sans équivalent est gardée en
// champ libre, les lignes rejetées sont listées avec leur motif et se
// téléchargent en CSV. En taille ordinateur et en 375 px, axe-core sur chaque
// écran.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { readyOrganization, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("IMP-04 — colonne gardée en champ libre, lignes rejetées et leur CSV", async ({ page }) => {
  const email = `planner-imp04-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-imp04-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  await page.goto("/import");
  // Lot 16 (IMP-11) : « Un autre fichier », puis le contenu.
  await page.getByRole("navigation", { name: "Que voulez-vous reprendre ?" }).getByRole("link", { name: /Un autre fichier/ }).click();
  await page.getByLabel("Articles du catalogue").check();
  await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles({
    name: "tarifs.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Intitulé;Unité;Prix HT;Remarque\nFleurs;bouquet;85;de saison\nDJ;;950;\nPhoto;jour;abc;\n", "utf-8"),
  });
  await page.getByRole("button", { name: "Lire le fichier" }).click();

  // Lot 16 (IMP-11) : la colonne sans équivalent se décide à l'étape « Colonnes ».
  await expect(page).toHaveURL(/\/colonnes$/);
  const toDecide = page.getByRole("region", { name: "Colonnes à décider" });
  await expect(toDecide.getByRole("row").filter({ hasText: "Remarque" })).toContainText("de saison");
  await expectNoAxeViolation(page);
  const price = page.getByLabel("Champ pour la colonne « Prix HT »");
  if ((await price.inputValue()) === "") await price.selectOption({ label: "Prix unitaire HT (obligatoire)" });
  await toDecide.getByLabel("Champ pour la colonne « Remarque »").selectOption({ label: "Garder en champ libre sur la fiche" });
  await page.getByRole("group", { name: "Actions de l'étape" }).getByRole("button", { name: "Continuer" }).click();

  // Aucun doublon à vérifier : l'assistant arrive à « Vérifier et confirmer », avec les lignes rejetées.
  await expect(page).toHaveURL(/\/confirmation$/);
  await expect(page.getByRole("navigation", { name: "Étapes de l'import" }).getByRole("listitem").filter({ hasText: "Colonnes" })).toContainText("3 colonnes reconnues, 1 en champ libre");
  await expect(page.getByRole("region", { name: "Ce que va faire l'import" })).toContainText("Remarque");
  await expect(page.getByText("Ligne 3 : Unité : champ obligatoire manquant")).toBeVisible();
  await expect(page.getByText("Ligne 4 : Prix unitaire HT : montant invalide (abc)")).toBeVisible();
  await expect(page.getByText("2 lignes sur 3 ne seront pas importées.", { exact: false })).toBeVisible();
  await expectNoAxeViolation(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Télécharger les lignes rejetées (CSV)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tarifs-lignes-rejetees.csv");
  const csv = readFileSync((await download.path())!, "utf-8");
  expect(csv).toBe(
    "\ufeffMotif du rejet;Intitulé;Unité;Prix HT;Remarque\r\n" +
      "Unité : champ obligatoire manquant;DJ;;950;\r\n" +
      "Prix unitaire HT : montant invalide (abc);Photo;jour;abc;\r\n",
  );
});
