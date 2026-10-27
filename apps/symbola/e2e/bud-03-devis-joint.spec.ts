// BUD-03 — devis prestataire joint à une ligne du budget (PDF ou image,
// antivirus, stockage privé), ouvert par lien signé temporaire. En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
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

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("BUD-03 — joindre le devis d'un prestataire à une ligne et l'ouvrir par lien signé", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `planner-bud03-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-bud03-e2e";
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

  // BUD-03 : un format non supporté est refusé avec un message clair.
  await page.goto(eventUrl.replace("/events/", "/budget/"));
  await page.waitForLoadState("networkidle");
  const lieuRow = page.getByRole("table", { name: "Prévu, réel, écart" }).getByRole("row", { name: /Lieu de réception/ });
  const quoteInput = lieuRow.getByLabel(/Devis du prestataire — Lieu de réception/);
  await quoteInput.setInputFiles({ name: "devis.txt", mimeType: "text/plain", buffer: Buffer.from("devis en texte") });
  await lieuRow.getByRole("button", { name: "Joindre le devis" }).click();
  await expect(lieuRow.getByRole("alert")).toHaveText("Format non supporté : joignez un PDF ou une image.");

  // Un PDF est accepté, puis s'ouvre par un lien signé temporaire.
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");
  await quoteInput.setInputFiles({ name: "devis-lieu.pdf", mimeType: "application/pdf", buffer: pdf });
  await lieuRow.getByRole("button", { name: "Joindre le devis" }).click();
  await expect(lieuRow.getByText("Devis joint.")).toBeVisible();
  const link = lieuRow.getByRole("link", { name: /Ouvrir le devis 1 — Lieu de réception/ });
  await expect(link).toBeVisible();
  await expectNoAxeViolation(page);

  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/budget\/[0-9a-f-]{36}\/devis\/[0-9a-f-]{36}$/);
  const redirect = await page.request.get(href!, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(new URL(redirect.headers()["location"]!).searchParams.get("X-Amz-Expires")).toBe("300");
  const opened = await page.request.get(href!);
  expect(opened.status()).toBe(200);
  expect((await opened.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // Sans session, le devis ne s'ouvre pas.
  const anonymous = await page.context().browser()!.newContext();
  expect((await anonymous.request.get(new URL(href!, page.url()).toString(), { maxRedirects: 0 })).status()).toBe(401);
  await anonymous.close();
});
