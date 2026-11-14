// RGPD-05 — purge mensuelle : rappel au tableau de bord, liste des données
// échues, exclusion avec motif obligatoire, validation, trace de la purge ;
// la ligne exclue revient avec son motif. En taille ordinateur et en 375 px,
// axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { eventClients, events, prospectSources } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { readyOrganization, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Prospect resté sans suite depuis quatre ans (dernière activité en 2022).
async function seedOldProspect(db: ReturnType<typeof createAppConnection>["db"], organizationId: string, lastName: string) {
  await withOrganization(db, organizationId, async (tx) => {
    const [source] = await tx.insert(prospectSources).values({ organizationId, label: "Instagram" }).returning();
    const old = new Date("2022-03-01T10:00:00Z");
    const [event] = await tx
      .insert(events)
      .values({ organizationId, eventDate: "2023-06-12", prospectSourceId: source!.id, status: "lost", createdAt: old, updatedAt: old })
      .returning();
    await tx.insert(eventClients).values({ organizationId, eventId: event!.id, firstName: "Élodie", lastName, position: 0 });
  });
}

test("RGPD-05 — la titulaire valide la purge du mois : une ligne purgée, une exclue avec motif qui revient ensuite", async ({ page }) => {
  const ownerEmail = `owner-rgpd05-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-rgpd05-e2e";
  const purgedName = `Durand${randomUUID().slice(0, 6)}`;
  const keptName = `Martin${randomUUID().slice(0, 6)}`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email: ownerEmail, password, role: "owner" });
    await seedOldProspect(db, organization.id, purgedName);
    await seedOldProspect(db, organization.id, keptName);
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, ownerEmail, password);
  // Rappel au tableau de bord tant que la liste du mois n'est pas validée.
  await expect(page.getByRole("heading", { name: "Purge mensuelle : 2 lignes à examiner" })).toBeVisible();
  await page.getByRole("region", { name: "Purge mensuelle : 2 lignes à examiner" }).getByRole("link", { name: "Purge mensuelle" }).click();
  await expect(page.getByRole("heading", { name: "Purge mensuelle", level: 1 })).toBeVisible();
  await expect(page.getByText(`Élodie ${purgedName}`)).toBeVisible();
  await expectNoAxeViolation(page);

  const keptLine = page.getByRole("listitem").filter({ hasText: `Élodie ${keptName}` });
  await keptLine.getByLabel("Exclure de la purge").check();
  // Exclusion sans motif : refusée.
  await page.getByLabel("Je valide la purge des lignes non exclues : cette opération est irréversible.").check();
  await page.getByRole("button", { name: "Valider la purge" }).click();
  await expect(page.getByText("Chaque ligne exclue doit avoir un motif.")).toBeVisible();
  await keptLine.getByLabel(/Motif d'exclusion/).fill("Les mariés ont redemandé un devis");
  await page.getByRole("button", { name: "Valider la purge" }).click();

  await expect(page.getByRole("status")).toHaveText("Terminée");
  await expect(page.getByText("exclue : Les mariés ont redemandé un devis")).toBeVisible();
  await expect(page.getByText("purgée", { exact: false }).first()).toBeVisible();
  await expectNoAxeViolation(page);

  // La ligne exclue revient, avec son motif ; la ligne purgée a disparu.
  await page.getByRole("link", { name: "Retour à la purge mensuelle" }).click();
  await expect(page.getByText(`Élodie ${keptName}`)).toBeVisible();
  await expect(page.getByText("exclue précédemment : Les mariés ont redemandé un devis")).toBeVisible();
  await expect(page.getByText(`Élodie ${purgedName}`)).toHaveCount(0);
  // Le rappel du tableau de bord disparaît une fois la liste du mois validée.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Purge mensuelle :/ })).toHaveCount(0);
});
