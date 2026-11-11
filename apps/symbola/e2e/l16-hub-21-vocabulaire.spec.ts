// Lot 16 (L16-HUB-21) — vocabulaire selon le métier : une agence événementielle lit
// « le client » là où une wedding planner lit « les mariés ». Ordinateur et
// 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { eq } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { organizationProfiles } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { readyOrganization } from "./helpers";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
}

async function plannerOf(metier: "wedding_planner" | "event_agency") {
  const email = `planner-${metier}-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-vocabulaire";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await withOrganization(db, organization.id, (tx) => tx.update(organizationProfiles).set({ metier }).where(eq(organizationProfiles.organizationId, organization.id)));
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  return { email, password };
}

test("L16-HUB-21 — une agence événementielle lit « contact » et « clients », une wedding planner « mariés »", async ({ page, browser }) => {
  const agency = await plannerOf("event_agency");
  await login(page, agency.email, agency.password);
  await page.goto("/events/new");
  await expect(page.getByLabel("Prénom du premier contact")).toBeVisible();
  await expect(page.getByText(/marié/i)).toHaveCount(0);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);

  const wedding = await plannerOf("wedding_planner");
  const viewport = page.viewportSize();
  const other = await browser.newContext(viewport ? { viewport } : {});
  const weddingPage = await other.newPage();
  await login(weddingPage, wedding.email, wedding.password);
  await weddingPage.goto("/events/new");
  await expect(weddingPage.getByLabel("Prénom du premier marié")).toBeVisible();
  await other.close();
});
