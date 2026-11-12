// Lot 27a (POR-02, POR-05, POR-09, BUD-07 ; décisions D2 à D8) — le portail du
// client : accueil (compte à rebours, avancement, trois prochaines actions, une
// tâche cochée sur place), budget en trois chiffres, lisible à 360 px ; le
// payeur déclare une échéance réglée, la planner la confirme depuis
// « Aujourd'hui » et l'échéancier, en refuse une autre avec un motif ; l'aperçu
// « Voir comme » montre la même page, actions inactives. En taille ordinateur
// et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { parisToday } from "@symbola/i18n";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { addDefaultVendorSlots, addEventTask, createEventLink, createProspect, createProspectSource, listEventVendorSlots } from "../modules/events/service";
import { addVendorPayment, listBudgetLines, updateBudgetLine } from "../modules/budget/service";
import { openEventTab, readyOrganization } from "./helpers";

const PASSWORD = "mot-de-passe-por02-e2e";

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

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

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Mariage d'Inès dans 200 jours : deux tâches du client, une de la planner ;
// lieu et traiteur engagés, deux échéances au traiteur.
async function wedding() {
  const today = parisToday();
  const email = `planner-por02-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password: PASSWORD, role: "owner" });
    const organizationId = organization.id;
    await addDefaultVendorSlots(organizationId, ["Lieu de réception", "Traiteur"]);
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: user.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }], eventDate: addDays(today, 200) });
    await addEventTask(organizationId, event.id, { label: "Choisir les alliances", dueDate: addDays(today, 5), responsible: "clients" });
    await addEventTask(organizationId, event.id, { label: "Envoyer la liste des invités", dueDate: addDays(today, 30), responsible: "clients" });
    await addEventTask(organizationId, event.id, { label: "Relancer le traiteur", dueDate: addDays(today, 3), responsible: "planner" });
    const slots = await listEventVendorSlots(organizationId, event.id);
    for (const [label, cents] of [["Lieu de réception", 980000], ["Traiteur", 960000]] as const) {
      const slot = slots.find((candidate) => candidate.label === label)!;
      for (const field of ["estimated", "committed"] as const) await updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId: slot.id, field, amountCents: cents, changedByUserId: user.id });
    }
    const caterer = slots.find((slot) => slot.label === "Traiteur")!;
    const lineId = (await listBudgetLines(organizationId, event.id)).lines.find((line) => line.eventVendorSlotId === caterer.id)!.id;
    await addVendorPayment({ organizationId, eventId: event.id, lineId, label: "Acompte", fixedAmountCents: 288000, dueOn: addDays(today, 10), changedByUserId: user.id });
    await addVendorPayment({ organizationId, eventId: event.id, lineId, label: "Solde", fixedAmountCents: 672000, dueOn: addDays(today, 150), changedByUserId: user.id });
    const link = (personName: string, rights: Parameters<typeof createEventLink>[0]["link"]["rights"]) =>
      createEventLink({ organizationId, eventId: event.id, createdByUserId: user.id, audience: "client", locale: "fr", link: { personName, email: `${randomUUID()}@symbola.test`, rights } });
    const couple = await link("Inès", { rubrics: ["tasks", "program", "budget"], budgetScope: "all", sharedSlotIds: [] });
    const payer = await link("Bernard Martin", { rubrics: ["budget"], budgetScope: "selected", sharedSlotIds: [caterer.id] });
    return { email, eventId: event.id, coupleUrl: couple.url, payerUrl: payer.url };
  } finally {
    await sql.end();
  }
}

test("POR-02 / POR-05 — l'accueil du portail : compte à rebours, avancement, trois prochaines actions ; budget en trois chiffres, lisible à 360 px", async ({ page }) => {
  const setup = await wedding();
  await page.goto(setup.coupleUrl);
  await expect(page).toHaveURL(/\/portail$/);
  const home = page.getByRole("region", { name: "Accueil" });
  await expect(home).toContainText("dans 200 jours");
  await expect(home.getByText("0 tâche faite sur 3")).toBeVisible();
  const actions = home.getByRole("list").first();
  await expect(actions.getByRole("listitem")).toHaveCount(3);
  await expect(actions.getByRole("listitem").nth(0)).toContainText("Choisir les alliances");
  await expect(actions.getByRole("listitem").nth(1)).toContainText("Régler Traiteur — Acompte : 2 880,00 €");
  await expect(actions.getByRole("listitem").nth(2)).toContainText("Envoyer la liste des invités");
  await expect(home).not.toContainText("Relancer le traiteur");
  await expectNoAxeViolation(page);

  // Première action en quelques secondes : la tâche se coche depuis l'accueil.
  await actions.getByRole("button", { name: "Cocher la tâche Choisir les alliances" }).click();
  await expect(home.getByText("1 tâche faite sur 3")).toBeVisible();
  await expect(home).not.toContainText("Choisir les alliances");

  // Budget en trois chiffres, total et par poste.
  const budget = page.getByRole("region", { name: "Budget" });
  await expect(budget.getByRole("definition").first()).toHaveText("19 400,00 €");
  const caterer = budget.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Traiteur" }) });
  await expect(caterer).toContainText("Reste à payer9 600,00 €");
  await expect(page.getByRole("region", { name: "Échéances à venir" })).toContainText("Traiteur — Acompte — 2 880,00 €");

  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolation(page);
});

test("SC-06 étape 5 / POR-09 — le payeur déclare une échéance réglée ; la planner confirme, refuse l'autre avec un motif, et voit le portail comme lui", async ({ page: planner, browser }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  const payerContext = await browser.newContext({ locale: "fr-FR", viewport: planner.viewportSize() });
  const payer = await payerContext.newPage();
  await payer.goto(setup.payerUrl);
  await expect(payer).toHaveURL(/\/portail$/);
  await expect(payer.getByRole("region", { name: "Budget" })).not.toContainText("Lieu de réception");
  const payments = payer.getByRole("region", { name: "Échéances à venir" });
  for (const label of ["Acompte", "Solde"]) {
    await payments.getByText(`Je l'ai réglée : Traiteur — ${label}`).click();
    await payments.getByRole("button", { name: `Déclarer le règlement de Traiteur — ${label}` }).click();
    // La page se met à jour : l'échéance attend la confirmation de la planner.
    await expect(payments.getByRole("listitem").filter({ hasText: `Traiteur — ${label}` })).toContainText("en attente de confirmation");
  }
  await expect(payments.getByRole("button", { name: "Annuler ma déclaration pour Traiteur — Acompte" })).toBeVisible();
  await expectNoAxeViolation(payer);

  // La planner : « Aujourd'hui », puis l'échéancier du traiteur.
  await loginAndSetupMfa(planner, setup.email);
  await expect(planner.getByRole("region", { name: "Règlements déclarés à confirmer" })).toContainText("Bernard Martin a réglé Acompte (2 880,00 €)");
  await expectNoAxeViolation(planner);
  await planner.goto(`/budget/${setup.eventId}`);
  await planner.getByRole("button", { name: "Confirmer le paiement : Acompte" }).click();
  await expect(planner.getByText(/Règlement déclaré par Bernard Martin le .*, confirmé/)).toBeVisible();
  await planner.getByText("Refuser la déclaration : Solde").click();
  await planner.getByLabel("Motif, montré au client").fill("Virement non reçu par le traiteur");
  await planner.getByRole("button", { name: "Refuser et prévenir : Solde" }).click();
  await expect(planner.getByText("Déclaration refusée : Virement non reçu par le traiteur")).toBeVisible();
  await expectNoAxeViolation(planner);

  await payer.reload();
  await expect(payments).toContainText("Votre déclaration n'a pas été retenue : Virement non reçu par le traiteur");
  await expect(payer.getByRole("region", { name: "Échéances à venir" })).toContainText("1 échéance réglée ces trois derniers mois");

  // Aperçu « Voir comme Bernard Martin » : la même page, actions inactives, aucune trace sur son lien.
  await planner.goto(`/events/${setup.eventId}`);
  await openEventTab(planner, "Mariés");
  const links = planner.getByRole("list", { name: "Liens personnels" });
  const before = await links.innerText();
  await links.getByRole("link", { name: "Voir comme Bernard Martin" }).click();
  await expect(planner.getByText("Aperçu : ce que voit Bernard Martin")).toBeVisible();
  const budget = planner.getByRole("region", { name: "Budget" });
  await expect(budget.getByRole("heading", { name: "Traiteur" })).toBeVisible();
  await expect(budget).not.toContainText("Lieu de réception");
  await expect(planner.getByRole("button", { name: "Fermer l'accès sur cet appareil" })).toBeDisabled();
  await expectNoAxeViolation(planner);
  await planner.goto(`/events/${setup.eventId}`);
  await openEventTab(planner, "Mariés");
  expect(await links.innerText()).toBe(before);
  await payerContext.close();
});
