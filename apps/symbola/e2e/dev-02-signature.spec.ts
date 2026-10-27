// DEV-02 — envoi d'un devis en signature (signataire saisi sur le devis),
// lien reçu par e-mail, signature sur la page du fournisseur (faux
// fournisseur en dev, ADR 0021), devis signé avec documents archivés. En
// taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { saveOnboardingStep } from "../modules/hub/service";

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

async function signingLinkSentTo(to: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const { messages } = (await (await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as {
      messages: { ID: string }[];
    };
    if (messages.length > 0) {
      const { Text } = (await (await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}`)).json()) as { Text: string };
      const link = /https?:\/\/\S+\/signature-fictive\/[0-9a-f-]{36}/.exec(Text)?.[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("e-mail de signature non reçu");
}

test("DEV-02 — envoyer un devis en signature, signer par le lien reçu, archiver le devis signé", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `planner-dev02-${randomUUID()}@symbola.test`;
  const signerEmail = `ines-dev02-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-dev02-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    await saveOnboardingStep(db, organization.id, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, address: "1 rue des Lilas" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  await page.goto("/events/parametres");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Inès");
  await page.getByLabel("Nom du premier marié", { exact: true }).fill("Martin");
  await page.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page.getByRole("heading", { name: "Inès" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Créer un devis" }).click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);
  const quoteUrl = page.url();
  await page.waitForLoadState("networkidle");
  const freeLine = page.getByRole("form", { name: "Ajouter une ligne libre" });
  await freeLine.getByLabel("Intitulé").fill("Coordination");
  await freeLine.getByLabel("Unité").fill("forfait");
  await freeLine.getByLabel("Prix unitaire HT (€)").fill("1800");
  await freeLine.getByRole("button", { name: "Ajouter la ligne" }).click();
  await expect(freeLine.getByText("Ligne ajoutée.")).toBeVisible();

  // Signataire saisi sur le devis, pré-rempli depuis les mariés de l'événement.
  const send = page.getByRole("form", { name: "Envoyer en signature" });
  const first = send.getByRole("group", { name: "Signataire 1" });
  await expect(first.getByLabel("Nom et prénom")).toHaveValue("Inès Martin");
  await first.getByLabel("E-mail").fill(signerEmail);
  await first.getByLabel("Adresse de facturation").fill("3 place Bellecour, 69002 Lyon");
  await expectNoAxeViolation(page);
  await send.getByRole("button", { name: "Envoyer en signature" }).click();
  await expect(page.getByText("En attente de signature.")).toBeVisible();
  await expect(page.getByText(/^Statut : Envoyé/)).toBeVisible();
  await expectNoAxeViolation(page);

  // Le signataire reçoit son lien par un e-mail de Symbola, et signe.
  const link = await signingLinkSentTo(signerEmail);
  await page.goto(new URL(link).pathname);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Signature du devis D-\d{4}-0001$/);
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Signer le devis" }).click();
  await expect(page.getByText("Vous avez signé ce devis.")).toBeVisible();

  // Devis signé, documents archivés et téléchargeables.
  await page.goto(quoteUrl);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Devis signé par tous les signataires.")).toBeVisible();
  await expect(page.getByText(/^Statut : Signé/)).toBeVisible();
  const signed = await page.request.get(`${new URL(quoteUrl).pathname}/signature/signed`);
  expect(signed.status()).toBe(200);
  expect((await signed.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  await expectNoAxeViolation(page);
});
