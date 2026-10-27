// HUB-03 — L'Admin crée une organisation et invite son titulaire par
// e-mail (lien valable 7 jours) ; le titulaire crée son compte depuis ce
// lien. Un utilisateur non-Admin n'accède pas à /admin.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

const MAILPIT_API = "http://localhost:8025/api/v1";

// Premier login : le TOTP n'est pas encore configuré, /mfa affiche le
// lien otpauth:// à « scanner ». Renvoie le secret pour les logins
// suivants (configuré une fois, plus de lien ensuite).
async function loginAndSetupMfa(page: Page, email: string, password: string): Promise<string> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);

  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  // Attend l'atterrissage sur l'accueil avant de rendre la main : sinon un
  // page.goto() immédiat de l'appelant peut courir plus vite que la
  // redirection post-MFA et partir sans le cookie de session.
  await expect(page).toHaveURL("/");
  return secret;
}

// Login suivant : le TOTP est déjà configuré, pas de lien otpauth:// sur
// /mfa — le secret doit être connu de l'appelant (capturé au premier login).
async function loginWithKnownMfa(page: Page, email: string, password: string, secret: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
}

async function waitForInvitationLink(to: string, attempts = 30): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await response.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const detail = await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}`);
      const { Text } = (await detail.json()) as { Text: string };
      const match = Text.match(/https?:\/\/\S*\/invitations\/\S+/);
      if (match) return match[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`aucun e-mail d'invitation reçu pour ${to}`);
}

test("HUB-03-01 — l'Admin crée une organisation, le titulaire accepte son invitation", async ({ page }) => {
  const adminEmail = `admin-e2e-${randomUUID()}@symbola.test`;
  const adminPassword = "mot-de-passe-admin-e2e";
  const titulaireEmail = `titulaire-e2e-${randomUUID()}@symbola.test`;

  const { sql, db } = createAppConnection();
  try {
    await createUser(db, { organizationId: null, email: adminEmail, password: adminPassword, role: "admin" });
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, adminEmail, adminPassword);
  await expect(page).toHaveURL("/");

  await page.goto("/admin");
  let violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  await page.getByLabel("Nom de l'organisation").fill("Organisation E2E HUB-03");
  await page.getByLabel("E-mail du titulaire").fill(titulaireEmail);
  await page.getByRole("button", { name: "Créer et inviter" }).click();
  await expect(page.getByText("Organisation créée, invitation envoyée.")).toBeVisible();

  const invitationLink = await waitForInvitationLink(titulaireEmail);
  await page.goto(invitationLink);
  violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  await page.getByLabel("Choisissez un mot de passe").fill("mot-de-passe-du-titulaire-e2e");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Compte créé. Vous pouvez maintenant vous connecter.")).toBeVisible();

  // Le compte créé fonctionne vraiment : la connexion atteint l'étape MFA.
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(titulaireEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-du-titulaire-e2e");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
});

test("HUB-03-02 — un utilisateur non-Admin n'accède pas à /admin", async ({ page }) => {
  const email = `non-admin-e2e-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-non-admin-e2e";

  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, email, password);
  await expect(page).toHaveURL("/");

  await page.goto("/admin");
  await expect(page).toHaveURL("/");
});

test("HUB-03-03 — désactiver un module l'affiche « indisponible » sans erreur, et la page Santé affiche la version", async ({
  page,
}) => {
  const adminEmail = `admin-e2e-${randomUUID()}@symbola.test`;
  const adminPassword = "mot-de-passe-admin-e2e";
  const email = `titulaire-degrade-e2e-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-titulaire-e2e";

  const organizationName = `Org dégradée ${randomUUID()}`;
  const { sql, db } = createAppConnection();
  let organizationId: string;
  try {
    await createUser(db, { organizationId: null, email: adminEmail, password: adminPassword, role: "admin" });
    const organization = await createOrganization(db, organizationName);
    organizationId = organization.id;
    await createUser(db, { organizationId, email, password, role: "owner" });
  } finally {
    await sql.end();
  }

  // Avant désactivation : le module s'affiche normalement.
  const titulaireSecret = await loginAndSetupMfa(page, email, password);
  await expect(page.getByText("Bonjour depuis Symbola")).toBeVisible();
  await page.getByRole("button", { name: "Se déconnecter" }).click();

  // L'Admin désactive le module hello pour cette organisation (la liste
  // contient toutes les organisations créées par les autres tests : on
  // cible la ligne de celle-ci par son nom, pas un bouton générique).
  await loginAndSetupMfa(page, adminEmail, adminPassword);
  await page.goto("/admin");
  const row = page.getByRole("row", { name: organizationName });
  await row.getByRole("button", { name: /hello : activé \(désactiver\)/ }).click();
  await expect(row.getByRole("button", { name: /hello : désactivé \(activer\)/ })).toBeVisible();

  await page.goto("/admin/health");
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);
  await expect(page.getByText("en ligne")).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Le titulaire voit « indisponible », sans erreur.
  await loginWithKnownMfa(page, email, password, titulaireSecret);
  await expect(page.getByText("Module indisponible")).toBeVisible();
});
