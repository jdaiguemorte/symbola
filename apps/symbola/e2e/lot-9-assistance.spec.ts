// Lot 9 (ADR 0029) — retrouver l'accès à son compte et assistance de l'Admin :
// mot de passe oublié (lien par e-mail), état des comptes, nouvel envoi
// d'invitation, réinitialisation de la double authentification, activité
// agrégée des organisations. En taille ordinateur et en 375 px, axe-core sur
// chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { clickAdminMenuLink, logout, readyOrganization } from "./helpers";

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

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
}

// Configure la double authentification depuis l'écran affiché ; renvoie la clé.
async function setUpMfa(page: Page): Promise<string> {
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  // Accueil, ou assistant de démarrage pour une organisation toute neuve (lot 12).
  await expect(page).toHaveURL(/\/(demarrage|admin)?$/);
  return secret;
}

test("Lot 9 — mot de passe oublié : lien par e-mail, nouveau mot de passe, double authentification conservée", async ({ page }) => {
  const email = `planner-lot9-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password: "ancien-mot-de-passe", role: "owner" });
  } finally {
    await sql.end();
  }

  await page.goto("/login");
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mot de passe oublié");
  await expectNoAxeViolation(page);
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir le lien" }).click();
  await expect(page.getByRole("status")).toContainText("Si un compte existe pour cette adresse");

  await page.goto(await waitForLink(email, /https?:\/\/\S*\/mot-de-passe\/\S+/));
  await expectNoAxeViolation(page);
  await page.getByLabel("Nouveau mot de passe").fill("nouveau-mot-de-passe");
  await page.getByLabel("Confirmez le mot de passe").fill("autre-chose-encore");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByText("Les deux mots de passe ne sont pas identiques.")).toBeVisible();
  await page.getByLabel("Nouveau mot de passe").fill("nouveau-mot-de-passe");
  await page.getByLabel("Confirmez le mot de passe").fill("nouveau-mot-de-passe");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByRole("status")).toContainText("Mot de passe enregistré.");

  // Le lien ne sert qu'une fois.
  await page.reload();
  await expect(page.getByText("Ce lien n'est plus valable : il a déjà servi ou a expiré.")).toBeVisible();

  await signIn(page, email, "nouveau-mot-de-passe");
});

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
  await setUpMfa(page);
  await page.goto("/admin/organisations");
  await page.getByLabel("Nom de l'organisation").fill(organizationName);
  await page.getByLabel("E-mail du titulaire").fill(ownerEmail);
  await page.getByRole("button", { name: "Créer et inviter" }).click();
  await expect(page.getByText("Organisation créée, invitation envoyée.")).toBeVisible();
  const firstLink = await waitForLink(ownerEmail, /https?:\/\/\S*\/invitations\/\S+/);

  // Comptes et assistance : l'invitation attend ; un nouvel envoi remplace le lien.
  await clickAdminMenuLink(page, "Comptes");
  const section = page.locator(".card").filter({ has: page.getByRole("heading", { name: organizationName }) });
  await expect(section.getByRole("list", { name: `Invitations en attente de ${organizationName}` })).toContainText(ownerEmail);
  await expectNoAxeViolation(page);
  await section.getByRole("button", { name: `Renvoyer l'invitation à ${ownerEmail}` }).click();
  await expect(page.getByText("Nouvelle invitation envoyée : l'ancien lien ne fonctionne plus.")).toBeVisible();
  const secondLink = await waitForLink(ownerEmail, /https?:\/\/\S*\/invitations\/\S+/, 2);
  expect(secondLink).not.toBe(firstLink);

  // La titulaire crée son compte avec le nouveau lien et configure sa double authentification.
  const ownerContext = await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() });
  const owner = await ownerContext.newPage();
  await owner.goto(firstLink);
  await owner.getByLabel("Choisissez un mot de passe").fill("mot-de-passe-titulaire");
  await owner.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(owner.getByText("Ce lien d'invitation est invalide ou a expiré.", { exact: false })).toBeVisible();
  await owner.goto(secondLink);
  await owner.getByLabel("Choisissez un mot de passe").fill("mot-de-passe-titulaire");
  await owner.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(owner.getByText("Compte créé. Vous pouvez maintenant vous connecter.")).toBeVisible();
  await signIn(owner, ownerEmail, "mot-de-passe-titulaire");
  await setUpMfa(owner);

  // L'Admin réinitialise sa double authentification (confirmation exigée).
  await page.reload();
  const row = page.getByRole("row", { name: new RegExp(ownerEmail) });
  await expect(row).toContainText("Configurée");
  await row.getByLabel(`Je confirme : effacer la double authentification de ${ownerEmail}`).check();
  await row.getByRole("button", { name: "Réinitialiser la double authentification" }).click();
  await expect(page.getByText("Double authentification réinitialisée", { exact: false })).toBeVisible();
  await waitForLink(ownerEmail, /https?:\/\/\S*\/login/, 3);

  // La titulaire est déconnectée ; à la connexion suivante, un nouveau QR code.
  await owner.goto("/");
  await expect(owner).toHaveURL(/\/login$/);
  await signIn(owner, ownerEmail, "mot-de-passe-titulaire");
  await expect(owner.getByRole("img", { name: "QR code à scanner avec votre application d'authentification" })).toBeVisible();
  await setUpMfa(owner);
  await ownerContext.close();

  // Activité : des nombres seulement.
  await page.goto("/admin/activite");
  const activity = page.locator(".card").filter({ has: page.getByRole("heading", { name: organizationName }) });
  await expect(activity.getByRole("list", { name: `Résumé de ${organizationName}` })).toContainText("1 compte d'équipe");
  await expect(activity.getByRole("list", { name: `Résumé de ${organizationName}` })).toContainText("1 compte connecté sur 30 jours");
  await expect(activity.getByRole("table")).toBeVisible();
  await expectNoAxeViolation(page);
  await logout(page);
});
