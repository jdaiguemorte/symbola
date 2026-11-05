// RGPD-02 — export des fiches sélectionnées : la titulaire coche les fiches
// de la personne (pas celles de l'homonyme), lit l'avertissement sur les
// notes internes, rattache l'export à la demande d'accès, puis télécharge le
// PDF et l'archive ZIP par un lien temporaire. En taille ordinateur et en
// 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { eventClients, events, eventTasks, prospectSources } from "@symbola/db/schema/events";
import { privacyRequests } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { createUser } from "@symbola/auth";
import { ZipArchive } from "@symbola/import-engine";
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

async function seedWedding(db: ReturnType<typeof createAppConnection>["db"], organizationId: string, firstName: string, lastName: string, task: string) {
  await withOrganization(db, organizationId, async (tx) => {
    const [source] = await tx.insert(prospectSources).values({ organizationId, label: "Instagram" }).returning();
    const [event] = await tx.insert(events).values({ organizationId, eventDate: "2027-06-12", prospectSourceId: source!.id }).returning();
    await tx.insert(eventClients).values({ organizationId, eventId: event!.id, firstName, lastName, position: 0 });
    await tx.insert(eventTasks).values({ organizationId, eventId: event!.id, label: task, dueDate: "2027-01-15" });
  });
}

test("RGPD-02 — la titulaire exporte les fiches cochées de la personne et télécharge le PDF et l'archive", async ({ page }) => {
  const ownerEmail = `owner-rgpd02-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-rgpd02-e2e";
  const lastName = `Durand${randomUUID().slice(0, 6)}`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email: ownerEmail, password, role: "owner" });
    await seedWedding(db, organization.id, "Élodie", lastName, "Réserver le traiteur");
    await seedWedding(db, organization.id, "Élodie", `${lastName}-Homonyme`, "Tâche de l'homonyme");
    await withOrganization(db, organization.id, (tx) =>
      tx.insert(privacyRequests).values({
        organizationId: organization.id,
        type: "access",
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

  // Les deux clients sont trouvés (le nom de l'homonyme contient le terme) ;
  // seule la bonne personne est cochée, avec sa tâche.
  const exportButton = page.getByRole("button", { name: "Exporter", exact: true });
  await expect(exportButton).toBeDisabled();
  await page.getByLabel(`Client : Élodie ${lastName}`, { exact: true }).check();
  await page.getByLabel("Tâche : Réserver le traiteur").check();
  await expect(page.getByText("2 fiches cochées.")).toBeVisible();
  await expect(page.getByText(/vos notes internes .* font partie de l'export/)).toBeVisible();
  await page.getByLabel("Rattacher à une demande").selectOption({ label: `Élodie ${lastName} — Accès` });
  await page.getByLabel("J'ai compris que mes notes internes font partie de l'export").check();
  await expectNoAxeViolation(page);
  await exportButton.click();
  await expect(page.getByText("2 fiches exportées.", { exact: false })).toBeVisible();
  expect(page.url()).not.toContain(lastName);

  // Téléchargement servi par l'app elle-même (ADR 0027), jamais de redirection vers le stockage.
  const archiveHref = await page.getByRole("status").getByRole("link", { name: "Télécharger l'archive (ZIP)" }).getAttribute("href");
  const archiveResponse = await page.request.get(archiveHref!, { maxRedirects: 0 });
  expect(archiveResponse.status()).toBe(200);
  expect(archiveResponse.headers()["content-type"]).toBe("application/zip");
  const archive = new ZipArchive(await archiveResponse.body(), 10_000_000);
  const csv = archive.readText("csv/events.csv")!;
  expect(csv).toContain(lastName);
  expect(csv).toContain("Réserver le traiteur");
  expect(csv).not.toContain("Tâche de l'homonyme");
  expect(archive.has("donnees.json")).toBe(true);
  const pdfHref = await page.getByRole("status").getByRole("link", { name: "Télécharger le PDF" }).getAttribute("href");
  expect((await (await page.request.get(pdfHref!)).body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // Retrouvé dans « Exports récents », rattaché à la demande.
  await page.reload();
  const recent = page.getByRole("region", { name: "Exports récents" });
  await expect(recent).toContainText(`demande de Élodie ${lastName}`);
  await expect(recent.getByRole("link", { name: "Télécharger le PDF" })).toBeVisible();
  await expectNoAxeViolation(page);
});
