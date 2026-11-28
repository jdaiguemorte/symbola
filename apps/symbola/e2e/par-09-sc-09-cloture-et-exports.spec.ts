// Lot 58 (PAR-09, EVT-08, PRE-08, FAC-11 ; ADR 0097) — scénario SC-09 « Clôturer et capitaliser » :
// liste de clôture le lendemain de l'évènement, évaluation interne d'un prestataire, leçons, frais
// propres, remerciement relu avant l'envoi avec le lien d'avis de la planner, clôture et archivage
// (filtre « Archivés »), modèle sans donnée personnelle, puis exports comptables contrôlés, lus aussi
// par le Comptable. En taille ordinateur et en 375 px, axe-core. La clôture complète se chronomètre
// (moins de quinze minutes, PAR-09).
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import { addEventVendorSlot, addVendorCandidate, changeEventStatus, createProspect, createProspectSource, saveClosingSettings, updateVendorCandidate } from "../modules/events/service";
import { saveOnboardingStep } from "../modules/hub/service";
import { setPlannerFeeTerms } from "../modules/quotes/service";
import { createVendor } from "../modules/vendors/service";
import AxeBuilder from "./axe";
import { closeEventFromTimeline, readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

function daysAgo(days: number): string {
  const date = new Date(`${parisToday()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function atelier() {
  const suffix = randomUUID().slice(0, 8);
  const email = `camille-58-${suffix}@symbola.test`;
  const accountant = `mathilde-58-${suffix}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier Camille ${suffix}`);
    const organizationId = organization.id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000, legalForm: "auto_entrepreneur" });
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-58", role: "owner" });
    await createUser(db, { organizationId, email: accountant, password: "mot-de-passe-58", role: "accountant" });
    const source = await createProspectSource(organizationId, "Salon");
    // L'évènement d'avant-hier : sa clôture est due (J+1 passé, fuseau de Paris).
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin", email: `lea-${suffix}@symbola.test` }], eventDate: daysAgo(2) });
    await changeEventStatus({ organizationId, eventId: event.id, changedByUserId: owner.id, toStatus: "confirmed" });
    const { vendor } = await createVendor(organizationId, { name: "Maison Haddad", typeId: null });
    const slot = await addEventVendorSlot(organizationId, event.id, "Traiteur");
    const candidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: slot.id, vendorName: vendor.name, vendorId: vendor.id });
    await updateVendorCandidate({ organizationId, candidateId: candidate.id, status: "retained", changedByUserId: owner.id });
    await setPlannerFeeTerms(organizationId, event.id, { kind: "flat", flatCents: 350_000, percentBasisPoints: null, base: "estimated" });
    await saveClosingSettings(organizationId, { reviewUrl: "https://g.page/r/atelier-camille", reviewLabel: "Google" });
    return { email, accountant, eventId: event.id, vendorId: vendor.id };
  } finally {
    await sql.end();
  }
}

test("PAR-09 / PRE-08 / EVT-08 — SC-09 : Camille clôture l'évènement en moins de quinze minutes, note son traiteur, remercie Léa, archive et garde un modèle sans donnée personnelle", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  const started = Date.now();

  // Étape 1 : « À clôturer » dans Aujourd'hui, puis la liste de clôture.
  await expect(page.getByText("À clôturer").first()).toBeVisible();
  await page.goto(`/events/${setup.eventId}`);
  // Lot 72d (E2) : le lendemain du jour J, « Clôturer l'évènement… » au bout de la frise (sur téléphone,
  // dans « Les étapes »).
  await closeEventFromTimeline(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Clôture de l'évènement");
  const checklist = page.getByRole("list", { name: "Étapes de la clôture" });
  await expect(checklist.locator('[data-step="time_spent"]')).toContainText("Facultatif");
  await expectNoAxeViolation(page);

  // Étape 3 (PRE-08) : la note du traiteur, interne.
  const rating = page.getByRole("form", { name: "Maison Haddad" });
  await rating.getByLabel("Note").selectOption("5");
  await rating.getByLabel("Ponctualité").selectOption("4");
  await rating.getByLabel("Commentaire").fill("Service impeccable, à reprendre.");
  await rating.getByRole("button", { name: "Enregistrer l'évaluation" }).click();
  await expect(rating.getByRole("status")).toHaveText("Évaluation enregistrée.");

  // Leçons et frais propres (le temps passé reste vide : aucune obligation).
  await page.getByLabel("Leçon 1").fill("Prévoir un plan B pluie");
  await page.getByLabel("Leçon 2").fill("Confirmer le traiteur à J-7");
  await page.getByLabel("Leçon 3").fill("Doubler les navettes");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Enregistré." })).toBeVisible();
  await page.getByLabel("Libellé").fill("Déplacements");
  await page.getByLabel("Montant HT (€)").fill("120,50");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByTestId("closing-margin")).toContainText("3 379,50");
  await expect(page.getByRole("link", { name: "Voir tous vos bilans" })).toHaveCount(0);

  // Étape 2 : le remerciement, avec le lien d'avis de Camille, relu et modifié avant l'envoi.
  await page.goto(`/events/${setup.eventId}/cloture/avis`);
  const body = page.getByRole("textbox", { name: "Message" });
  await expect(body).toHaveValue(/https:\/\/g\.page\/r\/atelier-camille/);
  await expect(body).toHaveValue(/Bonjour Léa/);
  await body.fill(`${await body.inputValue()}\n\nLes photos arrivent la semaine prochaine.`);
  await page.getByRole("button", { name: "Envoyer" }).click();
  // Lot 65d (ADR 0110) : par défaut, la planner envoie les messages de la relation de sa messagerie ;
  // Symbola prépare les remerciements (lien d'avis compris), elle note « J'ai envoyé ».
  const prepared = page.getByRole("dialog", { name: "Préparer l'e-mail" });
  await expect(prepared.getByLabel("Message", { exact: true })).toHaveValue(/Les photos arrivent la semaine prochaine\./);
  await expectNoAxeViolation(page);
  await prepared.getByRole("button", { name: "J'ai envoyé" }).click();
  await expect(prepared.getByRole("status").filter({ hasText: "Envoi noté" })).toBeVisible();

  // Étape 4 : clôturer (budget figé), puis archiver.
  await page.goto(`/events/${setup.eventId}/cloture`);
  await page.getByRole("button", { name: "Clôturer l'évènement" }).click();
  await expect(page.getByText(/Clôturé le/)).toBeVisible();
  await page.getByRole("button", { name: "Archiver l'évènement" }).click();
  await expect(page.getByRole("heading", { name: "Évènement archivé : lecture seule." })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(15 * 60 * 1000);

  // L'évènement sort des listes courantes et reste consultable sous « Archivés ».
  await page.goto("/events?tab=termines");
  await expect(page.getByRole("main").getByRole("link", { name: /Léa/ })).toHaveCount(0);
  await page.goto("/events?tab=archives");
  await expect(page.getByRole("main").getByRole("link", { name: /Léa/ }).first()).toBeVisible();

  // Étape 6 (EVT-08) : un modèle refusé avec le nom de la cliente, accepté sans.
  await page.goto(`/events/${setup.eventId}/cloture`);
  await page.getByLabel("Nom du modèle").fill("Mariage Martin");
  await page.getByRole("button", { name: "Enregistrer le modèle" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "données personnelles" })).toContainText("nom d'un client");
  await page.getByLabel("Nom du modèle").fill("Mariage champêtre");
  await page.getByRole("button", { name: "Enregistrer le modèle" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Modèle enregistré." })).toBeVisible();
  await page.goto("/events/modeles-evenement");
  await expect(page.getByRole("heading", { name: "Mariage champêtre" })).toBeVisible();
  await expectNoAxeViolation(page);

  // L'historique du traiteur, sur sa fiche, garde la note (interne). Lot 73d : « Avec vous » réunit les deux
  // historiques ; la note du mariage est sur sa ligne.
  await page.goto(`/prestataires/${setup.vendorId}`);
  await expect(page.getByRole("region", { name: "Avec vous" })).toContainText("5 sur 5");
});

test("FAC-11 — SC-09 étape 5 : l'export du mois se contrôle au centime ; le Comptable le télécharge en lecture seule", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await page.goto("/devis/exports-comptables");
  await expect(page.getByLabel("Format des exports")).toHaveValue("micro");
  await expect(page.getByTestId("reconciliation")).toContainText("Rapproché au centime");
  await expect(page.getByRole("heading", { name: "Plan de comptes" })).toBeVisible();
  await expectNoAxeViolation(page);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Télécharger : Journal des recettes (CSV)" }).click();
  expect((await download).suggestedFilename()).toMatch(/^journal-recettes-\d{4}-\d{2}-01-\d{4}-\d{2}-\d{2}\.csv$/);

  const context = await browser.newContext();
  const accountant = await context.newPage();
  await signIn(accountant, setup.accountant, /\/comptable/);
  await accountant.getByRole("link", { name: /Exports comptables \(journaux/ }).click();
  await expect(accountant.getByText("Lecture seule", { exact: true })).toBeVisible();
  await expect(accountant.getByRole("heading", { level: 1 })).toHaveText("Exports comptables");
  await expect(accountant.getByRole("heading", { name: "Plan de comptes" })).toHaveCount(0);
  // Aucune clôture, évaluation ni bilan pour le Comptable.
  const refused = await accountant.goto(`/events/${setup.eventId}/cloture`);
  expect(accountant.url()).not.toContain("/cloture");
  expect(refused?.status()).toBeLessThan(500);
  await context.close();
});
