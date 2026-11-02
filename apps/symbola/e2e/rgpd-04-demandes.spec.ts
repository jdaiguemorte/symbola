// RGPD-04 — suivi des demandes : une demande proche de son échéance apparaît
// en alerte au tableau de bord ; la prolonger exige un motif et repousse
// l'échéance à trois mois ; clôture. En taille ordinateur et en 375 px,
// axe-core sur chaque écran.
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

// Date de Paris il y a `days` jours, au format du champ date.
function parisDaysAgo(days: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() - days * 86_400_000));
}

test("RGPD-04 — demande en alerte au tableau de bord, prolongée avec motif, puis close", async ({ page }) => {
  const email = `owner-rgpd04-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-rgpd04-e2e";
  const person = `Élodie ${randomUUID().slice(0, 6)}`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  await page.goto("/rgpd/demandes");
  await expect(page.getByRole("heading", { name: "Demandes d'exercice de droits" })).toBeVisible();
  await expectNoAxeViolation(page);
  // Reçue il y a 28 jours : l'échéance d'un mois est à moins de 7 jours.
  await page.getByLabel("Type de demande").selectOption({ label: "Oubli (effacement)" });
  await page.getByLabel("Personne concernée").fill(person);
  await page.getByLabel("Reçue le").fill(parisDaysAgo(28));
  await page.getByRole("button", { name: "Enregistrer la demande" }).click();
  await expect(page.getByText("Demande enregistrée : l'échéance légale est d'un mois.")).toBeVisible();
  const request = page.getByRole("listitem").filter({ hasText: person });
  await expect(request).toContainText("en cours");
  await expect(request).toContainText("À traiter en priorité");
  await expectNoAxeViolation(page);

  await page.goto("/");
  const alert = page.getByRole("region", { name: "Demande RGPD à traiter rapidement" });
  await expect(alert).toContainText(`Oubli (effacement) — ${person}`);
  await expectNoAxeViolation(page);

  // Prolongation : motif obligatoire, échéance à trois mois.
  await alert.getByRole("link", { name: "Demandes des personnes" }).click();
  await request.getByLabel(`Motif de la prolongation (demande de « ${person} »)`).fill("Données dans plusieurs modules");
  await request.getByRole("button", { name: "Prolonger (trois mois au total)" }).click();
  await expect(request).toContainText("prolongée");
  await expect(request).toContainText("Prolongée : Données dans plusieurs modules");
  await expect(request).not.toContainText("À traiter en priorité");
  await page.goto("/");
  await expect(page.getByRole("region", { name: /RGPD à traiter rapidement/ })).toHaveCount(0);

  await page.goto("/rgpd/demandes");
  await request.getByRole("button", { name: `Clore la demande de « ${person} »` }).click();
  await expect(request).toContainText("close");
  await expect(request).toContainText("traitée");
  await expectNoAxeViolation(page);
});
