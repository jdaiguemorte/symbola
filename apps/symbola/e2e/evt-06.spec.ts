// EVT-06 — accès des mariés : la planner invite un marié par e-mail
// (Mailpit), il crée son compte, voit le rétroplanning et le programme
// sans notes internes, coche sa tâche (visible dans le fil d'activité de
// la planner), active s'il le souhaite la double authentification ; les
// écrans de la planner lui sont fermés, et la planner retire l'accès. En
// taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

const MAILPIT_API = "http://localhost:8025/api/v1";

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

test("EVT-06 — le marié invité suit son mariage, coche sa tâche, et perd l'accès quand la planner le retire", async ({
  page: planner,
  browser,
}) => {
  // Parcours long (deux comptes, deux navigateurs, e-mail, PDF) : plus que les 30 s par défaut.
  test.setTimeout(120_000);
  const plannerEmail = `planner-evt06-${randomUUID()}@symbola.test`;
  const plannerPassword = "mot-de-passe-evt06-e2e";
  const coupleEmail = `marie-evt06-${randomUUID()}@symbola.test`;
  const couplePassword = "mot-de-passe-du-marie-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email: plannerEmail, password: plannerPassword, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(planner, plannerEmail, plannerPassword);

  // La planner prépare l'événement : une tâche des mariés, une note interne.
  await planner.goto("/events/parametres");
  await planner.getByLabel("Nouvelle source").fill("Salon");
  await planner.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(planner.getByText("Source ajoutée.")).toBeVisible();
  await planner.goto("/events/new");
  await planner.getByLabel("Prénom du premier marié", { exact: true }).fill("Inès");
  await planner.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await planner.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(planner).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  const eventId = planner.url().split("/").pop()!;
  await planner.waitForLoadState("networkidle");

  const newTask = planner.getByRole("group", { name: "Nouvelle tâche" });
  await newTask.getByLabel("Intitulé de la tâche").fill("Choisir les alliances");
  await newTask.getByLabel("Échéance").fill("2027-03-10");
  await newTask.getByLabel("Responsable").selectOption("clients");
  await newTask.getByRole("button", { name: "Ajouter la tâche" }).click();
  await expect(planner.getByText("Tâche ajoutée.")).toBeVisible();

  const newLine = planner.getByRole("group", { name: "Nouvelle ligne du programme" });
  await newLine.getByLabel("Heure de début").fill("15:00");
  await newLine.getByLabel("Intitulé de la ligne").fill("Cérémonie");
  await newLine.getByLabel("Note interne").fill("Le témoin oublie toujours les alliances");
  await newLine.getByRole("button", { name: "Ajouter la ligne" }).click();
  await expect(planner.getByText("Ligne ajoutée.")).toBeVisible();

  // Invitation du marié par e-mail.
  await planner.getByLabel("E-mail du marié").fill(coupleEmail);
  await planner.getByRole("button", { name: "Inviter le marié" }).click();
  await expect(planner.getByText("Invitation envoyée.")).toBeVisible();
  await expect(planner.getByRole("list", { name: "Accès des mariés" })).toContainText(`${coupleEmail} — invitation envoyée`);
  await expectNoAxeViolation(planner);

  // Le marié crée son propre compte, sans double authentification imposée.
  const coupleContext = await browser.newContext({ locale: "fr-FR", viewport: planner.viewportSize() });
  const couple = await coupleContext.newPage();
  await couple.goto(await waitForClientInvitationLink(coupleEmail));
  await couple.waitForLoadState("networkidle");
  await expectNoAxeViolation(couple);
  await couple.getByLabel("Choisissez un mot de passe (12 caractères minimum)").fill(couplePassword);
  await couple.getByLabel("Confirmez le mot de passe").fill(couplePassword);
  await couple.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(couple.getByText("Votre compte est créé.")).toBeVisible();

  await couple.goto("/login");
  await couple.getByLabel("E-mail").fill(coupleEmail);
  await couple.getByLabel("Mot de passe").fill(couplePassword);
  await couple.getByRole("button", { name: "Se connecter" }).click();
  await expect(couple).toHaveURL(/\/espace$/);
  await expectNoAxeViolation(couple);

  // Il voit le rétroplanning, coche sa tâche, et le programme sans notes internes.
  await couple.getByRole("link", { name: /Inès/ }).click();
  await expect(couple).toHaveURL(new RegExp(`/espace/${eventId}$`));
  await expect(couple.getByRole("listitem").filter({ hasText: "Choisir les alliances" })).toContainText("À faire par vous");
  await expect(couple.getByRole("list", { name: "Programme du jour J" })).toContainText("15:00 — Cérémonie");
  await expect(couple.getByText("oublie toujours")).toHaveCount(0);
  await expectNoAxeViolation(couple);
  await couple.getByRole("button", { name: "Cocher la tâche Choisir les alliances" }).click();
  await expect(couple.getByRole("button", { name: "Décocher la tâche Choisir les alliances" })).toBeVisible();

  const pdf = await couple.request.get(`/espace/${eventId}/programme/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-disposition"]).toContain("programme-maries.pdf");

  // Les écrans et exports de la planner lui sont fermés.
  await couple.goto(`/events/${eventId}`);
  await expect(couple).toHaveURL(/\/espace$/);
  await couple.goto("/events");
  await expect(couple).toHaveURL(/\/espace$/);
  expect((await couple.request.get(`/events/${eventId}/programme/pdf?variant=vendors`)).status()).toBe(401);
  await couple.goto(`/espace/${randomUUID()}`);
  await expect(couple.getByRole("heading", { level: 1 })).not.toContainText("Inès");

  // Double authentification proposée, sans être obligatoire.
  await couple.goto("/espace/securite");
  await couple.waitForLoadState("networkidle");
  await couple.getByRole("button", { name: "Activer la double authentification" }).click();
  const provisioningUri = await couple.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await couple.getByLabel("Code à 6 chiffres").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await couple.getByRole("button", { name: "Confirmer" }).click();
  await expect(couple.getByText("Double authentification activée")).toBeVisible();
  await expectNoAxeViolation(couple);

  // La planner voit la tâche cochée dans le fil d'activité, puis retire l'accès.
  await planner.reload();
  await expect(planner.getByRole("list", { name: "Fil d'activité" })).toContainText(
    `${coupleEmail} a coché « Choisir les alliances ».`,
  );
  await planner.getByRole("button", { name: `Retirer l'accès de ${coupleEmail}` }).click();
  await expect(planner.getByRole("list", { name: "Accès des mariés" })).toContainText(`${coupleEmail} — accès retiré`);
  await expectNoAxeViolation(planner);

  await couple.goto(`/espace/${eventId}`);
  await expect(couple.getByText("Choisir les alliances")).toHaveCount(0);
  await couple.goto("/espace");
  await expect(couple.getByText("Aucun événement n'est partagé avec vous pour l'instant.")).toBeVisible();
  await coupleContext.close();
});
