// RGPD-03 — demande d'oubli : la titulaire coche les fiches de la personne,
// lit l'aperçu (supprimée, anonymisée, conservée), valide en la rattachant à
// la demande d'oubli ; chaque module accuse réception, la demande se clôt,
// la preuve PDF et le modèle de réponse sont prêts, la personne est
// introuvable ensuite. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { eventClients, events, eventTasks, prospectSources } from "@symbola/db/schema/events";
import { privacyRequests } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
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

async function seedWedding(db: ReturnType<typeof createAppConnection>["db"], organizationId: string, firstName: string, lastName: string, task: string) {
  await withOrganization(db, organizationId, async (tx) => {
    const [source] = await tx.insert(prospectSources).values({ organizationId, label: "Instagram" }).returning();
    const [event] = await tx.insert(events).values({ organizationId, eventDate: "2027-06-12", prospectSourceId: source!.id }).returning();
    await tx.insert(eventClients).values({ organizationId, eventId: event!.id, firstName, lastName, position: 0 });
    await tx.insert(eventTasks).values({ organizationId, eventId: event!.id, label: task, dueDate: "2027-01-15" });
  });
}

test("RGPD-03 — la titulaire prévisualise puis valide l'oubli ; la demande se clôt, la personne est introuvable, preuve et réponse prêtes", async ({ page }) => {
  const ownerEmail = `owner-rgpd03-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-rgpd03-e2e";
  const lastName = `Durand${randomUUID().slice(0, 6)}`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email: ownerEmail, password, role: "owner" });
    await seedWedding(db, organization.id, "Élodie", lastName, "Réserver le traiteur");
    await withOrganization(db, organization.id, (tx) =>
      tx.insert(privacyRequests).values({
        organizationId: organization.id,
        type: "erasure",
        personLabel: `Élodie ${lastName}`,
        receivedOn: "2026-11-01",
        dueOn: "2026-12-01",
        createdByUserId: user.id,
      }),
    );
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, ownerEmail, password);
  await page.goto("/rgpd");
  await page.getByLabel("Nom").fill(`Élodie ${lastName}`);
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page.getByRole("heading", { name: /données trouvées/ })).toBeVisible();
  await page.getByRole("button", { name: "Tout cocher" }).click();

  // Aperçu : rien n'est encore modifié.
  await page.getByRole("button", { name: "Aperçu de l'oubli" }).click();
  const preview = page.getByRole("region", { name: "Aperçu de l'oubli" });
  await expect(preview).toContainText(`Anonymisée — Événements · Client : Élodie ${lastName}`);
  await expect(preview).toContainText("Supprimée — Événements · Tâche : Réserver le traiteur");
  await expectNoAxeViolation(page);

  await preview.getByLabel("Demande d'oubli").selectOption({ label: `Élodie ${lastName}` });
  await preview.getByLabel("Je confirme l'oubli : cette opération est irréversible.").check();
  await preview.getByRole("button", { name: "Valider l'oubli" }).click();

  await expect(page.getByRole("heading", { name: `Demande d'oubli : Élodie ${lastName}` })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Terminé : tous les modules ont répondu, la demande est close");
  await expect(page.getByText(/Événements : accusé le/)).toBeVisible();
  await expect(page.getByLabel("Message")).toHaveValue(new RegExp(`Bonjour Élodie ${lastName}`));
  const proofHref = await page.getByRole("link", { name: "Télécharger la preuve (PDF)" }).getAttribute("href");
  expect((await (await page.request.get(proofHref!)).body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  await expectNoAxeViolation(page);

  // La personne est introuvable ; la demande est close.
  await page.goto("/rgpd");
  await page.getByLabel("Nom").fill(`Élodie ${lastName}`);
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page.getByText("Aucune donnée ne correspond à cette personne.")).toBeVisible();
  await page.goto("/rgpd/demandes");
  await expect(page.getByRole("listitem").filter({ hasText: `Élodie ${lastName}` })).toContainText("close");
});
