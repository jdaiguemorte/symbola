// Lot 33b (HUB-03, D12) — la Propriétaire invite une Planner : invitation par e-mail, acceptation
// sans mot de passe, connexion par lien ; la Planner a les modules, pas l'équipe. En taille
// ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { logout, readyOrganization, signIn } from "./helpers";

const MAILPIT_API = "http://localhost:8025/api/v1";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function invitationLink(to: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { messages } = (await (await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json()) as { messages?: { ID: string }[] };
    if (messages && messages.length > 0) {
      const { Text } = (await (await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}`)).json()) as { Text: string };
      const link = Text.match(/https?:\/\/\S*\/invitations\/\S+/)?.[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("aucune invitation reçue");
}

test("HUB-03 — la Propriétaire invite une Planner, qui rejoint l'organisation et a les modules mais pas l'équipe", async ({ page }) => {
  const ownerEmail = `titulaire-equipe-${randomUUID()}@symbola.test`;
  const plannerEmail = `planner-equipe-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier équipe ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email: ownerEmail, role: "owner" });
  } finally {
    await sql.end();
  }

  await signIn(page, ownerEmail);
  await page.goto("/parametres/equipe");
  await expect(page.getByRole("heading", { name: "Inviter une Planner" })).toBeVisible();
  await page.getByLabel("Adresse e-mail de la Planner").fill(plannerEmail);
  await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Invitation envoyée." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invitations en attente" })).toBeVisible();
  await expect(page.getByText(`${plannerEmail}, valable jusqu'au`, { exact: false })).toBeVisible();
  await expectNoAxeViolation(page);
  // Une adresse déjà dans l'équipe (ici la Propriétaire elle-même) n'est pas invitée.
  await page.getByLabel("Adresse e-mail de la Planner").fill(ownerEmail);
  await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Cette personne fait déjà partie de votre équipe." })).toBeVisible();

  // La Planner accepte, sans mot de passe, puis se connecte par le lien reçu.
  await logout(page);
  await page.goto(await invitationLink(plannerEmail));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Atelier équipe");
  await page.getByRole("button", { name: "Accepter et recevoir mon lien de connexion" }).click();
  await expect(page.getByRole("status")).toContainText("Un lien de connexion vient de partir");
  await signIn(page, plannerEmail);

  // Tous les modules ; l'équipe reste à la Propriétaire.
  await page.goto("/events");
  await expect(page).toHaveURL(/\/events$/);
  await page.goto("/parametres/equipe");
  await expect(page.getByText("L'équipe se gère par la Propriétaire du compte.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inviter une Planner" })).toHaveCount(0);
});
