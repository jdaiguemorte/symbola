// Lot 29b (JRJ-04, décision D8 ; ADR 0064) — documents embarqués : la planner envoie
// le plan de table depuis l'onglet « Documents » de la fiche, le choisit sur l'écran
// du jour J, garde le jour J sur l'appareil ; en mode avion, le plan de table s'ouvre
// (SC-08 étape 3). Tests d'abus : document d'une autre organisation, pièce d'un autre
// événement glissée dans le formulaire du choix. En taille ordinateur et en 375 px,
// axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { parisToday } from "@symbola/i18n";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { attachEventDocument, changeEventStatus, createProspect, createProspectSource } from "../modules/events/service";
import { readyOrganization } from "./helpers";

const PASSWORD = "mot-de-passe-documents-e2e";
const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Une organisation, sa titulaire, deux mariages confirmés demain (le second sert aux abus).
async function organization() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    const email = `planner-jrj04-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const wedding = async (firstName: string) => {
      const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName }], eventDate: addDays(parisToday(), 1) });
      await changeEventStatus({ organizationId, eventId: event.id, changedByUserId: owner.id, toStatus: "confirmed" });
      return event.id;
    };
    return { organizationId, ownerId: owner.id, email, wedding };
  } finally {
    await sql.end();
  }
}

test("JRJ-04 / SC-08 étape 3 — le plan de table envoyé, embarqué, s'ouvre en mode avion", async ({ page, context }) => {
  test.setTimeout(120_000);
  const org = await organization();
  const eventId = await org.wedding("Léa");
  await login(page, org.email);

  // Onglet « Documents » de la fiche : envoi du plan de table.
  await page.goto(`/events/${eventId}?onglet=documents`);
  await expect(page.getByRole("heading", { name: "Documents de l'événement" })).toBeVisible();
  await page.getByLabel("Intitulé").fill("Plan de table");
  await page.getByLabel("Fichier (PDF ou image, 20 Mo au plus)").setInputFiles({ name: "plan.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
  await page.getByRole("button", { name: "Envoyer le document" }).click();
  await expect(page.getByRole("status")).toHaveText("Document ajouté.");
  await expect(page.getByRole("link", { name: "Plan de table", exact: true })).toBeVisible();
  await expectNoAxeViolation(page);

  // Écran du jour J : choisir les documents embarqués.
  await page.getByRole("link", { name: "Choisir les documents à embarquer pour le jour J" }).click();
  await expect(page).toHaveURL(new RegExp(`/jour-j/${eventId}#documents$`));
  await page.getByText("Choisir les documents embarqués").click();
  await page.getByRole("checkbox", { name: /Plan de table/ }).check();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Enregistrer le choix" }).click();
  const documents = page.getByRole("region", { name: "Documents" });
  await expect(documents.getByRole("link", { name: "Plan de table", exact: true })).toBeVisible();
  await expect(documents).toContainText("Document de l'événement");

  // Garder sur l'appareil, puis le mode avion.
  await page.getByRole("button", { name: "Garder sur cet appareil" }).click();
  await expect(page.getByRole("status").first()).toContainText("Prêt hors ligne");
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("status").first()).toContainText("Sans réseau");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("region", { name: "Documents" }).getByRole("link", { name: "Plan de table", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("Plan-de-table.pdf");
  await context.setOffline(false);
});

test("JRJ-04 — abus : document d'une autre organisation, pièce d'un autre événement glissée dans le choix : refus", async ({ page }) => {
  test.setTimeout(120_000);
  const mine = await organization();
  const other = await organization();
  const eventId = await mine.wedding("Léa");
  const secondEventId = await mine.wedding("Inès");
  const theirEventId = await other.wedding("Bérénice");
  const attach = (org: typeof mine, event: string, label: string) =>
    attachEventDocument({ organizationId: org.organizationId, eventId: event, label, content: new Uint8Array(TINY_PDF), uploadedByUserId: org.ownerId });
  const mineDocument = await attach(mine, eventId, "Plan de table");
  const secondDocument = await attach(mine, secondEventId, "Plan B d'Inès");
  const theirDocument = await attach(other, theirEventId, "Plan de Bérénice");
  await login(page, mine.email);

  // Ni le document d'une autre organisation, ni celui d'un autre événement, par l'écran du jour J.
  for (const path of [
    `/jour-j/${eventId}/documents/event_document/${theirDocument.id}`,
    `/jour-j/${theirEventId}/documents/event_document/${theirDocument.id}`,
    `/jour-j/${eventId}/documents/event_document/${secondDocument.id}`,
    `/jour-j/${eventId}/documents/vendor_file/${mineDocument.id}`,
  ]) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
  expect((await page.request.get(`/events/${theirEventId}/documents/${theirDocument.id}`)).status()).toBe(404);
  expect((await page.request.get(`/jour-j/${eventId}/documents/event_document/${mineDocument.id}`)).status()).toBe(200);

  // Une pièce d'un autre événement glissée dans le formulaire du choix est ignorée.
  await page.goto(`/jour-j/${eventId}`);
  await page.getByText("Choisir les documents embarqués").click();
  await page.getByRole("checkbox", { name: /Plan de table/ }).evaluate((input, value) => {
    (input as HTMLInputElement).value = value;
    (input as HTMLInputElement).checked = true;
  }, `event_document:${secondDocument.id}`);
  // L'écran se recharge après l'enregistrement.
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Enregistrer le choix" }).click()]);
  await expect(page.getByRole("region", { name: "Documents" }).getByRole("link", { name: "Plan B d'Inès" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Documents" }).getByRole("link", { name: "Plan de table", exact: true })).toHaveCount(0);
});
