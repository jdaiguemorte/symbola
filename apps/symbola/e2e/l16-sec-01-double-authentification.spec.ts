// L16-SEC-01 (lot 16, ADR 0037) — 5 codes de double authentification faux bloquent
// la validation 15 minutes, même pour un code juste, et le titulaire reçoit un
// e-mail. En taille ordinateur et en 375 px, avec axe-core. Un compte neuf par
// exécution ; l'e-mail est lu dans Mailpit (socle de dev et CI).
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { readyOrganization } from "./helpers";

const PASSWORD = "mot-de-passe-e2e-de-test";
const MAILPIT_API = "http://localhost:8025/api/v1";

async function mailSubjectsTo(to: string): Promise<string[]> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await response.json()) as { messages: { Subject: string }[] };
    if (messages.length > 0) return messages.map((message) => message.Subject);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return [];
}

test("L16-SEC-01 — 5 codes faux bloquent la double authentification et préviennent le titulaire", async ({ page }) => {
  const email = `sec01-e2e-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Organisation L16-SEC-01 ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password: PASSWORD, role: "owner" });
  } finally {
    await sql.end();
  }

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);

  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) });
  const valid = new Set([-30_000, 0, 30_000].map((offset) => totp.generate({ timestamp: Date.now() + offset })));
  const wrong = ["000000", "111111", "222222", "333333", "444444", "555555"].find((code) => !valid.has(code))!;

  // Le message de l'écran (Next ajoute son propre role="alert", l'annonceur de route).
  const message = page.locator("main").getByRole("alert");
  // Chaque envoi est traité avant le suivant : le compteur doit voir 5 essais.
  const submit = async (code: string) => {
    await page.getByLabel("Code").fill(code);
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/mfa")),
      page.getByRole("button", { name: "Valider" }).click(),
    ]);
  };

  for (let attempt = 1; attempt <= 4; attempt++) {
    await submit(wrong);
    await expect(message).toHaveText("Code invalide.");
  }
  await submit(wrong);
  await expect(message).toContainText("bloquée pendant 15 minutes");

  // Même le bon code est refusé pendant le blocage.
  await submit(totp.generate());
  await expect(message).toContainText("bloquée pendant 15 minutes");
  await expect(page).toHaveURL(/\/mfa$/);

  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  expect(await mailSubjectsTo(email)).toEqual(["Votre double authentification Symbola a été bloquée"]);
});
