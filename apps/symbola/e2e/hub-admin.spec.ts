// PRD-HUB-03 — L'Exploitation crée une organisation et invite sa titulaire par
// e-mail (lien valable 7 jours) ; la titulaire accepte et reçoit un lien de connexion
// (lot 33). Un compte d'organisation n'accède pas à /exploitation.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { logout, readyOrganization, signIn as signInByLink } from "./helpers";

const MAILPIT_API = "http://localhost:8025/api/v1";

// Lot 33 : connexion par lien magique et fournisseur d'identité (e2e/helpers.ts) ; la double
// authentification de l'Exploitation et de la titulaire est posée par l'assistant des parcours.
async function loginAndSetupMfa(page: Page, email: string, _password: string): Promise<string> {
  await signInByLink(page, email, /\/(exploitation)?$/);
  return "";
}

async function loginWithKnownMfa(page: Page, email: string, _password: string, _secret: string) {
  await signInByLink(page, email, /\/(exploitation)?$/);
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

test("PRD-HUB-03-01 — l'Admin crée une organisation, le titulaire accepte son invitation", async ({ page }) => {
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
  await expect(page).toHaveURL("/exploitation");

  await page.goto("/exploitation/organisations");
  // Lot 13 (L13-HUB-17) : la création s'ouvre dans le panneau latéral.
  await page.getByRole("link", { name: "Nouvelle organisation" }).click();
  await expect(page.getByRole("complementary", { name: "Créer une organisation" })).toBeVisible();
  let violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  await page.getByLabel("Nom de l'organisation").fill("Organisation E2E PRD-HUB-03");
  await page.getByLabel("E-mail du titulaire").fill(titulaireEmail);
  await page.getByRole("button", { name: "Créer et inviter" }).click();
  await expect(page.getByText("Organisation créée, invitation envoyée.")).toBeVisible();

  const invitationLink = await waitForInvitationLink(titulaireEmail);
  await page.goto(invitationLink);
  violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  // Lot 33 : accepter envoie un lien de connexion à l'adresse invitée, sans mot de passe.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Organisation E2E PRD-HUB-03");
  await page.getByRole("button", { name: "Accepter et recevoir mon lien de connexion" }).click();
  await expect(page.getByRole("status")).toContainText("Un lien de connexion vient de partir");

  // Le compte fonctionne vraiment : la titulaire se connecte et arrive dans son organisation.
  await logout(page);
  await signInByLink(page, titulaireEmail);
  await expect(page).toHaveURL(/\/(demarrage)?$/);
});

test("PRD-HUB-03-02 — un utilisateur non-Admin n'accède pas à /exploitation", async ({ page }) => {
  const email = `non-admin-e2e-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-non-admin-e2e";

  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, email, password);
  await expect(page).toHaveURL("/");

  await page.goto("/exploitation");
  await expect(page).toHaveURL("/");
});

test("PRD-HUB-03-03 — désactiver un module l'affiche « indisponible » sans erreur, et la page Santé affiche la version", async ({
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
    const organization = await readyOrganization(db, organizationName);
    organizationId = organization.id;
    await createUser(db, { organizationId, email, password, role: "owner" });
  } finally {
    await sql.end();
  }

  // Avant désactivation : le module Événements s'affiche normalement. Lot 16
  // (L16-ARC-01) : ce test passait par le module témoin hello, retiré.
  const titulaireSecret = await loginAndSetupMfa(page, email, password);
  await page.goto("/events");
  await expect(page.getByRole("heading", { level: 1, name: "Événements" })).toBeVisible();
  await expect(page.getByText("Le module Événements n'est pas activé pour votre organisation.")).toHaveCount(0);
  await logout(page);

  // L'Admin désactive le module Événements pour cette organisation (la liste
  // contient toutes les organisations créées par les autres tests : on
  // cible la ligne de celle-ci par son nom, pas un bouton générique).
  await loginAndSetupMfa(page, adminEmail, adminPassword);
  // Lot 13 (L13-HUB-17) : on retrouve l'organisation par son nom, ses modules
  // s'activent dans son panneau.
  await page.goto(`/exploitation/organisations?q=${encodeURIComponent(organizationName)}`);
  await page.getByRole("link", { name: organizationName }).click();
  const panel = page.getByRole("complementary", { name: organizationName });
  await panel.getByRole("button", { name: "Événements : activé (désactiver)" }).click();
  await expect(panel.getByRole("button", { name: "Événements : désactivé (activer)" })).toBeVisible();

  await page.goto("/exploitation/health");
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);
  await expect(page.getByRole("row", { name: /Base de données/ })).toContainText("en ligne");

  await page.goto("/");
  await logout(page);
  await expect(page).toHaveURL(/\/login$/);

  // Le titulaire voit « indisponible », sans erreur.
  await loginWithKnownMfa(page, email, password, titulaireSecret);
  await page.goto("/events");
  await expect(page.getByText("Le module Événements n'est pas activé pour votre organisation.")).toBeVisible();
});
