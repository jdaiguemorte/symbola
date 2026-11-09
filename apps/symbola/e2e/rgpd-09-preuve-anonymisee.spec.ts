// RGPD-09 (lot 19, ADR 0048) — preuve d'une demande close arrivée à son
// terme : elle apparaît dans la purge mensuelle avec le nom de la personne ;
// une fois la purge validée, la demande reste dans la liste, nom remplacé par
// « [anonymisé] », dates et journal gardés. En taille ordinateur et en 375 px,
// axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { privacyRequests } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { createUser } from "@symbola/auth";
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
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("RGPD-09 — la preuve d'une demande close depuis plus de 5 ans est anonymisée par la purge validée ; la demande et son journal restent", async ({ page }) => {
  const email = `owner-rgpd09-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-rgpd09-e2e";
  const person = `Camille Garnier${randomUUID().slice(0, 6)}`;
  const recent = `Louise Perrin${randomUUID().slice(0, 6)}`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const owner = await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    // Demande de rectification traitée et close le 2 mars 2020 : la preuve
    // (5 ans par défaut) est échue depuis le 2 mars 2025.
    const closedAt = new Date("2020-03-02T10:00:00Z");
    // Opposition close le 15 janvier 2026 : nom gardé jusqu'au 15 janvier 2031.
    const recentClosedAt = new Date("2026-01-15T10:00:00Z");
    await withOrganization(db, organization.id, (tx) =>
      tx.insert(privacyRequests).values([
        {
          organizationId: organization.id,
          type: "rectification",
          personLabel: person,
          receivedOn: "2020-02-10",
          dueOn: "2020-03-10",
          status: "closed",
          actionDoneAt: closedAt,
          responseSentAt: closedAt,
          closedAt,
          createdByUserId: owner.id,
          createdAt: new Date("2020-02-10T09:00:00Z"),
          updatedAt: closedAt,
        },
        {
          organizationId: organization.id,
          type: "objection",
          personLabel: recent,
          receivedOn: "2026-01-05",
          dueOn: "2026-02-05",
          status: "closed",
          actionDoneAt: recentClosedAt,
          responseSentAt: recentClosedAt,
          closedAt: recentClosedAt,
          createdByUserId: owner.id,
          createdAt: new Date("2026-01-05T09:00:00Z"),
          updatedAt: recentClosedAt,
        },
      ]),
    );
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, email, password);
  // La ligne arrive dans la purge du mois, avec le rappel du tableau de bord.
  await page.getByRole("region", { name: "Purge mensuelle : 1 ligne à examiner" }).getByRole("link", { name: "Purge mensuelle" }).click();
  await expect(page.getByRole("heading", { name: "Purge mensuelle", level: 1 })).toBeVisible();
  const line = page.getByRole("listitem").filter({ hasText: person });
  await expect(line).toContainText("Demande RGPD close (fin de la preuve de son traitement)");
  await expect(line).toContainText("échue le 2 mars 2025");
  // La demande close récemment n'est pas proposée.
  await expect(page.getByText(recent)).toHaveCount(0);
  await expectNoAxeViolation(page);

  await page.getByLabel("Je valide la purge des lignes non exclues : cette opération est irréversible.").check();
  await page.getByRole("button", { name: "Valider la purge" }).click();
  await expect(page.getByRole("status")).toHaveText("Terminée");
  await expect(page.getByText("Comptes, imports et demandes RGPD · Demande RGPD close (nom de la personne) : Anonymisée (1)")).toBeVisible();
  await expectNoAxeViolation(page);

  // La demande reste dans la liste, nom anonymisé ; plus rien à purger.
  await page.goto("/rgpd");
  await expect(page.getByText(person)).toHaveCount(0);
  // L'autre demande garde le nom ; son dossier dit jusqu'à quand.
  await page.getByRole("link", { name: recent }).click();
  await expect(page.getByText("Le nom de la personne est gardé comme preuve jusqu'au 15 janvier 2031.", { exact: false })).toBeVisible();
  await page.goto("/rgpd");
  await page.getByRole("row").filter({ hasText: "Rectification" }).getByRole("link", { name: "[anonymisé]" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rectification — [anonymisé]" })).toBeVisible();
  await expect(page.getByText("La conservation de la preuve est terminée : le nom de la personne a été anonymisé. Les dates et le journal restent.")).toBeVisible();
  await expect(page.getByText("Reçue le 10 février 2020 · échéance le 10 mars 2020")).toBeVisible();
  await expectNoAxeViolation(page);
  await page.goto("/rgpd/purge");
  await expect(page.getByText("Aucune donnée n'a dépassé sa durée de conservation.")).toBeVisible();
});
