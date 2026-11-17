// Lot 39b (UX-09, NFR-16 ; décisions D7, D8, D10 ; ADR 0074) — rien ne se perd en saisissant :
// - SC-01 étape 7 : un prospect commencé se reprend ailleurs, à l'identique (le brouillon vient du
//   serveur : la copie de l'appareil est effacée avant de rouvrir, en 375 px) ;
// - un conflit d'édition entre deux fenêtres est montré champ par champ, jamais écrasé ;
// - sans réseau, l'envoi n'a pas lieu, la saisie reste, et le retour de la connexion est annoncé.
// axe-core sur les écrans du brouillon et du conflit.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { createProspect, createProspectSource } from "../modules/events/service";
import { getFormDraft } from "../modules/hub/service";
import { readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function atelier() {
  const email = `planner-ux09-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    const event = await createProspect({ organizationId: organization.id, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }, { firstName: "Sacha" }], eventDate: "2027-09-18", applyTemplate: false });
    return { email, organizationId: organization.id, ownerId: owner.id, eventId: event.id };
  } finally {
    await sql.end();
  }
}

test("UX-09 — SC-01 étape 7 : un prospect commencé se reprend ailleurs, à l'identique, puis le brouillon s'efface", async ({ page }) => {
  test.setTimeout(150_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await page.goto("/events/new");
  await page.locator('select[name="prospectSourceId"]').selectOption({ label: "Salon" });
  await page.locator('input[name="firstName1"]').fill("Léa");
  await page.locator('input[name="firstName2"]').fill("Maxime");
  await page.locator('input[name="eventDate"]').fill("2027-06-12");
  await page.locator('input[name="venueName"]').fill("Domaine des Tilleuls");
  await expect.poll(async () => (await getFormDraft(setup.organizationId, setup.ownerId, "event-new"))?.content.venueName, { timeout: 15_000 }).toBe("Domaine des Tilleuls");

  // « Ailleurs » : plus aucune copie sur l'appareil, écran de téléphone ; seul le serveur a le brouillon.
  await page.evaluate(() => window.localStorage.clear());
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/events/new");
  const offer = page.getByRole("status").filter({ hasText: /Brouillon du .+ retrouvé\./ });
  await expect(offer).toBeVisible();
  await expectNoAxeViolation(page);
  await offer.getByRole("button", { name: "Reprendre" }).click();
  await expect(page.locator('input[name="firstName1"]')).toHaveValue("Léa");
  await expect(page.locator('input[name="firstName2"]')).toHaveValue("Maxime");
  await expect(page.locator('input[name="eventDate"]')).toHaveValue("2027-06-12");
  await expect(page.locator('input[name="venueName"]')).toHaveValue("Domaine des Tilleuls");

  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}/);
  expect(await getFormDraft(setup.organizationId, setup.ownerId, "event-new")).toBeNull();
  await page.goto("/events/new");
  await expect(page.getByText(/Brouillon du .+ retrouvé\./)).toHaveCount(0);
});

test("UX-09 — un conflit d'édition entre deux fenêtres est montré champ par champ, et rien n'est écrasé en silence", async ({ page }) => {
  test.setTimeout(150_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  const other = await page.context().newPage();
  // Les deux panneaux sont ouverts (et la version de la fiche lue) avant le premier enregistrement.
  for (const view of [page, other]) {
    await view.goto(`/events/${setup.eventId}`);
    await view.getByRole("link", { name: "Modifier les informations" }).click();
    await expect(view.getByRole("form", { name: "Fiche d'identité" })).toBeVisible();
  }
  const style = (view: Page) => view.getByRole("form", { name: "Fiche d'identité" }).locator('input[name="style"]');

  await style(page).fill("Champêtre");
  await style(page).press("Tab");
  await expect(page.getByRole("form", { name: "Fiche d'identité" }).getByText("Fiche enregistrée.")).toBeVisible();

  await style(other).fill("Industriel");
  await style(other).press("Tab");
  const conflict = other.getByRole("region", { name: "Modifié pendant que vous écriviez" });
  await expect(conflict).toBeVisible();
  await expect(conflict.getByText("Version enregistrée : « Champêtre »")).toBeVisible();
  await expect(conflict.getByText("Votre version : « Industriel »")).toBeVisible();
  await expectNoAxeViolation(other);
  await conflict.getByRole("button", { name: "Garder ma version" }).click();
  await expect(other.getByRole("form", { name: "Fiche d'identité" }).getByText("Fiche enregistrée.")).toBeVisible();

  // Le panneau est dans l'adresse : il se rouvre au rechargement.
  await page.reload();
  await expect(style(page)).toHaveValue("Industriel");
  await other.close();
});

test("NFR-16 — sans réseau, rien n'est envoyé et la saisie reste ; le retour de la connexion est annoncé", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await page.goto("/contacts");
  await page.getByRole("link", { name: "Ajouter un contact" }).first().click();
  const form = page.getByRole("form", { name: "Ajouter un contact" });

  await page.context().setOffline(true);
  await expect(page.getByText("Pas de connexion : ce que vous saisissez est gardé sur cet appareil.")).toBeVisible();
  await form.locator('input[name="firstName"]').fill("Rose");
  await form.locator('input[name="lastName"]').fill("Fleuriste");
  await form.getByRole("button", { name: "Ajouter le contact" }).click();
  await expect(form.getByRole("alert")).toContainText("Pas de connexion : rien n'a été envoyé");
  await expect(form.locator('input[name="firstName"]')).toHaveValue("Rose");

  await page.context().setOffline(false);
  await expect(page.getByText("Connexion rétablie : votre saisie est envoyée.")).toBeVisible();
  await form.getByRole("button", { name: "Ajouter le contact" }).click();
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}$/);
});
