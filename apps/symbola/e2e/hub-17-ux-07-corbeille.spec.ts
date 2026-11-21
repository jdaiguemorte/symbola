// Lot 39a (HUB-17, UX-07, DAT-03 ; décisions D2 à D6 ; ADR 0073) — supprimer une tâche puis
// « Annuler » ; supprimer un évènement (« Annuler » proposé dix secondes), le retrouver dans
// Paramètres › Corbeille et le restaurer avec son contenu ; supprimer définitivement (la titulaire,
// confirmation qui nomme l'objet). En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addEventTask, createProspect, createProspectSource } from "../modules/events/service";
import { createContact } from "../modules/hub/service";
import { openSettingsTab, readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Atelier prêt, sa titulaire, le mariage d'Inès et Sacha avec une tâche, et un contact sans évènement.
async function atelier() {
  const email = `planner-hub17-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    const event = await createProspect({
      organizationId: organization.id,
      createdByUserId: owner.id,
      prospectSourceId: source.id,
      clients: [
        { firstName: "Inès", lastName: "Morel" },
        { firstName: "Sacha", lastName: "Petit" },
      ],
      eventDate: "2027-06-12",
      applyTemplate: false,
    });
    const task = await addEventTask(organization.id, event.id, { label: "Envoyer les faire-part", dueDate: "2027-03-01", responsible: "planner" });
    const contact = await createContact(organization.id, { firstName: "Rose", lastName: "Fleuriste" });
    return { email, eventId: event.id, taskId: task.id, contactId: contact.id };
  } finally {
    await sql.end();
  }
}

test("UX-07 — une tâche supprimée revient par « Annuler » pendant dix secondes", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/events/${setup.eventId}?onglet=retroplanning&tache=${setup.taskId}`);
  // Lot 63d : la fenêtre de la tâche, ouverte par l'adresse, propose « Supprimer la tâche ».
  await page.getByRole("dialog", { name: "Modifier la tâche" }).getByRole("button", { name: "Supprimer la tâche", exact: true }).click();
  const banner = page.getByRole("status").filter({ hasText: "Tâche supprimée." });
  await expect(banner).toBeVisible();
  await expect(page.getByText("Envoyer les faire-part")).toHaveCount(0);
  await banner.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText("C'est rétabli.")).toBeVisible();
  await page.goto(`/events/${setup.eventId}?onglet=retroplanning`);
  await expect(page.getByText("Envoyer les faire-part").first()).toBeVisible();
});

test("HUB-17 — un évènement supprimé va à la corbeille et revient avec son contenu ; la titulaire supprime définitivement", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);

  await page.goto(`/events/${setup.eventId}`);
  await expect(page.getByText("L'évènement va à la corbeille avec tout son contenu ; il se restaure pendant 30 jours.")).toBeVisible();
  await page.getByRole("button", { name: "Supprimer l'évènement" }).click();
  await expect(page).toHaveURL(/\/events$/);
  const banner = page.getByRole("status").filter({ hasText: "Évènement mis à la corbeille." });
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("link", { name: "Voir la corbeille" })).toBeVisible();

  await openSettingsTab(page, "Corbeille");
  await expect(page.getByRole("heading", { name: "Corbeille", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Évènement · Inès & Sacha" })).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Restaurer Inès & Sacha" }).click();
  await expect(page.getByText("C'est restauré, tel que c'était.")).toBeVisible();
  await expect(page.getByText("La corbeille est vide.")).toBeVisible();
  await page.goto(`/events/${setup.eventId}?onglet=retroplanning`);
  await expect(page.getByText("Envoyer les faire-part").first()).toBeVisible();

  // Le contact sans évènement va à la corbeille ; la titulaire l'efface pour de bon, après une
  // confirmation qui le nomme.
  await page.goto(`/contacts/${setup.contactId}`);
  await page.getByRole("button", { name: "Supprimer le contact" }).click();
  await expect(page).toHaveURL(/\/contacts$/);
  await expect(page.getByRole("status").filter({ hasText: "Contact mis à la corbeille." })).toBeVisible();
  await page.goto("/parametres/corbeille");
  await page.getByRole("button", { name: "Supprimer définitivement Rose Fleuriste" }).click();
  const dialog = page.getByRole("dialog", { name: "Supprimer définitivement Contact « Rose Fleuriste » ?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByText("C'est effacé pour de bon.")).toBeVisible();
  await expect(page.getByText("La corbeille est vide.")).toBeVisible();
});

test("HUB-17 — la corbeille en 375 px : lisible, sans défilement horizontal, axe-core", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelier();
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/contacts/${setup.contactId}`);
  await page.getByRole("button", { name: "Supprimer le contact" }).click();
  await expect(page).toHaveURL(/\/contacts$/);
  await page.goto("/parametres/corbeille");
  await expect(page.getByRole("heading", { name: "Contact · Rose Fleuriste" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolation(page);
});
