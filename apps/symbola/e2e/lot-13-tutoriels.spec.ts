// Lot 13 (AIDE-10) — page Tutoriels en parcours : tuiles par étape, suivant
// conseillé, un seul tutoriel en cours (terminer d'abord ou abandonner).
// Ordinateur et 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { recordHelpProgress } from "../modules/hub/service";
import { clickMenuLink, readyOrganization, signIn as signInByLink } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function login(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

test("AIDE-10 — parcours des tutoriels, un seul en cours à la fois", async ({ page }) => {
  const email = `planner-tuto-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-tutoriels";
  const { sql, db } = createAppConnection();
  let userId: string;
  try {
    const organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    userId = (await createUser(db, { organizationId, email, password, role: "owner" })).id;
  } finally {
    await sql.end();
  }
  await login(page, email, password);

  // Une page à part, avec le parcours en étapes. Lot 74g (G11) : elle s'ouvre depuis « Aide ».
  // Lot 74f (D6) : sans réponse au démarrage, le parcours « Je pars de zéro » ; « Ensuite » sur la seule
  // étape suivante, l'import sous « Autres tutoriels ».
  await clickMenuLink(page, "Aide");
  await page.getByRole("link", { name: "Voir tout le parcours" }).click();
  await expect(page).toHaveURL(/\/tutoriels$/);
  await expect(page.getByRole("heading", { level: 2, name: "Votre parcours : je pars de zéro" })).toBeVisible();
  const firstStage = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /Créer votre premier mariage/ }) });
  await expect(firstStage).toContainText("Ensuite");
  await expect(page.getByRole("region", { name: "Autres tutoriels" })).toContainText("Importer ses évènements existants");
  await expectNoAxeViolation(page);

  // Un tutoriel en cours : il est mis en avant, et en commencer un autre demande de choisir.
  const { sql: sql2, db: db2 } = createAppConnection();
  try {
    await recordHelpProgress(db2, { userId, itemKey: "tutorial:day-program", status: "started", step: 1 });
  } finally {
    await sql2.end();
  }
  await page.reload();
  // Lot 74f (maquette 28) : un tutoriel commencé se reprend en tête de la page, à son étape.
  const current = page.getByRole("region", { name: "En cours" });
  await expect(current).toContainText("Préparer le programme du jour J");
  await expect(current).toContainText("Étape 2");
  await page.getByRole("link", { name: /Saisir son catalogue de prestations/ }).click();
  const conflict = page.getByRole("alertdialog", { name: "Un tutoriel est déjà en cours" });
  await expect(conflict).toBeVisible();
  await expectNoAxeViolation(page);
  await expect(conflict.getByRole("link", { name: "Le terminer d’abord" })).toHaveAttribute("href", "/aide/tutoriels/day-program");
  await conflict.getByRole("button", { name: "L’abandonner et commencer celui-ci" }).click();
  await expect(page).toHaveURL(/\/aide\/tutoriels\/catalog$/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Saisir son catalogue de prestations" })).toBeVisible();

  await page.goto("/tutoriels");
  await expect(page.getByRole("region", { name: "En cours" })).toHaveCount(0);
});
