// IMP-03 — étape « rapprochements » : les lignes qui ressemblent à des
// articles existants sont proposées avec leur ressemblance ; la planner en
// valide, en refuse, et en rapproche une à la main. En taille ordinateur et
// en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { catalogItems } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
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

test("IMP-03 — rapprochements validés, refusés et ajoutés à la main", async ({ page }) => {
  const email = `planner-imp03-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-imp03-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    await withOrganization(db, organization.id, (tx) =>
      tx.insert(catalogItems).values(
        [
          ["Fleurs", "bouquet", 8000],
          ["Animation DJ", "soirée", 90000],
          ["Photobooth", "jour", 40000],
        ].map(([label, unit, unitPriceCents]) => ({
          organizationId: organization.id,
          label: label as string,
          unit: unit as string,
          unitPriceCents: unitPriceCents as number,
          vatRateBasisPoints: 2000,
        })),
      ),
    );
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  await page.goto("/import");
  // Lot 16 (IMP-11) : « Un autre fichier », puis le contenu.
  await page.getByRole("navigation", { name: "Que voulez-vous reprendre ?" }).getByRole("link", { name: /Un autre fichier/ }).click();
  await page.getByLabel("Articles du catalogue").check();
  await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles({
    name: "tarifs-2027.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Intitulé;Unité;Prix HT\nFleurs;bouquet;85\nAnimation DJ;soirée;950\nBorne photo;jour;400\n", "utf-8"),
  });
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  const continueButton = page.getByRole("group", { name: "Actions de l'étape" }).getByRole("button", { name: "Continuer" });
  // Colonnes : une colonne douteuse se choisit, sinon l'étape est faite d'office.
  if (page.url().endsWith("/colonnes")) {
    const price = page.getByLabel("Champ pour la colonne « Prix HT »");
    if ((await price.inputValue()) === "") await price.selectOption({ label: "Prix unitaire HT (obligatoire)" });
    await continueButton.click();
  }

  // Lot 16 (IMP-11) : étape « Doublons », tableau filtrable.
  await expect(page).toHaveURL(/\/rapprochements/);
  const filters = page.getByRole("navigation", { name: "Filtrer les lignes" });
  await expect(filters.getByRole("link", { name: "À vérifier · 2" })).toHaveAttribute("aria-current", "true");
  const table = page.getByRole("region", { name: "Lignes du fichier" });
  const row = (title: string) => table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: title, exact: true }) });
  await expect(row("Fleurs")).toContainText("Fleurs (100 %)");
  await expect(row("Animation DJ")).toContainText("Animation DJ (100 %)");
  await expectNoAxeViolation(page);

  // Valider un rapprochement, en refuser un autre.
  await page.getByRole("button", { name: "Mettre à jour l'existant pour Fleurs" }).click();
  await expect(filters.getByRole("link", { name: "Mises à jour · 1" })).toBeVisible();
  await page.getByRole("button", { name: "Créer une nouvelle fiche pour Animation DJ" }).click();
  await expect(filters.getByRole("link", { name: "Nouveaux · 2" })).toBeVisible();

  // Rapprochement ajouté à la main : la borne photo est le Photobooth.
  await filters.getByRole("link", { name: "Nouveaux · 2" }).click();
  const booth = row("Borne photo");
  await booth.getByLabel("Rapprocher « Borne photo » de").selectOption({ label: "Photobooth" });
  await booth.getByRole("button", { name: "Rapprocher" }).click();
  await expect(filters.getByRole("link", { name: "Mises à jour · 2" })).toBeVisible();
  await expectNoAxeViolation(page);

  // « Continuer » : l'étape est faite, son résumé reste dans la frise.
  await continueButton.click();
  await expect(page).toHaveURL(/\/confirmation$/);
  await expect(page.getByRole("navigation", { name: "Étapes de l'import" }).getByRole("listitem").filter({ hasText: "Doublons" })).toContainText("1 nouveau, 2 mises à jour");
  await expectNoAxeViolation(page);
});
