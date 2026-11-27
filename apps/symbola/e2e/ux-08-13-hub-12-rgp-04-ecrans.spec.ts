// Lot 39c (UX-08, UX-13, HUB-12, RGP-04 ; décisions D11 à D14) — des écrans qui guident : l'écran vide
// enseigne (action, exemple, aide) ; ⌘K propose aussi des actions ; « ? » ouvre l'aide de l'écran ; un
// champ libre porte sa mise en garde. Ordinateur et 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addEventTask, createProspect, createProspectSource } from "../modules/events/service";
import { createContact } from "../modules/hub/service";
import { feedback, readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function atelierVide() {
  const email = `planner-ux08-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    await createUser(db, { organizationId: organization.id, email, role: "owner" });
    return { email, organizationId: organization.id };
  } finally {
    await sql.end();
  }
}

test("UX-08 — l'écran vide enseigne : une action principale, un exemple, l'aide", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelierVide();
  await signIn(page, setup.email, /\/$/);

  await page.goto("/contacts");
  const contacts = page.getByRole("region", { name: "Aucun contact pour l'instant. Les clients de vos évènements deviennent des contacts." });
  await expect(contacts).toBeVisible();
  await expect(contacts.getByText("Par exemple : Léa Martin, ou la Maison Haddad.")).toBeVisible();
  await expect(contacts.getByRole("link", { name: "Lire l'aide" })).toHaveAttribute("href", "/aide");
  await expect(contacts.getByRole("link", { name: "Ajouter un contact" })).toBeVisible();
  await expectNoAxeViolation(page);

  await page.goto("/events");
  const events = page.getByRole("region", { name: "Aucun évènement pour l'instant" });
  await expect(events).toBeVisible();
  await events.getByRole("link", { name: "Créer un évènement" }).click();
  await expect(page).toHaveURL(/\/events\/new$/);

  await page.goto("/parametres/corbeille");
  await expect(page.getByRole("region", { name: "La corbeille est vide." })).toBeVisible();
  await expectNoAxeViolation(page);

  await page.goto("/devis/encaissements");
  const payments = page.getByRole("region", { name: "Aucune échéance à encaisser." });
  await expect(payments.getByRole("link", { name: "Voir les devis" })).toHaveAttribute("href", "/devis");
  await expectNoAxeViolation(page);
});

test("UX-15 — un écran qui tarde laisse place à son squelette, puis à l'écran", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelierVide();
  await signIn(page, setup.email, /\/$/);
  await page.goto("/events");
  await page.waitForLoadState("networkidle");
  // L'écran visé tarde d'une seconde et demie.
  await page.route(/\/events\/new\?_rsc=/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue();
  });
  await page.getByRole("region", { name: "Aucun évènement pour l'instant" }).getByRole("link", { name: "Créer un évènement" }).click();
  const skeleton = page.locator("main[aria-busy='true']");
  await expect(skeleton).toBeVisible();
  await expect(skeleton.getByRole("status")).toHaveText("Chargement de la page…");
  // L'écran courant laisse sa place : un seul contenu principal à la fois.
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Nouveau prospect" })).toBeVisible();
  await expect(skeleton).toHaveCount(0);
});

test("UX-07 et UX-15 — une tâche cochée l'est tout de suite, et « Annuler » la rétablit pendant dix secondes", async ({ page }) => {
  test.setTimeout(150_000);
  const email = `planner-ux07-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  let eventId: string;
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    const event = await createProspect({ organizationId: organization.id, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }, { firstName: "Sacha" }], eventDate: "2027-09-18" });
    eventId = event.id;
    await addEventTask(organization.id, event.id, { label: "Réserver le traiteur", dueDate: "2027-03-01", responsible: "planner" });
    await addEventTask(organization.id, event.id, { label: "Choisir les faire-part", dueDate: "2027-04-01", responsible: "planner" });
  } finally {
    await sql.end();
  }
  await signIn(page, email, /\/$/);

  // Écran « Tâches », vue « À faire » : la tâche cochée quitte la liste, le bandeau reste.
  await page.goto("/taches");
  await page.getByRole("button", { name: "Fait « Réserver le traiteur »" }).click();
  const offer = feedback(page).filter({ hasText: "Tâche faite : Réserver le traiteur" });
  await expect(offer.getByRole("button", { name: "Annuler" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fait « Réserver le traiteur »" })).toHaveCount(0);
  await expectNoAxeViolation(page);
  await offer.getByRole("button", { name: "Annuler" }).click();
  await expect(feedback(page).filter({ hasText: "Tâche remise à faire : Réserver le traiteur" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fait « Réserver le traiteur »" })).toBeVisible();

  // Onglet « Tâches » de la fiche (État « Toutes »), en 375 px : sans « Annuler », la coche reste après
  // dix secondes ; « Rouvrir » ne propose rien.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/events/${eventId}?onglet=taches&etat=toutes`);
  await page.getByRole("button", { name: "Fait « Choisir les faire-part »" }).click();
  const second = feedback(page).filter({ hasText: "Tâche faite : Choisir les faire-part" });
  await expect(second.getByRole("button", { name: "Annuler" })).toBeVisible();
  await expectNoAxeViolation(page);
  await expect(second).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Rouvrir « Choisir les faire-part »" })).toBeVisible();
  await page.getByRole("button", { name: "Rouvrir « Choisir les faire-part »" }).click();
  await expect(page.getByRole("button", { name: "Fait « Choisir les faire-part »" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler", exact: true })).toHaveCount(0);
});

test("HUB-12 — ⌘K propose aussi des actions, filtrées par les modules souscrits", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelierVide();
  await signIn(page, setup.email, /\/$/);
  const search = page.getByRole("search", { name: "Recherche dans Symbola" }).getByRole("combobox", { name: "Rechercher" });
  await search.click();
  await search.fill("corbeille");
  const option = page.getByRole("option", { name: /Ouvrir la corbeille/ });
  await expect(option).toBeVisible();
  await expect(page.getByRole("group", { name: "Actions" })).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/parametres\/corbeille$/);
});

test("UX-13 et RGP-04 — créer et modifier en panneau, « ? » ouvre l'aide de l'écran ; une note de contact porte la mise en garde", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelierVide();
  const contact = await createContact(setup.organizationId, { firstName: "Rose", lastName: "Fleuriste" });
  await signIn(page, setup.email, /\/$/);

  // Relevé validé le 17/11 : « Créer » en tête de la liste, le formulaire en panneau ; Échap le ferme.
  await page.goto("/contacts");
  await page.getByRole("link", { name: "Ajouter un contact" }).first().click();
  const creation = page.getByRole("complementary", { name: "Ajouter un contact" });
  await expect(creation.getByRole("form", { name: "Ajouter un contact" })).toBeVisible();
  await expectNoAxeViolation(page);
  await page.keyboard.press("Escape");
  await expect(creation).toHaveCount(0);
  await expect(page).toHaveURL(/\/contacts$/);

  // La fiche se lit dans la page ; « Modifier la fiche », en tête de sa section, ouvre le panneau.
  await page.goto(`/contacts/${contact.id}`);
  const identity = page.getByRole("region", { name: "Identité et coordonnées" });
  await expect(identity.getByRole("textbox")).toHaveCount(0);
  await identity.getByRole("link", { name: "Modifier la fiche" }).click();
  const edition = page.getByRole("complementary", { name: "Modifier la fiche" });
  await edition.getByLabel("Téléphone").fill("06 12 34 56 78");
  await edition.getByLabel("Téléphone").press("Tab");
  await expect(edition.getByText("Fiche enregistrée.")).toBeVisible();
  await expect(identity).toContainText("06 12 34 56 78");
  await page.getByRole("link", { name: "Fermer le panneau" }).click();
  await expect(edition).toHaveCount(0);

  await expect(page.getByRole("form", { name: "Ajouter la note" }).getByText("Ne notez ici ni donnée de santé, ni opinion, ni religion : ce champ peut être lu par votre équipe et exporté.")).toBeVisible();

  const help = page.getByRole("button", { name: "Aide sur cet écran" });
  await page.locator("body").press("?");
  await expect(help).toHaveAttribute("aria-expanded", "true");
});
