// Lot 63g (HUB-06, HUB-15, HUB-27, ARC-06, ARC-07, SEC-09 ; ADR 0108) — l'écran « Apps », en taille
// ordinateur et en 375 px, axe-core sur chaque écran :
// - la Propriétaire trouve « Apps » en bas du menu ; chaque app y figure avec son état, ce qu'elle
//   apporte et où la trouver ; le plan de table est dans « Invités », les plans des lieux dans
//   « Plans de salle » ;
// - pendant le pilote : « Demander l'activation » ouvre une fenêtre sans champ libre, la demande
//   s'annule puis se refait ; l'Exploitation la voit dans « Organisations » (organisation et app) et
//   l'active ; la planner reçoit une notification et l'app passe à « Activée » ;
// - une Planner n'a pas « Apps » au menu (ARC-07 : aucun lien vers une app absente hors de l'écran).
// Les noms et descriptions viennent du catalogue de départ (plans.json), comme les voit la planner.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { starterAppCatalog } from "@symbola/starter-templates";
import { expect, test, type Page } from "@playwright/test";
import { clickAdminMenuLink, mainMenu, openMenu, readyOrganization, signIn } from "./helpers";

const apps = starterAppCatalog();
const app = (key: string) => apps.find((entry) => entry.key === key)!;

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const name = `Atelier ${randomUUID().slice(0, 6)}`;
    const organizationId = (await readyOrganization(db, name)).id;
    const ownerEmail = `titulaire-${randomUUID()}@symbola.test`;
    const plannerEmail = `planner-${randomUUID()}@symbola.test`;
    const adminEmail = `exploitation-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId, email: ownerEmail, role: "owner" });
    await createUser(db, { organizationId, email: plannerEmail, role: "member" });
    await createUser(db, { organizationId: null, email: adminEmail, role: "admin" });
    return { name, ownerEmail, plannerEmail, adminEmail };
  } finally {
    await sql.end();
  }
}

test("HUB-06 — la Propriétaire voit les apps, demande « Plans de salle », l'Exploitation l'active, la planner est prévenue", async ({ page, browser, baseURL }) => {
  test.setTimeout(240_000);
  const { name, ownerEmail, plannerEmail, adminEmail } = await atelier();
  const floorplans = app("floorplans");
  const guests = app("guests");
  // Une fenêtre par personne (Exploitation, Planner), à la taille du projet.
  const viewport = page.viewportSize();
  const contextOptions = { ...(baseURL ? { baseURL } : {}), ...(viewport ? { viewport } : {}) };

  await signIn(page, ownerEmail);
  await openMenu(page);
  await mainMenu(page).getByRole("link", { name: "Tous les modules", exact: true }).click();
  await expect(page).toHaveURL(/\/apps$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tous les modules" })).toBeVisible();
  await expect(page.getByText("Pendant le pilote", { exact: true })).toBeVisible();

  // Chaque app du catalogue, avec son état, ce qu'elle apporte et où la trouver.
  for (const entry of apps) await expect(page.getByRole("region", { name: entry.labels.fr })).toBeVisible();
  const events = page.getByRole("region", { name: app("events").labels.fr });
  await expect(events).toContainText("Activée");
  const floorplansCard = page.getByRole("region", { name: floorplans.labels.fr });
  await expect(floorplansCard).toContainText("Non activée");
  await expect(floorplansCard).toContainText(floorplans.benefits.fr);
  await expect(floorplansCard).toContainText(floorplans.whereToFind.fr);
  await expect(page.getByRole("region", { name: guests.labels.fr })).toContainText("plan de table");
  await expectNoAxeViolation(page);

  // La fenêtre de demande : aucun champ libre, ce que voit l'équipe Symbola.
  await floorplansCard.getByRole("button", { name: `Demander l'activation de ${floorplans.labels.fr}` }).click();
  const dialog = page.getByRole("dialog", { name: `Activer « ${floorplans.labels.fr} »` });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("seulement le nom de votre organisation et l'app demandée");
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await expectNoAxeViolation(page);
  await dialog.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(page.getByRole("status")).toContainText("Votre demande est envoyée");
  await expect(floorplansCard).toContainText(/Demandée le \d{1,2}(er)? \S+ \d{4}/);

  // Annulée tant qu'elle n'est pas traitée, puis refaite.
  await floorplansCard.getByRole("button", { name: "Annuler la demande" }).click();
  await expect(page.getByRole("status")).toContainText("Votre demande est annulée");
  await expect(floorplansCard).toContainText("Non activée");
  await floorplansCard.getByRole("button", { name: `Demander l'activation de ${floorplans.labels.fr}` }).click();
  await dialog.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(floorplansCard).toContainText(/Demandée le/);

  // L'Exploitation, dans sa propre fenêtre, voit la demande (organisation et app) et active l'app.
  const operations = await browser.newContext(contextOptions);
  const admin = await operations.newPage();
  await signIn(admin, adminEmail, /\/exploitation$/);
  await clickAdminMenuLink(admin, "Organisations");
  const requests = admin.getByRole("region", { name: "Demandes d'activation", exact: true });
  const row = requests.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText(floorplans.labels.fr);
  await expect(row).not.toContainText(ownerEmail);
  await expectNoAxeViolation(admin);
  await row.getByRole("button", { name: `Activer ${floorplans.labels.fr} pour ${name}` }).click();
  await expect(requests.getByRole("row").filter({ hasText: name })).toHaveCount(0);
  await operations.close();

  // La planner est prévenue ; l'app est activée à la requête suivante.
  await page.goto("/notifications");
  await expect(page.getByText(`L'app « ${floorplans.labels.fr} » est activée.`)).toBeVisible();
  await page.goto("/apps");
  await expect(page.getByRole("region", { name: floorplans.labels.fr })).toContainText("Activée");
  await expectNoAxeViolation(page);

  // ARC-07 : une Planner n'a pas « Apps » au menu, et l'écran lui dit qu'il est réservé.
  const team = await browser.newContext(contextOptions);
  const planner = await team.newPage();
  await signIn(planner, plannerEmail);
  await openMenu(planner);
  await expect(mainMenu(planner).getByRole("link", { name: "Tous les modules", exact: true })).toHaveCount(0);
  await planner.goto("/apps");
  await expect(planner.getByText("Cet écran est réservé à la Propriétaire de l'organisation.")).toBeVisible();
  await team.close();
});
