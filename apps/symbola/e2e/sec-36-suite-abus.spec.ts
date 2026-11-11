// Lot 24b — SEC-36 : suite de tests d'abus, qui rejoue les scénarios de
// sécurité SC-S1 à SC-S6 du cahier des charges (§ 17), joués par « Rex », tiers
// malveillant. SC-S1 est rejoué en entier par sec-13-inexistant-interdit.spec.ts ;
// SC-S3 attend les liens personnels des prestataires (lot 26). En taille
// ordinateur et en 375 px, axe-core sur les écrans touchés.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { consumeOrganizationMailQuota } from "@symbola/db/mail-quota";
import { eventClientAccesses } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { EICAR_TEST_STRING } from "@symbola/files";
import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import { acceptEventClientInvitation, createProspect, createProspectSource, inviteEventClient } from "../modules/events/service";
import { createVendor } from "../modules/vendors/service";
import { readyOrganization } from "./helpers";

const PASSWORD = "mot-de-passe-e2e-de-test";

async function loginAndSetupMfa(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
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

async function organization(label: string) {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Org ${label} ${randomUUID()}`)).id;
    const account = async (role: "owner" | "member") => {
      const email = `${role}-sec36-${randomUUID()}@symbola.test`;
      return { email, id: (await createUser(db, { organizationId, email, password: PASSWORD, role })).id };
    };
    const owner = await account("owner");
    const member = await account("member");
    const source = await createProspectSource(organizationId, "Salon");
    const event = (clientName: string) =>
      createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: clientName }], eventDate: "2027-06-12" });
    return { organizationId, owner, member, event };
  } finally {
    await sql.end();
  }
}

test("SC-S1 — un identifiant d'une autre organisation répond comme un identifiant inexistant", async ({ page }) => {
  const mine = await organization("A");
  const other = await organization("B");
  const eventOfB = await other.event("Bérénice");
  await loginAndSetupMfa(page, mine.owner.email);
  const ofB = await page.goto(`/events/${eventOfB.id}`);
  const ofBText = await page.locator("main").innerText();
  const missing = await page.goto(`/events/${randomUUID()}`);
  expect(ofB!.status()).toBe(404);
  expect([ofB!.status(), ofBText]).toEqual([missing!.status(), await page.locator("main").innerText()]);
  expect(ofBText).not.toContain("Bérénice");
});

test("SC-S2 — un collaborateur retiré il y a deux minutes rejoue une requête avec sa session encore ouverte : refusée", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const { member, owner } = await organization("S2");
  const rex = await browser.newPage();
  await loginAndSetupMfa(rex, member.email);
  await rex.goto("/events");
  await expect(rex).toHaveURL(/\/events$/);

  await loginAndSetupMfa(page, owner.email);
  await page.goto("/parametres/equipe");
  await expect(page.getByRole("heading", { level: 1, name: "Équipe" })).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("link", { name: `Retirer l'accès de ${member.email}` }).click();
  await expect(page.getByRole("heading", { name: `Retirer l'accès de ${member.email} ?` })).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Retirer l'accès" }).click();
  await expect(page.getByRole("status")).toHaveText("Accès retiré. Les sessions de ce compte sont fermées.");
  await expect(page.getByRole("row").filter({ hasText: member.email })).toContainText("Retiré le");

  await rex.goto("/events");
  await expect(rex).toHaveURL(/\/login$/);
  await rex.getByLabel("E-mail").fill(member.email);
  await rex.getByLabel("Mot de passe").fill(PASSWORD);
  await rex.getByRole("button", { name: "Se connecter" }).click();
  await expect(rex.locator("main").getByRole("alert")).toHaveText("Identifiants invalides.");
  await rex.close();
});

test.fixme("SC-S3 — avec le lien d'un prestataire, il demande le budget, les devis des autres et le portail du client : refus (lot 26, liens personnels)", async () => {});

test("SC-S4 — un lien de marié expiré, puis le lien d'un autre événement : refus, nouveau lien proposé, rien de révélé", async ({ page }) => {
  const { organizationId, owner, event } = await organization("S4");
  const theirs = await event("Inès");
  const another = await event("Bérénice");
  const expired = await inviteEventClient({ organizationId, eventId: theirs.id, email: `rex-${randomUUID()}@symbola.test`, invitedByUserId: owner.id, locale: "fr" });
  const { sql, db } = createAppConnection();
  try {
    await withOrganization(db, organizationId, (tx) => tx.update(eventClientAccesses).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(eventClientAccesses.id, expired.access.id)));
  } finally {
    await sql.end();
  }
  await page.goto(`/espace/invitation/${expired.invitationToken}`);
  await expect(page.locator("main").getByRole("alert")).toHaveText("Ce lien d'invitation n'est plus valable. Demandez une nouvelle invitation à votre planner.");
  await expect(page.getByRole("button", { name: "Créer mon compte" })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Inès");
  await expectNoAxeViolation(page);

  // Un marié bien invité à son événement tente celui d'un autre couple.
  const clientEmail = `marie-${randomUUID()}@symbola.test`;
  const invitation = await inviteEventClient({ organizationId, eventId: theirs.id, email: clientEmail, invitedByUserId: owner.id, locale: "fr" });
  await acceptEventClientInvitation(invitation.invitationToken!, PASSWORD);
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(clientEmail);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/espace/);
  const response = await page.goto(`/espace/${another.id}`);
  expect(response!.status()).toBe(404);
  await expect(page.locator("main")).not.toContainText("Bérénice");
});

test("SC-S5 — le fichier de test antivirus, puis un fichier au type falsifié : refus et message clair", async ({ page }) => {
  const { organizationId, owner } = await organization("S5");
  const { vendor } = await createVendor(organizationId, { name: "Maison Verdier", typeId: null, city: "Lille" });
  await loginAndSetupMfa(page, owner.email);
  await page.goto(`/prestataires/${vendor.id}`);
  const file = page.getByLabel("Fichier", { exact: true });
  await file.setInputFiles({ name: "plaquette.pdf", mimeType: "application/pdf", buffer: Buffer.from(EICAR_TEST_STRING) });
  await page.getByRole("button", { name: "Joindre" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(/Fichier refusé par l'antivirus|Format non supporté/);
  await file.setInputFiles({ name: "rib.pdf", mimeType: "application/pdf", buffer: Buffer.from("ceci n'est pas un PDF") });
  await page.getByRole("button", { name: "Joindre" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Format non supporté : PDF ou image uniquement.");
  await expect(page.getByText("Aucun fichier.")).toBeVisible();
});

test("SC-S6 — demandes de lien en rafale, puis envoi au-delà du plafond : limitation, plafond, alerte au planner", async ({ page }) => {
  test.setTimeout(90_000);
  const { organizationId, owner, event } = await organization("S6");
  const theirs = await event("Inès");

  // Demandes de lien en rafale pour un même compte : limitées, avec le délai.
  await page.goto("/mot-de-passe-oublie");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByLabel("E-mail").fill(owner.email);
    await page.getByRole("button", { name: "Recevoir le lien" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await page.goto("/mot-de-passe-oublie");
  }
  await page.getByLabel("E-mail").fill(owner.email);
  await page.getByRole("button", { name: "Recevoir le lien" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Trop de tentatives. Réessayez dans 60 minutes.");

  // L'organisation a déjà envoyé ses 100 e-mails de l'heure.
  const { sql, db } = createAppConnection();
  try {
    for (let sent = 0; sent < 100; sent += 1) await consumeOrganizationMailQuota(db, organizationId);
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, owner.email);
  await expect(page.locator("main").getByRole("alert").filter({ hasText: "Plafond d'envois atteint" })).toContainText("100 e-mails envoyés dans l'heure (plafond : 100)");
  await expectNoAxeViolation(page);
  await page.goto(`/events/${theirs.id}?onglet=maries`);
  await page.getByLabel("E-mail du marié").fill(`marie-${randomUUID()}@symbola.test`);
  await page.getByRole("button", { name: "Inviter le marié" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Plafond d'envois atteint");
  await expect(page.getByRole("list", { name: "Accès des mariés" })).not.toContainText("@symbola.test");
});
