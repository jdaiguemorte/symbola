// Lot 32b (HUB-07, UX-03, CRM-04, EVT-07, CHR-03 ; décisions D9 à D11) — la création rapide depuis
// tout écran (« Créer » ou la touche N) : prospect, tâche, dépense, devis, sans quitter l'écran,
// l'évènement de l'écran proposé ; l'alerte de date avant l'enregistrement ; le portefeuille (liste,
// calendrier, charge par mois, deux évènements le même jour) ; le calendrier des tâches ; « Écrire
// au client ». Un module non souscrit retire son entrée. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { addEventTask, addEventVendorSlot, changeEventStatus, createProspect, createProspectSource, getEvent, listEventTasks, updateEventClientContact } from "../modules/events/service";
import { saveOnboardingStep, setModuleEnabled } from "../modules/hub/service";
import { readyOrganization } from "./helpers";

const PASSWORD = "mot-de-passe-de-mardi";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL(/\/$/);
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

  // Prospect depuis « Aujourd'hui » : « Créer », « Prospect », « Créer le prospect » (trois gestes).
  // La date choisie annonce les évènements du même jour, sans empêcher d'enregistrer (CRM-04).
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(quickMenu(page).getByRole("button")).toHaveText(["Prospect", "Tâche", "Dépense", "Devis"]);
  await quickMenu(page).getByRole("button", { name: "Prospect" }).click();
  const prospect = page.getByRole("dialog", { name: "Nouveau prospect" });
  await prospect.getByLabel("Prénom du client").fill("Chloé");
  await prospect.getByLabel("Source du contact").selectOption({ label: "Salon" });
  await prospect.getByLabel("Date de l'évènement (facultatif)").fill(setup.date);
  await expect(prospect.getByRole("status").filter({ hasText: "vous avez déjà" })).toContainText("Léa & Maxime (confirmé), Inès & Sacha (option)");
  await expectNoAxeViolation(page);
  await prospect.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(prospect.getByRole("status").filter({ hasText: "Prospect Chloé créé." })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await prospect.getByRole("button", { name: "Fermer" }).click();
  await expect(prospect).toBeHidden();

  // Tâche par la touche N, sur la fiche de Léa et Maxime : l'évènement de l'écran est proposé.
  await page.goto(`/events/${setup.lea}`);
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("n");
  await quickMenu(page).getByRole("button", { name: "Tâche" }).click();
  const task = page.getByRole("dialog", { name: "Nouvelle tâche" });
  await expect(task.getByLabel("Évènement")).toHaveValue(setup.lea);
  await task.getByLabel("Tâche", { exact: true }).fill("Réserver la navette");
  await task.getByRole("button", { name: "Ajouter la tâche" }).click();
  await expect(task.getByRole("status")).toContainText("Tâche « Réserver la navette » ajoutée.");
  await expectNoAxeViolation(page);
  await task.getByRole("button", { name: "Fermer" }).click();

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
  await expect(quote.getByLabel("Évènement")).toHaveValue(setup.lea);
  await quote.getByRole("button", { name: "Créer le devis" }).click();
  await expect(quote.getByRole("status")).toContainText(/Devis D-\d{4}-\d{4} créé, en brouillon\./);
  await quote.getByRole("link", { name: "Ouvrir" }).click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);

  // Tout est arrivé : la tâche au rétroplanning, la dépense au budget avec le montant du devis.
  await page.goto(`/events/${setup.lea}?onglet=retroplanning`);
  await expect(page.getByRole("rowheader", { name: "Réserver la navette" })).toBeVisible();
  await page.goto(`/budget/${setup.lea}`);
  await expect(page.getByText("Dîner, 120 couverts").first()).toBeVisible();
  await expect(page.locator("main")).toContainText(/9\s600,00\s€/);

  // UX-03 : « Écrire au client » ouvre la messagerie, à l'adresse du client.
  await page.goto(`/events/${setup.lea}`);
  await expect(page.getByRole("link", { name: "Écrire au client" })).toHaveAttribute("href", /^mailto:lea-/);

  // CRM-04 sur la fiche : la date de l'évènement annonce les autres évènements de ce jour.
  await page.locator("summary", { hasText: "Modifier les informations" }).click();
  await expect(page.getByRole("status").filter({ hasText: "vous avez déjà" })).toContainText("Inès & Sacha (option)");

  // ARC-06 : sans le module Devis, l'entrée « Devis » disparaît.
  const { sql, db } = createAppConnection();
  try {
    await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId: setup.organizationId, moduleKey: "quotes", enabled: false });
  } finally {
    await sql.end();
  }
  await page.reload();
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(quickMenu(page).getByRole("button")).toHaveText(["Prospect", "Tâche", "Dépense"]);
});

test("EVT-07 / CHR-03 — le portefeuille en liste et en calendrier, la charge par mois, le calendrier des tâches", async ({ page }) => {
  const setup = await atelier();
  await login(page, setup.email);

  // Liste : deux évènements le même jour sont signalés.
  await page.goto("/events");
  await expect(page.getByRole("row", { name: /^Léa & Maxime/ })).toContainText("Même jour : Inès & Sacha");
  await expect(page.getByRole("row", { name: /^Inès & Sacha/ })).toContainText("Même jour : Léa & Maxime");
  // Charge par mois : le mois du mariage compte un confirmé et une option.
  const load = page.getByRole("region", { name: "Charge des douze prochains mois" });
  const row = load.getByRole("row", { name: new RegExp(monthName(setup.date), "i") });
  await expect(row.getByRole("cell").nth(0)).toHaveText("1");
  await expect(row.getByRole("cell").nth(1)).toHaveText("1");
  await expectNoAxeViolation(page);

  // Calendrier : l'agenda des mois à venir, le jour partagé signalé.
  await page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: "Calendrier" }).click();
  await expect(page).toHaveURL(/affichage=calendrier/);
  const agenda = page.getByRole("region", { name: "Agenda" });
  await agenda.getByRole("link", { name: "Voir l'année" }).click();
  await expect(page).toHaveURL(/agenda=12/);
  await expect(page).toHaveURL(/affichage=calendrier/);
  await expect(agenda.getByText(/2 événements (ce week-end|ce jour-là)/).first()).toBeAttached();
  await expectNoAxeViolation(page);

  // Tâches : le calendrier du mois ; chaque tâche ouvre son évènement.
  await page.goto(`/taches?affichage=calendrier&mois=${setup.dueOn.slice(0, 7)}`);
  const calendar = page.getByRole("region", { name: new RegExp(monthName(setup.dueOn), "i") });
  await expect(calendar).toContainText("Léa & Maxime");
  await expectNoAxeViolation(page);
  await calendar.getByRole("link", { name: "Choisir le menu" }).click();
  await expect(page).toHaveURL(new RegExp(`/events/${setup.lea}\\?onglet=retroplanning&tache=`));
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
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await quickMenu(page).getByRole("button", { name: "Prospect" }).click();
  const prospect = page.getByRole("dialog", { name: "Nouveau prospect" });
  const date = prospect.getByLabel("Date de l'évènement (facultatif)");
  await date.fill(other.date);
  await expect(prospect.getByRole("status").filter({ hasText: "vous avez déjà" })).toContainText("Zoé (option)");
  const answered = page.waitForResponse((response) => response.request().method() === "POST");
  await date.fill(camille.date);
  await answered;
  await expect(prospect.getByRole("status").filter({ hasText: "vous avez déjà" })).toHaveCount(0);
  await expect(prospect).not.toContainText("Léa");
  await prospect.getByRole("button", { name: "Fermer" }).click();

  // Un identifiant d'évènement forgé (celui de Camille) : refusé, rien n'est créé chez elle.
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await quickMenu(page).getByRole("button", { name: "Tâche" }).click();
  const task = page.getByRole("dialog", { name: "Nouvelle tâche" });
  await task.getByLabel("Évènement").evaluate((select, id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = "forgé";
    select.appendChild(option);
    (select as HTMLSelectElement).value = id;
  }, camille.lea);
  await task.getByLabel("Tâche", { exact: true }).fill("Tâche forgée");
  await task.getByRole("button", { name: "Ajouter la tâche" }).click();
  await expect(task.getByRole("alert")).toBeVisible();
  expect((await listEventTasks(camille.organizationId, camille.lea)).map((entry) => entry.label)).not.toContain("Tâche forgée");
});
