// Lot 32b (HUB-07, UX-03, CRM-04, EVT-07, CHR-03 ; décisions D9 à D11) — la création rapide depuis
// tout écran (« Créer » ou la touche N) : prospect, tâche, dépense, devis, sans quitter l'écran,
// l'évènement de l'écran proposé ; l'alerte de date avant l'enregistrement ; le portefeuille (liste,
// calendrier, charge par mois, deux évènements le même jour) ; le calendrier des tâches ; « Écrire
// au client ». Un module non souscrit retire son entrée. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { addEventTask, addEventVendorSlot, changeEventStatus, createProspect, createProspectSource, getEvent, updateEventClientContact } from "../modules/events/service";
import { saveOnboardingStep, setModuleEnabled } from "../modules/hub/service";
import { eventCommand, readyOrganization, signIn as signInByLink, openEventInfo, eventInfoWindow } from "./helpers";
import { submitNewEvent } from "./new-event";

const PASSWORD = "mot-de-passe-de-mardi";

async function login(page: Page, email: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, /\/$/);
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

function parisDay(offsetDays = 0): string {
  const day = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
}

function monthName(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

// L'atelier de Camille : Léa et Maxime confirmés à J+68 (une adresse, un poste « Traiteur », une
// tâche demain), Inès et Sacha en prospect le même jour.
async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const date = parisDay(68);
    const lea = (await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], eventDate: date })).id;
    const leaClient = (await getEvent(organizationId, lea))!.clients.find((client) => client.firstName === "Léa")!;
    await updateEventClientContact({ organizationId, eventId: lea, clientId: leaClient.id, contact: { email: `lea-${randomUUID()}@exemple.test` } });
    await changeEventStatus({ organizationId, eventId: lea, changedByUserId: owner.id, toStatus: "confirmed" });
    await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }, { firstName: "Sacha" }], eventDate: date });
    await addEventVendorSlot(organizationId, lea, "Traiteur");
    const dueOn = parisDay(1);
    await addEventTask(organizationId, lea, { label: "Choisir le menu", dueDate: dueOn, responsible: "planner" });
    return { organizationId, email, lea, date, dueOn };
  } finally {
    await sql.end();
  }
}

function quickMenu(page: Page) {
  return page.getByRole("group", { name: "Que voulez-vous créer ?" });
}

test("HUB-07 / UX-03 / CRM-04 — créer un prospect, une tâche, une dépense et un devis depuis n'importe quel écran", async ({ page }) => {
  const setup = await atelier();
  await login(page, setup.email);

  // Évènement depuis « Aujourd'hui » : « Créer », « Nouvel évènement » (lot 70e : plus de « Prospect »).
  // La date choisie annonce les évènements du même jour, sans empêcher d'enregistrer (CRM-04).
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(quickMenu(page).locator("strong")).toHaveText(["Nouvel évènement", "Tâche", "Prestataire", "Contact", "Devis", "Dépense"]);
  await quickMenu(page).getByRole("link", { name: /^Nouvel évènement/ }).click();
  await expect(page).toHaveURL(/\/events\/new$/);
  await page.getByLabel(/^Nom de l'évènement/).fill("Chloé");
  await page.getByLabel(/^Date/).fill(setup.date);
  await expect(page.getByRole("status").filter({ hasText: "vous avez déjà" })).toContainText("Léa & Maxime (confirmé), Inès & Sacha (option)");
  await expectNoAxeViolation(page);
  await page.getByRole("radio", { name: /^Une demande en cours/ }).check();
  await submitNewEvent(page);
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name: "Chloé" })).toBeVisible();

  // Tâche par la touche N, sur la fiche de Léa et Maxime : le panneau unique d'une tâche (lot 70c) s'ouvre,
  // l'évènement de l'écran est choisi d'office.
  await page.goto(`/events/${setup.lea}`);
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("n");
  await quickMenu(page).getByRole("link", { name: /^Tâche pour Léa & Maxime/ }).click();
  await expect(page).toHaveURL(new RegExp(`/taches\\?nouvelle=1&evenement=${setup.lea}`));
  const task = page.getByRole("dialog", { name: "Nouvelle tâche" });
  await expect(task.getByLabel("Évènement")).toHaveValue(setup.lea);
  await task.getByLabel(/^Tâche/).fill("Réserver la navette");
  await task.getByLabel(/^Échéance/).fill(setup.date);
  await task.getByRole("button", { name: "Créer la tâche" }).click();
  await expect(page).not.toHaveURL(/nouvelle=1/);

  // Dépense : retour sur la fiche, dont l'évènement est proposé.
  await page.goto(`/events/${setup.lea}`);

  // Dépense : le poste, le prestataire s'il y en a, le libellé et le montant du devis.
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await quickMenu(page).getByRole("button", { name: "Dépense" }).click();
  const expense = page.getByRole("dialog", { name: "Nouvelle dépense" });
  await expense.getByLabel("Poste du budget").selectOption({ label: "Traiteur" });
  await expense.getByLabel("Libellé").fill("Dîner, 120 couverts");
  await expense.getByLabel("Montant du devis du prestataire, TTC (facultatif)").fill("9 600");
  await expense.getByRole("button", { name: "Enregistrer la dépense" }).click();
  await expect(expense.getByRole("status")).toContainText("Dépense « Dîner, 120 couverts » enregistrée.");
  await expense.getByRole("button", { name: "Fermer" }).click();

  // Devis : créé en brouillon, numéroté ; le lien l'ouvre.
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await quickMenu(page).getByRole("button", { name: "Devis" }).click();
  const quote = page.getByRole("dialog", { name: "Nouveau devis" });
  // Le choix « Un évènement existant » (lot 67c) porte aussi le mot : la liste se désigne par son rôle.
  await expect(quote.getByRole("combobox")).toHaveValue(setup.lea);
  await quote.getByRole("button", { name: "Créer le devis" }).click();
  await expect(quote.getByRole("status")).toContainText(/Devis D-\d{4}-\d{4} créé, en brouillon\./);
  await quote.getByRole("link", { name: "Ouvrir" }).click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);

  // Lot 67c (HUB-07, FAC-01 ; recette du 24/11/2026, R05) : un devis pour un nouveau prospect, créé
  // avec lui, sans passer d'abord par « Prospect ».
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await quickMenu(page).getByRole("button", { name: "Devis" }).click();
  const prospectQuote = page.getByRole("dialog", { name: "Nouveau devis" });
  await prospectQuote.getByLabel("Un nouveau prospect").check();
  await expect(prospectQuote.getByLabel("Type d'évènement")).toBeVisible();
  await prospectQuote.getByLabel("Prénom du client").fill("Zoé");
  await prospectQuote.getByLabel("Source du contact").selectOption({ index: 1 });
  await prospectQuote.getByRole("button", { name: "Créer le devis" }).click();
  await expect(prospectQuote.getByRole("status")).toContainText(/Prospect Zoé créé, avec le devis D-\d{4}-\d{4} en brouillon\./);
  await prospectQuote.getByRole("link", { name: "Ouvrir" }).click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);

  // Tout est arrivé : la tâche au rétroplanning, la dépense au budget avec le montant du devis.
  await page.goto(`/events/${setup.lea}?onglet=taches`);
  await expect(page.getByRole("link", { name: "Réserver la navette", exact: true })).toBeVisible();
  await page.goto(`/budget/${setup.lea}/detail`);
  await expect(page.getByText("Dîner, 120 couverts").first()).toBeVisible();
  await expect(page.locator("main")).toContainText(/9\s600,00\s€/);

  // UX-03 : « Écrire au client » ouvre la messagerie, à l'adresse du client ; lot 38b (HUB-21) : par
  // la page du message. Lot 45 (CRM-05) : sans modèle de message, le texte de départ de la réponse,
  // à relire, part de Symbola ou s'ouvre dans la messagerie.
  await page.goto(`/events/${setup.lea}`);
  // Lot 72d (J10) : « Écrire aux mariés » (ou le mot des clients du type), dans l'en-tête ou au menu « ⋯ ».
  await eventCommand(page, /^Écrire (aux mariés|au client)/);
  await expect(page.getByRole("heading", { name: "Écrire au client", level: 1 })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Texte" })).toHaveValue(/^Bonjour /);
  // Lot 65d (ADR 0110) : par défaut, la planner l'envoie de sa messagerie, préparé par Symbola.
  await expect(page.getByRole("button", { name: "Préparer l'e-mail" })).toBeVisible();
  await page.goto(`/events/${setup.lea}`);

  // CRM-04 sur la fiche : la date de l'évènement annonce les autres évènements de ce jour.
  // Lot 72e : la date d'une demande se change dans la fenêtre « Modifier les informations ».
  const info = await openEventInfo(page, "Date et lieux");
  await expect(info.getByRole("status").filter({ hasText: "vous avez déjà" })).toContainText("Inès & Sacha (option)");
  // Sans changement, Échap ferme la fenêtre (le même geste que « Fermer », masqué sur téléphone).
  await page.keyboard.press("Escape");
  await expect(eventInfoWindow(page)).toHaveCount(0);

  // ARC-06 : sans le module Devis, l'entrée « Devis » disparaît.
  const { sql, db } = createAppConnection();
  try {
    await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId: setup.organizationId, moduleKey: "quotes", enabled: false });
  } finally {
    await sql.end();
  }
  await page.reload();
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(quickMenu(page).locator("strong")).toHaveText(["Nouvel évènement", "Tâche pour Léa & Maxime", "Prestataire", "Contact", "Dépense pour Léa & Maxime"]);
});

test("EVT-07 / CHR-03 — le portefeuille en liste et en calendrier, la charge par mois, le calendrier des tâches", async ({ page }) => {
  const setup = await atelier();
  await login(page, setup.email);

  // Liste : deux évènements le même jour sont signalés.
  await page.goto("/events");
  // Lot 72f (critère 3) : « 2 le même jour » dans la date, en texte neutre.
  await expect(page.getByRole("row", { name: /^Léa & Maxime/ })).toContainText("2 le même jour");
  await expect(page.getByRole("row", { name: /^Inès & Sacha/ })).toContainText("2 le même jour");
  await expectNoAxeViolation(page);

  // Calendrier : l'agenda des mois à venir, le jour partagé signalé.
  // Lot 72f : sur téléphone, les autres vues sont au menu « ⋯ ».
  if ((page.viewportSize()?.width ?? 1280) < 640) {
    await page.getByRole("button", { name: /^Autres actions/ }).click();
    await page.getByRole("menuitem", { name: "Calendrier" }).click();
  } else await page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: "Calendrier" }).click();
  await expect(page).toHaveURL(/affichage=calendrier/);
  // Lot 72f (E8) : la charge par mois est sous le calendrier ; le mois du mariage compte un confirmé et une option.
  const load = page.getByRole("region", { name: "Charge des mois à venir, en tableau" });
  const row = load.getByRole("row", { name: new RegExp(monthName(setup.date), "i") });
  await expect(row.getByRole("cell").nth(0)).toHaveText("1");
  await expect(row.getByRole("cell").nth(1)).toHaveText("1");
  const agenda = page.getByRole("region", { name: "Agenda" });
  await agenda.getByRole("link", { name: "Voir l'année" }).click();
  await expect(page).toHaveURL(/agenda=12/);
  await expect(page).toHaveURL(/affichage=calendrier/);
  await expect(agenda.getByText(/2 évènements (ce week-end|ce jour-là)/).first()).toBeAttached();
  await expectNoAxeViolation(page);

  // Tâches : le calendrier du mois ; chaque tâche s'ouvre dans sa fenêtre, sur l'écran (lot 63d).
  await page.goto(`/taches?affichage=calendrier&mois=${setup.dueOn.slice(0, 7)}`);
  const calendar = page.getByRole("region", { name: new RegExp(monthName(setup.dueOn), "i") });
  await expect(calendar).toContainText("Léa & Maxime");
  await expectNoAxeViolation(page);
  await calendar.getByRole("link", { name: "Choisir le menu" }).click();
  await expect(page).toHaveURL(/\/taches\?.*tache=/);
  await expect(page.getByRole("dialog", { name: "Choisir le menu" }).getByLabel(/^Tâche/)).toHaveValue("Choisir le menu");
});

// Une autre agence : Zoé en prospect à J+200, rien d'autre.
async function autreAtelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Agence ${randomUUID()}`)).id;
    const email = `nadia-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const date = parisDay(200);
    await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Zoé" }], eventDate: date });
    return { email, date };
  } finally {
    await sql.end();
  }
}

test("SEC-12 / SEC-13 — la création rapide et l'alerte de date ne touchent jamais une autre organisation", async ({ page }) => {
  const camille = await atelier();
  const other = await autreAtelier();
  await login(page, other.email);

  // L'alerte de date annonce les évènements de l'agence, jamais ceux d'une autre.
  await page.goto("/events/new");
  const date = page.getByLabel(/^Date/);
  await date.fill(other.date);
  await expect(page.getByRole("status").filter({ hasText: "vous avez déjà" })).toContainText("Zoé (option)");
  const answered = page.waitForResponse((response) => response.request().method() === "POST");
  await date.fill(camille.date);
  await answered;
  await expect(page.getByRole("status").filter({ hasText: "vous avez déjà" })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Léa");
});
