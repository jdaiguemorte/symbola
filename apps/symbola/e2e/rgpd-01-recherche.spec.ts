// RGPD-01 — recherche transverse : la titulaire retrouve une personne et les
// données de son événement, groupées par module ; rien d'une autre
// organisation ; un collaborateur n'a pas accès au module. En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { eventClients, events, eventTasks, prospectSources } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { openSettingsTab, readyOrganization } from "./helpers";

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

async function seedWedding(db: ReturnType<typeof createAppConnection>["db"], organizationId: string, lastName: string, task: string) {
  await withOrganization(db, organizationId, async (tx) => {
    const [source] = await tx.insert(prospectSources).values({ organizationId, label: "Instagram" }).returning();
    const [event] = await tx.insert(events).values({ organizationId, eventDate: "2027-06-12", prospectSourceId: source!.id }).returning();
    await tx.insert(eventClients).values({ organizationId, eventId: event!.id, firstName: "Élodie", lastName, position: 0 });
    await tx.insert(eventTasks).values({ organizationId, eventId: event!.id, label: task, dueDate: "2027-01-15" });
  });
}

test("RGPD-01 — la titulaire retrouve une personne et les données de son événement ; un collaborateur n'a pas accès", async ({ page }) => {
  const ownerEmail = `owner-rgpd01-${randomUUID()}@symbola.test`;
  const memberEmail = `member-rgpd01-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-rgpd01-e2e";
  const lastName = `Durand${randomUUID().slice(0, 6)}`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const other = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email: ownerEmail, password, role: "owner" });
    await createUser(db, { organizationId: organization.id, email: memberEmail, password, role: "member" });
    await seedWedding(db, organization.id, lastName, "Réserver le traiteur");
    // Même personne (homonyme) dans une autre organisation : jamais visible.
    await seedWedding(db, other.id, lastName, "Tâche d'une autre organisation");
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, ownerEmail, password);
  await openSettingsTab(page, "Données personnelles");
  await expect(page.getByRole("heading", { name: "Données personnelles" })).toBeVisible();
  await expectNoAxeViolation(page);

  await page.getByLabel("Nom").fill(`elodie ${lastName.toUpperCase()}`);
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page.getByRole("heading", { name: /données trouvées/ })).toBeVisible();
  const eventsGroup = page.getByRole("region", { name: "Événements" });
  await expect(eventsGroup).toContainText(`Client : Élodie ${lastName}`);
  await expect(eventsGroup).toContainText("(trouvée par la recherche)");
  await expect(eventsGroup).toContainText("Tâche : Réserver le traiteur");
  await expect(eventsGroup).toContainText("(liée à son événement)");
  await expect(page.getByText("Tâche d'une autre organisation")).toHaveCount(0);
  await expect(page.getByText("Résultat incomplet")).toHaveCount(0);
  // Les termes cherchés ne passent jamais par l'URL.
  expect(page.url()).not.toContain(lastName);
  await expectNoAxeViolation(page);

  // Un collaborateur n'a aucun accès au module.
  await page.context().clearCookies();
  await loginAndSetupMfa(page, memberEmail, password);
  await expect(page.getByRole("link", { name: "Données personnelles (RGPD)" })).toHaveCount(0);
  await page.goto("/rgpd");
  await expect(page.getByText("Ce module est réservé à la titulaire du compte.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rechercher", exact: true })).toHaveCount(0);
});
