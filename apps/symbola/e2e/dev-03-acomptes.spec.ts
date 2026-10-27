// DEV-03 — échéancier d'un devis (montant ou pourcentage, dépassement
// refusé, solde calculé), encaissements à venir avec retard signalé,
// paiement enregistré, bloc du tableau de bord. En taille ordinateur et en
// 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { saveOnboardingStep } from "../modules/hub/service";

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

// Dates calendaires à Paris, relatives à aujourd'hui.
function parisDate(offsetDays: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const value = new Date(`${today}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

test("DEV-03 — échéancier, encaissements à venir, retard et paiement", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `planner-dev03-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-dev03-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    await saveOnboardingStep(db, organization.id, { vatRegime: "franchise", vatRateDefaultBasisPoints: null });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Modes de paiement : modèle de départ.
  await page.goto("/devis/parametres");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Charger les modes de départ" }).click();
  await expect(page.getByRole("button", { name: "Archiver « Virement bancaire »" })).toBeVisible();
  await expectNoAxeViolation(page);

  // Un prospect et un devis de 3 000 €.
  await page.goto("/events/parametres");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Lou");
  await page.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page.getByRole("heading", { name: "Lou" })).toBeVisible();
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

  // Échéancier : 30 % (échéance passée) puis 500 € ; un dépassement est refusé.
  const addItem = page.getByRole("form", { name: "Ajouter l'échéance" });
  await addItem.getByLabel("Intitulé de l'échéance").fill("Acompte à la signature");
  await addItem.getByLabel("Date d'échéance").fill(parisDate(-3));
  await addItem.getByLabel("Montant ou pourcentage").selectOption("percent");
  await addItem.getByLabel("Valeur").fill("30");
  await addItem.getByRole("button", { name: "Ajouter l'échéance" }).click();
  await expect(page.getByText(/Solde : 2\s100,00\s€/)).toBeVisible();
  await addItem.getByLabel("Intitulé de l'échéance").fill("Deuxième acompte");
  await addItem.getByLabel("Date d'échéance").fill(parisDate(40));
  await addItem.getByLabel("Montant ou pourcentage").selectOption("amount");
  await addItem.getByLabel("Valeur").fill("500");
  await addItem.getByRole("button", { name: "Ajouter l'échéance" }).click();
  await expect(page.getByText(/Solde : 1\s600,00\s€/)).toBeVisible();
  await addItem.getByLabel("Intitulé de l'échéance").fill("Trop");
  await addItem.getByLabel("Date d'échéance").fill(parisDate(60));
  await addItem.getByLabel("Valeur").fill("2000");
  await addItem.getByRole("button", { name: "Ajouter l'échéance" }).click();
  await expect(addItem.getByRole("alert")).toHaveText(/La somme des acomptes dépasse le total du devis/);
  await expect(page.getByText(/Solde : 1\s600,00\s€/)).toBeVisible();
  await expectNoAxeViolation(page);

  await page.getByRole("button", { name: "Marquer comme envoyé" }).click();
  await expect(page.getByText(/^Statut : Envoyé/)).toBeVisible();

  // Encaissements : l'échéance dépassée est « En retard », en tête.
  await page.goto("/devis/encaissements");
  await page.waitForLoadState("networkidle");
  const overdue = page.getByRole("region", { name: /^En retard — 900,00\s€$/ });
  await expect(overdue.getByRole("listitem")).toHaveCount(1);
  await expect(overdue.getByRole("listitem")).toContainText("Acompte à la signature");
  await expect(overdue.getByText("En retard", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Deuxième acompte" })).toContainText("(Lou)");
  await expectNoAxeViolation(page);

  // Le tableau de bord montre aussi le retard.
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const block = page.getByRole("region", { name: "Encaissements à venir" });
  await expect(block.getByText("Acompte à la signature")).toBeVisible();
  await expect(block.getByText("Deuxième acompte")).toBeVisible();

  // Marquer payée : date et mode de paiement.
  await page.goto(quoteUrl);
  await page.waitForLoadState("networkidle");
  await page.getByText("Marquer payée l'échéance « Acompte à la signature »").click();
  const pay = page.getByRole("form", { name: "Marquer payée l'échéance « Acompte à la signature »" });
  await pay.getByLabel("Mode de paiement").selectOption({ label: "Virement bancaire" });
  await pay.getByRole("button", { name: "Marquer payée" }).click();
  await expect(page.getByText(/^Payée le .* \(Virement bancaire\)$/)).toBeVisible();
  await expectNoAxeViolation(page);

  await page.goto("/devis/encaissements");
  await expect(page.getByText("Acompte à la signature")).toHaveCount(0);
  await expect(page.getByText("Deuxième acompte")).toBeVisible();
});
