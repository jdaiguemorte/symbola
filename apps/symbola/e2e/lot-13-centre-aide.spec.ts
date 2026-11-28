// Lot 13 (AIDE-12, AIDE-13) — centre d'aide par écran : vignettes groupées
// par rubrique avec la capture réelle de l'écran, fiche d'un écran (capture,
// étapes de la visite guidée, questions fréquentes), recherche dans l'aide ; chaque
// public ne voit que ses écrans. Ordinateur et 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { readyOrganization, signIn as signInByLink, tourDialog } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function login(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email);
}

async function account(role: "owner" | "member" | "admin") {
  const email = `aide-centre-${role}-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-centre-aide";
  const { sql, db } = createAppConnection();
  try {
    const organizationId = role === "admin" ? null : (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    await createUser(db, { organizationId, email, password, role });
  } finally {
    await sql.end();
  }
  return { email, password };
}

test("AIDE-12 — les articles par sujet, un article avec capture, étapes de la visite et questions", async ({ page }) => {
  const owner = await account("owner");
  await login(page, owner.email, owner.password);

  // Lot 74f (C-07) : les sujets en lignes, avec leur nombre d'articles ; un sujet liste ses articles.
  await page.goto("/aide");
  const topics = page.getByRole("region", { name: "Par sujet" });
  await expect(topics.getByRole("link", { name: /Devis et factures \d+ articles/ })).toBeVisible();
  await expect(topics.getByRole("link", { name: /Vos données et données personnelles/ })).toBeVisible();
  await topics.getByRole("link", { name: /^Évènements \d+ articles/ }).click();
  await expect(page).toHaveURL(/\/aide\/sujets\/events$/);
  const tile = page.getByRole("link", { name: /Fiche de l'évènement/ });
  await expect(tile).toBeVisible();
  await expectNoAxeViolation(page);

  // La recherche porte aussi sur les questions fréquentes.
  await page.goto("/aide?q=perdu");
  await expect(page.locator(".help-answers")).toContainText("Fiche de l'évènement");

  await page.goto("/aide/sujets/events");
  await tile.click();
  await expect(page).toHaveURL(/\/aide\/ecrans\/eventsDetail$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aide : Fiche de l'évènement");
  const capture = page.getByRole("img", { name: "Capture de l'écran « Fiche de l'évènement », visite guidée ouverte" });
  await expect(capture).toBeVisible();
  expect(await capture.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1280);
  await expect(page.getByRole("region", { name: "La visite de cet écran" }).getByRole("listitem")).toHaveCount(5);
  await expect(page.getByText("Comment marquer un évènement perdu ?")).toBeVisible();
  await expect(page.getByText("Cet écran s'ouvre depuis la fiche d'un évènement.")).toBeVisible();
  await expectNoAxeViolation(page);

  // Depuis la fiche d'un écran, sa visite se relance sur l'écran lui-même.
  await page.goto("/aide/ecrans/eventsList");
  await page.getByRole("link", { name: "Revoir la visite sur l'écran" }).click();
  await expect(page).toHaveURL(/\/events\?visite=revoir$/);
  await expect(tourDialog(page, "Liste des évènements")).toBeVisible();
});

test("AIDE-12 — chaque public ne voit que ses écrans", async ({ page }) => {
  const member = await account("member");
  await login(page, member.email, member.password);
  await page.goto("/aide/sujets/events");
  await expect(page.getByRole("link", { name: /Liste des évènements/ })).toBeVisible();
  // Les données personnelles sont réservées à la titulaire : ni dans le sujet, ni par la recherche, ni par
  // l'adresse de l'article (lot 74f).
  await page.goto("/aide/sujets/data");
  await expect(page.getByRole("link", { name: /^Données personnelles/ })).toHaveCount(0);
  await page.goto("/aide?q=" + encodeURIComponent("données personnelles d'une personne"));
  await expect(page.locator(".help-answers").getByRole("heading", { name: "Données personnelles", exact: true })).toHaveCount(0);
  const response = await page.goto("/aide/ecrans/privacySearch");
  expect(response?.status()).toBe(404);
});

test("AIDE-12 — l'Admin ne voit que l'aide de la console, sans article d'organisation", async ({ page }) => {
  const admin = await account("admin");
  await login(page, admin.email, admin.password);
  await page.goto("/aide");
  const topics = page.getByRole("region", { name: "Par sujet" });
  await expect(topics.getByRole("link")).toHaveCount(1);
  await topics.getByRole("link", { name: /Exploitation de la suite/ }).click();
  await expect(page.getByRole("link", { name: /Comptes et assistance/ })).toBeVisible();
  // Lot 20 (AIDE-16), lot 74f : jamais d'image ni d'article d'organisation ; ni parcours ni exemple.
  await expect(page.locator("main img")).toHaveCount(0);
  await expectNoAxeViolation(page);
  expect((await page.goto("/aide/sujets/events"))?.status()).toBe(404);
  await page.goto("/aide?q=" + encodeURIComponent("importer mes contacts"));
  await expect(page.getByRole("region", { name: "Pour bien démarrer" })).toHaveCount(0);
  await expect(page.locator(".help-answers")).not.toContainText("Reprendre et importer");
  const response = await page.goto("/aide/ecrans/eventsList");
  expect(response?.status()).toBe(404);
});
