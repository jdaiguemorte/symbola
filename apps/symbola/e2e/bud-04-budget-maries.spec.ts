// BUD-04 — le marié invité voit le budget de son événement (poste, prévu,
// réel, écart, totaux) en lecture seule, sans aucun formulaire, et les
// écrans budget de la planner lui restent fermés. En taille ordinateur et
// en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
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

const MAILPIT_API = "http://localhost:8025/api/v1";

async function waitForClientInvitationLink(to: string, attempts = 30): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await response.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const detail = await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}`);
      const { Text } = (await detail.json()) as { Text: string };
      const match = Text.match(/https?:\/\/\S*\/espace\/invitation\/\S+/);
      if (match) return new URL(match[0]).pathname;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`aucun e-mail d'invitation reçu pour ${to}`);
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("BUD-04 — le marié consulte le budget de son événement en lecture seule", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const email = `planner-bud04-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-bud04-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Prérequis (même parcours que BUD-02) : postes, source, modèle, budget prévu.
  await page.goto("/events/parametres");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Charger le modèle de départ" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Lieu de réception" })).toBeVisible();
  await page.getByLabel("Nouvelle source").fill("Instagram");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await page.goto("/budget/parametres");
  await page.waitForLoadState("networkidle");
  // AIDE-01 : première ouverture du module, la visite guidée s'affiche.
  await page.getByRole("dialog").getByRole("button", { name: "Passer" }).click();
  await page.getByLabel("Nom du modèle").fill("Classique");
  await page.getByLabel("Lieu de réception %").fill("60");
  await page.getByLabel("Traiteur %").fill("40");
  await page.getByRole("button", { name: "Créer le modèle" }).click();
  await expect(page.getByText("Modèle créé.")).toBeVisible();
  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Camille");
  await page.getByLabel("Source du prospect").selectOption({ label: "Instagram" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page.getByRole("heading", { name: "Camille" })).toBeVisible();
  const eventUrl = page.url();
  await page.getByRole("link", { name: "Budget" }).click();
  await page.getByLabel("Budget total (€)").fill("10000");
  await page.getByLabel("Nombre d'invités").fill("40");
  await page.getByLabel("Modèle de répartition").selectOption({ label: "Classique" });
  await page.getByRole("button", { name: "Simuler" }).click();
  await expect(page.getByText("250,00 €", { exact: false })).toBeVisible();
  await page.goto(eventUrl);
  await page.waitForLoadState("networkidle");
  await page.locator('select[name="toStatus"]').selectOption("confirmed");
  await page.getByRole("button", { name: "Changer le statut" }).click();
  await page.getByRole("button", { name: "En faire le budget prévu" }).click();
  await expect(page.getByRole("heading", { name: "Faire de la simulation le budget prévu" })).toHaveCount(0);

  // La planner saisit un réel sur le lieu (6 000 € prévus, 7 000 € réels).
  const eventId = eventUrl.split("/").pop()!;
  await page.goto(`/budget/${eventId}`);
  await page.waitForLoadState("networkidle");
  const plannerRow = page.getByRole("table", { name: "Prévu, réel, écart" }).getByRole("row", { name: /Lieu de réception/ });
  await plannerRow.getByLabel(/Réel —/).fill("7000");
  await plannerRow.getByRole("button", { name: "Mettre à jour le réel" }).click();
  await expect(plannerRow).toContainText("Dépassement de 1 000,00 €");

  // Elle invite le marié depuis la fiche.
  const coupleEmail = `marie-bud04-${randomUUID()}@symbola.test`;
  const couplePassword = "mot-de-passe-du-marie-bud04";
  await page.goto(eventUrl);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail du marié").fill(coupleEmail);
  await page.getByRole("button", { name: "Inviter le marié" }).click();
  await expect(page.getByText("Invitation envoyée.")).toBeVisible();

  const coupleContext = await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() });
  const couple = await coupleContext.newPage();
  await couple.goto(await waitForClientInvitationLink(coupleEmail));
  await couple.waitForLoadState("networkidle");
  await couple.getByLabel("Choisissez un mot de passe (12 caractères minimum)").fill(couplePassword);
  await couple.getByLabel("Confirmez le mot de passe").fill(couplePassword);
  await couple.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(couple.getByText("Votre compte est créé.")).toBeVisible();
  await couple.goto("/login");
  await couple.getByLabel("E-mail").fill(coupleEmail);
  await couple.getByLabel("Mot de passe").fill(couplePassword);
  await couple.getByRole("button", { name: "Se connecter" }).click();
  await expect(couple).toHaveURL(/\/espace$/);

  // BUD-04 : le budget apparaît dans son espace, en lecture seule.
  await couple.goto(`/espace/${eventId}`);
  const budget = couple.getByRole("region", { name: "Budget" });
  const table = budget.getByRole("table", { name: "Prévu, réel, écart" });
  const coupleRow = table.getByRole("row", { name: /Lieu de réception/ });
  await expect(coupleRow).toContainText("6 000,00 €");
  await expect(coupleRow).toContainText("7 000,00 €");
  await expect(coupleRow).toContainText("Dépassement de 1 000,00 €");
  await expect(budget.getByRole("textbox")).toHaveCount(0);
  await expect(budget.getByRole("spinbutton")).toHaveCount(0);
  await expect(budget.getByRole("button")).toHaveCount(0);
  await expectNoAxeViolation(couple);

  // Les écrans budget de la planner lui restent fermés.
  await couple.goto(`/budget/${eventId}`);
  await expect(couple).toHaveURL(/\/espace$/);
  await couple.goto("/budget/parametres");
  await expect(couple).toHaveURL(/\/espace$/);
  await coupleContext.close();
});
