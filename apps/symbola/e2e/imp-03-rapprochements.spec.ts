// IMP-03 — étape « rapprochements » : les lignes qui ressemblent à des
// articles existants sont proposées avec leur ressemblance ; la planner en
// valide, en refuse, et en rapproche une à la main. En taille ordinateur et
// en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { catalogItems } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

async function loginAndSetupMfa(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
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
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
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
  await page.getByLabel("Articles du catalogue").check();
  await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles({
    name: "tarifs-2027.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Intitulé;Unité;Prix HT\nFleurs;bouquet;85\nAnimation DJ;soirée;950\nBorne photo;jour;400\n", "utf-8"),
  });
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  await page.getByRole("link", { name: "Continuer : reconnaître les colonnes" }).click();
  await page.getByRole("button", { name: "Enregistrer les colonnes" }).click();
  await page.getByRole("link", { name: "Continuer : rapprocher des éléments existants" }).click();

  await expect(page.getByRole("heading", { name: "Rapprochements de « tarifs-2027.csv »" })).toBeVisible();
  const flowers = page.getByRole("listitem").filter({ hasText: "Ligne 2 : Fleurs" });
  const dj = page.getByRole("listitem").filter({ hasText: "Ligne 3 : Animation DJ" });
  const booth = page.getByRole("listitem").filter({ hasText: "Ligne 4 : Borne photo" });
  await expect(flowers).toContainText("Ressemble à : Fleurs (ressemblance 100 %) — proposé");
  await expect(dj).toContainText("Ressemble à : Animation DJ (ressemblance 100 %) — proposé");
  await expect(booth).toContainText("À la confirmation, cette ligne créera un nouvel élément.");
  await expectNoAxeViolation(page);

  // Valider un rapprochement, en refuser un autre.
  await flowers.getByLabel("Sélectionner le rapprochement de « Fleurs »").check();
  await page.getByRole("button", { name: "Valider la sélection" }).click();
  await expect(flowers).toContainText("— validé");
  await dj.getByLabel("Sélectionner le rapprochement de « Animation DJ »").check();
  await page.getByRole("button", { name: "Refuser la sélection" }).click();
  await expect(dj).toContainText("— refusé");
  await expect(dj).toContainText("À la confirmation, cette ligne créera un nouvel élément.");

  // Rapprochement ajouté à la main : la borne photo est le Photobooth.
  await booth.getByLabel("Rapprocher « Borne photo » de").selectOption({ label: "Photobooth" });
  await booth.getByRole("button", { name: "Rapprocher" }).click();
  await expect(booth).toContainText("Ressemble à : Photobooth (ressemblance 100 %) — validé (ajouté à la main)");
  await expect(booth).toContainText("À la confirmation, cette ligne mettra à jour l'élément existant.");
  await expectNoAxeViolation(page);

  await page.getByRole("link", { name: "Retour à l'import" }).click();
  await expect(page.getByText("2 rapprochements validés, aucun à décider, 1 refusé.")).toBeVisible();
  await expectNoAxeViolation(page);
});
