// DEV-04 — depuis un devis signé (faux fournisseur de signature en dev) :
// facture d'acompte puis de solde, numéros de la série factures, PDF, avoir,
// puis e-reporting de la période. En taille ordinateur et en 375 px,
// axe-core sur chaque écran.
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

test("DEV-04 — facturer un devis signé (acompte, solde, avoir) puis exporter l'e-reporting", async ({ page }) => {
  test.setTimeout(150_000);
  const email = `planner-dev04-${randomUUID()}@symbola.test`;
  const signerEmail = `ines-dev04-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-dev04-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    await saveOnboardingStep(db, organization.id, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, address: "1 rue des Lilas", siren: "123456789" });
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
  await freeLine.getByLabel("Prix unitaire HT (€)").fill("3000");
  await freeLine.getByRole("button", { name: "Ajouter la ligne" }).click();
  await expect(freeLine.getByText("Ligne ajoutée.")).toBeVisible();
  const addItem = page.getByRole("form", { name: "Ajouter l'échéance" });
  await addItem.getByLabel("Intitulé de l'échéance").fill("Acompte à la signature");
  await addItem.getByLabel("Date d'échéance").fill("2030-01-15");
  await addItem.getByLabel("Montant ou pourcentage").selectOption("percent");
  await addItem.getByLabel("Valeur").fill("30");
  await addItem.getByRole("button", { name: "Ajouter l'échéance" }).click();
  await expect(page.getByText(/Solde : 2\s100,00\s€/)).toBeVisible();

  // Signature par le faux fournisseur.
  const send = page.getByRole("form", { name: "Envoyer en signature" });
  const first = send.getByRole("group", { name: "Signataire 1" });
  await first.getByLabel("E-mail").fill(signerEmail);
  await first.getByLabel("Adresse de facturation").fill("3 place Bellecour, 69002 Lyon");
  await send.getByRole("button", { name: "Envoyer en signature" }).click();
  await expect(page.getByText("En attente de signature.")).toBeVisible();
  await page.goto(new URL(await signingLinkSentTo(signerEmail)).pathname);
  await page.getByRole("button", { name: "Signer le devis" }).click();
  await expect(page.getByText("Vous avez signé ce devis.")).toBeVisible();

  // Facture d'acompte, puis de solde : numéros continus de la série factures.
  await page.goto(quoteUrl);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/^Statut : Signé/)).toBeVisible();
  await page.getByRole("button", { name: "Émettre la facture d'acompte « Acompte à la signature »" }).click();
  await expect(page.getByText(/^F-\d{4}-0001 — Facture d'acompte/)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Émettre la facture de solde" }).click();
  await expect(page.getByText(/^F-\d{4}-0002 — Facture de solde/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Émettre la facture de solde" })).toHaveCount(0);
  await expectNoAxeViolation(page);

  const invoicePdf = page.getByRole("link", { name: /^PDF de la facture F-\d{4}-0002$/ });
  const pdf = await page.request.get((await invoicePdf.getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // Correction par avoir : la facture ne change pas.
  await page.getByText(/^Établir un avoir sur la facture F-\d{4}-0001$/).click();
  const credit = page.getByRole("form", { name: /^Établir un avoir sur la facture F-\d{4}-0001$/ });
  await credit.getByLabel("Montant TTC de l'avoir (€)").fill("100");
  await credit.getByLabel("Motif").fill("Geste commercial");
  await credit.getByRole("button", { name: "Émettre l'avoir" }).click();
  await expect(page.getByText(/^A-\d{4}-0001 — .* — Geste commercial/)).toBeVisible();
  await expect(page.getByText(/dont 100,00\s€ annulés par avoir/)).toBeVisible();

  // E-reporting de l'année en cours : factures, avoir, export CSV.
  const year = new Date().getFullYear();
  await page.goto(`/devis/e-reporting?from=${year}-01-01&to=${year}-12-31`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("2 factures")).toBeVisible();
  await expect(page.getByText("1 avoir")).toBeVisible();
  await expectNoAxeViolation(page);
  const csv = await page.request.get(`/devis/e-reporting/export?from=${year}-01-01&to=${year}-12-31`);
  expect(csv.status()).toBe(200);
  const content = await csv.text();
  expect(content).toMatch(new RegExp(`Facture;${year}-\\d{2}-\\d{2};F-${year}-0001;;Facture d'acompte;900,00;0,00;900,00;`));
  expect(content).toMatch(/Avoir;.*;A-\d{4}-0001;F-\d{4}-0001;;-100,00;0,00;-100,00;/);
});
