// Lot 23 — HUB-16 : journal d'activité de l'organisation, lisible par la
// titulaire (décision D4) : qui, quoi, quand, sur quel objet. Sa propre
// connexion y figure ; un filtre par famille ; un collaborateur n'y a pas
// accès. En taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { readyOrganization } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(
    provisioningUri!.replace("otpauth://totp/", "https://x/"),
  ).searchParams.get("secret")!;
  await page
    .getByLabel("Code")
    .fill(
      new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(secret),
      }).generate(),
    );
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual(
    [],
  );
}

async function organizationWith(role: "owner" | "member") {
  const email = `${role}-hub16-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-hub16-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, {
      organizationId: organization.id,
      email,
      password,
      role,
    });
  } finally {
    await sql.end();
  }
  return { email, password };
}

// Taille ordinateur et 375 px : les deux projets de playwright.config.ts.
test("HUB-16 — la titulaire lit son journal : sa connexion y figure, filtrée par famille", async ({
  page,
}) => {
  const owner = await organizationWith("owner");
  await loginAndSetupMfa(page, owner.email, owner.password);

  await page.goto("/parametres/journal");
  await expect(
    page.getByRole("heading", { level: 1, name: "Journal d'activité" }),
  ).toBeVisible();
  const log = page.getByRole("region", { name: "Activité de l'organisation" });
  await expect(
    log
      .getByRole("row")
      .filter({ hasText: "Double authentification configurée" }),
  ).toContainText(owner.email);
  await expect(
    log.getByRole("row").filter({ hasText: "avec le code" }),
  ).toContainText("Connexion");
  await expectNoAxeViolation(page);

  await page.getByLabel("Famille").selectOption({ label: "Émissions" });
  await expect(page).toHaveURL(/famille=emission/);
  await expect(
    page.getByText("Aucune activité sur cette période."),
  ).toBeVisible();
  await expectNoAxeViolation(page);
});

test("HUB-16 — un collaborateur n'a pas accès au journal d'activité", async ({
  page,
}) => {
  const member = await organizationWith("member");
  await loginAndSetupMfa(page, member.email, member.password);
  await page.goto("/parametres/journal");
  await expect(
    page.getByText(
      "Le journal d'activité est réservé à la titulaire du compte.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Activité de l'organisation" }),
  ).toHaveCount(0);
  await expectNoAxeViolation(page);
});
