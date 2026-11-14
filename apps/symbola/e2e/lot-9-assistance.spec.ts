// Lot 9 (ADR 0029) — assistance de l'Exploitation : état des comptes, nouvel envoi
// d'invitation, réinitialisation de la double authentification, activité agrégée des
// organisations. Lot 33 : le mot de passe oublié passe par le fournisseur d'identité. En taille ordinateur et en 375 px, axe-core sur
// chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { clickAdminMenuLink, logout, signIn as signInByLink } from "./helpers";

const MAILPIT_API = "http://localhost:8025/api/v1";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Lien du dernier e-mail reçu par `to` dont le texte contient `pattern`.
async function waitForLink(to: string, pattern: RegExp, count = 1, attempts = 40): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await response.json()) as { messages: { ID: string }[] };
    if (messages.length >= count) {
      const detail = await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}`);
      const { Text } = (await detail.json()) as { Text: string };
      const match = Text.match(pattern);
      if (match) return new URL(match[0]).pathname;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`aucun e-mail attendu reçu pour ${to}`);
}

async function signIn(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email);
}

test("Lot 9 — l'Admin relance une invitation, réinitialise la double authentification et consulte l'activité", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const adminEmail = `admin-lot9-${randomUUID()}@symbola.test`;
  const ownerEmail = `titulaire-lot9-${randomUUID()}@symbola.test`;
  const organizationName = `Organisation lot 9 ${randomUUID().slice(0, 8)}`;
  const { sql, db } = createAppConnection();
  try {
    await createUser(db, { organizationId: null, email: adminEmail, password: "mot-de-passe-admin-lot9", role: "admin" });
  } finally {
    await sql.end();
  }

  await signIn(page, adminEmail, "mot-de-passe-admin-lot9");
  await page.goto("/exploitation/organisations?panneau=nouvelle");
  await page.getByLabel("Nom de l'organisation").fill(organizationName);
  await page.getByLabel("E-mail du titulaire").fill(ownerEmail);
  await page.getByRole("button", { name: "Créer et inviter" }).click();
  await expect(page.getByText("Organisation créée, invitation envoyée.")).toBeVisible();
  const firstLink = await waitForLink(ownerEmail, /https?:\/\/\S*\/invitations\/\S+/);

  // Comptes et assistance : l'invitation attend ; un nouvel envoi remplace le lien.
  // Le panneau de création se ferme (plein écran sur téléphone) ; 20
  // organisations par page : on la retrouve par son nom.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "Créer une organisation" })).toHaveCount(0);
  await clickAdminMenuLink(page, "Comptes");
  await expect(page.getByRole("heading", { level: 1, name: "Comptes et assistance" })).toBeVisible();
  await page.getByRole("search", { name: "Chercher une organisation" }).getByLabel("Rechercher par nom").fill(organizationName);
  await expect(page).toHaveURL(/q=/);
  const section = page.locator(".card").filter({ has: page.getByRole("heading", { name: organizationName }) });
  await expect(section.getByRole("list", { name: `Invitations en attente de ${organizationName}` })).toContainText(ownerEmail);
  await expectNoAxeViolation(page);
  await section.getByRole("button", { name: `Renvoyer l'invitation à ${ownerEmail}` }).click();
  await expect(page.getByText("Nouvelle invitation envoyée : l'ancien lien ne fonctionne plus.")).toBeVisible();
  const secondLink = await waitForLink(ownerEmail, /https?:\/\/\S*\/invitations\/\S+/, 2);
  expect(secondLink).not.toBe(firstLink);

  // Lot 33 : l'ancien lien n'ouvre plus rien ; le nouveau accepte l'invitation et envoie un lien
  // de connexion ; la titulaire se connecte (double authentification par le fournisseur).
  const ownerContext = await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() });
  const owner = await ownerContext.newPage();
  await owner.goto(firstLink);
  await expect(owner.getByRole("heading", { level: 1 })).toHaveText("Cette invitation n'est plus valable. Demandez-en une nouvelle à la personne qui vous a invité·e.");
  await owner.goto(secondLink);
  await expect(owner.getByRole("heading", { level: 1 })).toContainText(organizationName);
  await owner.getByRole("button", { name: "Accepter et recevoir mon lien de connexion" }).click();
  await expect(owner.getByRole("status")).toContainText("Un lien de connexion vient de partir");
  await signIn(owner, ownerEmail, "mot-de-passe-titulaire");

  // L'Admin réinitialise sa double authentification (confirmation exigée).
  await page.reload();
  const row = page.getByRole("row", { name: new RegExp(ownerEmail) });
  await row.getByLabel(`Je confirme : effacer la double authentification de ${ownerEmail}`).check();
  await row.getByRole("button", { name: "Réinitialiser la double authentification" }).click();
  await expect(page.getByText("Double authentification réinitialisée", { exact: false })).toBeVisible();
  await waitForLink(ownerEmail, /https?:\/\/\S*\/login\b/);

  // La titulaire est déconnectée ; elle se reconnecte (son second facteur se réinstalle chez le
  // fournisseur ; ici, l'assistant des parcours le repose).
  await owner.goto("/");
  await expect(owner).toHaveURL(/\/login$/);
  await signIn(owner, ownerEmail, "mot-de-passe-titulaire");
  await ownerContext.close();

  // Activité : des nombres seulement.
  await page.goto(`/exploitation/activite?q=${encodeURIComponent(organizationName)}`);
  const activity = page.locator(".card").filter({ has: page.getByRole("heading", { name: organizationName }) });
  await expect(activity.getByRole("list", { name: `Résumé de ${organizationName}` })).toContainText("1 compte d'équipe");
  await expect(activity.getByRole("list", { name: `Résumé de ${organizationName}` })).toContainText("1 compte connecté sur 30 jours");
  await expect(activity.getByRole("table")).toBeVisible();
  await expectNoAxeViolation(page);
  await logout(page);
});
