// Lot 32a (HUB-08, UX-01, UX-06, EVT-02, FAC-12 ; décisions D2 à D8) — SC-03 « Lundi matin »,
// étapes 1 à 5 : Camille ouvre « Aujourd'hui », voit les trois urgences sans défiler, coche une
// tâche par erreur et l'annule, ouvre le cockpit du mariage de référence depuis une alerte, relance
// le prestataire retenu sans contrat. Départ : quatre évènements en cours, onze tâches dues, deux
// échéances du client, une décision en attente. Puis les trois chiffres de l'année (FAC-12). En
// taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import {
  addEventTask,
  addEventVendorSlot,
  addVendorCandidate,
  changeEventStatus,
  createProspect,
  createProspectSource,
  requestDecision,
  updateVendorCandidate,
} from "../modules/events/service";
import { saveOnboardingStep } from "../modules/hub/service";
import { addPaymentMethods, addQuoteLine, addScheduleItem, createQuote, sendQuote, setQuoteAdvanceKind } from "../modules/quotes/service";
import { createVendor } from "../modules/vendors/service";
import { readyOrganization } from "./helpers";

const PASSWORD = "mot-de-passe-de-lundi";

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

// L'atelier de Camille, un lundi matin : Léa et Maxime (J-68, le mariage de référence : une tâche
// en retard, un choix de fleuriste demandé, un photographe retenu sans contrat), Inès et Sacha (J-40,
// leur devis envoyé : un acompte en retard, une échéance dans neuf jours), Chloé et Paul (J-120),
// Emma et Lucas (prospect). Onze tâches dues d'ici quatorze jours, dont trois en retard.
async function lundiMatin() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const wedding = async (first: string, second: string, days: number, confirmed: boolean) => {
      const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: first }, { firstName: second }], eventDate: parisDay(days) });
      if (confirmed) await changeEventStatus({ organizationId, eventId: event.id, changedByUserId: owner.id, toStatus: "confirmed" });
      return event.id;
    };
    const lea = await wedding("Léa", "Maxime", 68, true);
    const ines = await wedding("Inès", "Sacha", 40, true);
    const chloe = await wedding("Chloé", "Paul", 120, true);
    const emma = await wedding("Emma", "Lucas", 200, false);
    const tasks: [string, string, number, "planner" | "clients"][] = [
      [lea, "Faire signer le contrat du photographe", -3, "planner"],
      [lea, "Envoyer le questionnaire", 5, "clients"],
      [lea, "Réserver la navette", 10, "planner"],
      [ines, "Confirmer le traiteur", -1, "planner"],
      [ines, "Valider le plan de table", 0, "planner"],
      [ines, "Choisir les alliances", 7, "clients"],
      [ines, "Préparer la veille", 12, "planner"],
      [chloe, "Relancer la mairie", -5, "planner"],
      [chloe, "Envoyer le devis du DJ", 2, "planner"],
      [chloe, "Réserver l'hôtel", 13, "planner"],
      [emma, "Rappeler Emma", 0, "planner"],
    ];
    for (const [eventId, label, days, responsible] of tasks) await addEventTask(organizationId, eventId, { label, dueDate: parisDay(days), responsible });

    const flowers = await addEventVendorSlot(organizationId, lea, "Fleuriste");
    for (const vendorName of ["Atelier Pivoine", "Jardin d'hiver"]) {
      const candidate = await addVendorCandidate({ organizationId, eventId: lea, vendorSlotId: flowers.id, vendorName });
      await updateVendorCandidate({ organizationId, candidateId: candidate.id, shownToClients: true });
    }
    await requestDecision({ organizationId, eventId: lea, requestedByUserId: owner.id, kind: "option", slotId: flowers.id });
    const { vendor } = await createVendor(organizationId, { name: "Studio Lumière", typeId: null, email: `studio-${randomUUID()}@exemple.test` });
    const photo = await addEventVendorSlot(organizationId, lea, "Photographe");
    const studio = await addVendorCandidate({ organizationId, eventId: lea, vendorSlotId: photo.id, vendorName: "Studio Lumière", vendorId: vendor.id });
    await updateVendorCandidate({ organizationId, candidateId: studio.id, status: "retained", changedByUserId: owner.id });

    await addPaymentMethods(organizationId, ["Virement bancaire"]);
    const quote = await createQuote({ organizationId, eventId: ines, createdByUserId: owner.id });
    await addQuoteLine(organizationId, quote.id, { label: "Organisation complète", unit: "forfait", quantityMilli: 1000, unitPriceCents: 300000 });
    await setQuoteAdvanceKind(organizationId, quote.id, "deposit");
    await addScheduleItem(organizationId, quote.id, { label: "Acompte à la signature", dueDate: parisDay(-2), percentageBasisPoints: 3000 });
    await addScheduleItem(organizationId, quote.id, { label: "Deuxième acompte", dueDate: parisDay(9), percentageBasisPoints: 4000 });
    await sendQuote({ organizationId, quoteId: quote.id });
    return { email, leaId: lea, quoteId: quote.id };
  } finally {
    await sql.end();
  }
}

test("SC-03 / HUB-08 / UX-01 / UX-06 / EVT-02 — lundi matin : les urgences, annuler, le cockpit, la relance", async ({ page }) => {
  const setup = await lundiMatin();
  await login(page, setup.email);

  // Étapes 1 et 2 : « Aujourd'hui » dit par quoi commencer ; les trois urgences tiennent sans défiler,
  // chacune avec son évènement, son échéance et qui doit agir (UX-06).
  await expect(page.getByRole("heading", { level: 1, name: "Aujourd'hui" })).toBeVisible();
  await expect(page.getByText(/4 évènements en cours/)).toBeVisible();
  const first = page.getByRole("region", { name: "À traiter en premier" });
  const items = first.getByRole("listitem");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Relancer la mairie");
  await expect(items.nth(0)).toContainText("Chloé & Paul");
  await expect(items.nth(0)).toContainText("En retard de 5 jours");
  await expect(items.nth(0)).toContainText("Vous");
  await expect(items.nth(1)).toContainText("Faire signer le contrat du photographe");
  await expect(items.nth(2)).toContainText("Acompte à la signature");
  await expect(items.nth(2)).toContainText("Attend le client");
  for (const index of [0, 1, 2]) await expect(items.nth(index)).toBeInViewport();
  const groups = page.getByRole("region", { name: "Ensuite" });
  await expect(groups.getByRole("heading", { name: "En attente d'un tiers" })).toBeVisible();
  await expect(groups).toContainText("Attend Studio Lumière");
  await expect(page.getByRole("region", { name: "Mes évènements" })).toContainText("Léa & Maxime");
  await expectNoAxeViolation(page);

  // Étape 3 (D7) : cochée par erreur, la tâche est faite tout de suite ; « Annuler » la rétablit.
  await items.nth(0).getByRole("button", { name: "Fait : « Relancer la mairie »" }).click();
  const undo = page.getByRole("status").filter({ hasText: "Tâche « Relancer la mairie » faite." });
  await expect(undo).toBeVisible();
  await expect(first).not.toContainText("Relancer la mairie");
  await expectNoAxeViolation(page);
  await undo.getByRole("button", { name: "Annuler" }).click();
  await expect(first.getByRole("listitem").first()).toContainText("Relancer la mairie");

  // Étape 4 : l'alerte du photographe ouvre la synthèse du mariage de référence (EVT-02) : compte à
  // rebours, prochaine action et qui agit, santé de l'évènement.
  await groups.getByRole("link", { name: "Contrat de Studio Lumière (Photographe) à faire signer" }).click();
  await expect(page).toHaveURL(new RegExp(`/events/${setup.leaId}$`));
  await expect(page.getByText("68 jours avant le jour J")).toBeVisible();
  const next = page.getByRole("region", { name: "Prochaine action" });
  await expect(next.getByRole("listitem").first()).toContainText("Faire signer le contrat du photographe");
  await expect(next.getByRole("listitem").first()).toContainText("En retard de 3 jours");
  // Sur un écran de 13 pouces (1 280 × 800), la prochaine action et les deux suivantes sans défiler.
  if (page.viewportSize()!.width >= 1280) {
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const index of [0, 1, 2]) await expect(next.getByRole("listitem").nth(index)).toBeInViewport();
  }
  const health = page.getByRole("region", { name: "Santé de l'évènement" });
  await expect(health).toContainText("0 sur 3 tâches faites");
  await expect(health).toContainText("1 tâche en retard");
  await expect(health).toContainText("1 en attente");
  await expect(page.getByRole("region", { name: "Les 14 prochains jours" })).toContainText("Réserver la navette");
  await expectNoAxeViolation(page);

  // Étape 5 (D6) : relancer le photographe ; la relance s'inscrit dans l'activité de l'évènement.
  await next.getByRole("button", { name: "Relancer Studio Lumière" }).click();
  await expect(next.getByRole("status")).toHaveText("Relance inscrite dans l'activité de l'évènement.");
  await page.reload();
  await expect(page.getByRole("list", { name: "Fil d'activité" })).toContainText("Relance envoyée à Studio Lumière.");
  await expectNoAxeViolation(page);
});

test("FAC-12 — signé, facturé, encaissé sur l'année, en tête de « Devis et factures » et « Encaissements »", async ({ page }) => {
  const setup = await lundiMatin();
  await login(page, setup.email);
  const year = Number(parisDay().slice(0, 4));

  await page.goto("/devis");
  const figures = page.getByRole("region", { name: "Chiffres de l'année" });
  await expect(figures).toContainText("Signé");
  await expect(figures).toContainText("Facturé");
  await expect(figures).toContainText("Encaissé");
  await expect(figures.getByLabel("Année")).toHaveValue(String(year));
  await expectNoAxeViolation(page);

  // L'acompte encaissé compte dans « Encaissé », à la date du paiement.
  await page.goto(`/devis/${setup.quoteId}`);
  await page.getByText("Marquer payée l'échéance « Acompte à la signature »").click();
  const pay = page.getByRole("form", { name: "Marquer payée l'échéance « Acompte à la signature »" });
  await pay.getByLabel("Mode de paiement").selectOption({ label: "Virement bancaire" });
  await pay.getByRole("button", { name: "Marquer payée" }).click();
  await expect(page.getByText(/^Payée le .* \(Virement bancaire\)$/)).toBeVisible();

  await page.goto("/devis/encaissements");
  const collected = page.getByRole("region", { name: "Chiffres de l'année" });
  await expect(collected.getByRole("definition").nth(2)).toHaveText(/^900,00\s€$/);
  await expectNoAxeViolation(page);
  // Une autre année : rien d'encaissé.
  await collected.getByLabel("Année").selectOption(String(year - 1));
  await collected.getByRole("button", { name: "Afficher" }).click();
  await expect(page).toHaveURL(new RegExp(`annee=${year - 1}`));
  await expect(page.getByRole("region", { name: "Chiffres de l'année" }).getByRole("definition").nth(2)).toHaveText(/^0,00\s€$/);
});
