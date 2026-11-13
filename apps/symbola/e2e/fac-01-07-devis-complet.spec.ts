// Lot 31a (FAC-01, FAC-07, JUR-01, JUR-08, JUR-09, HUB-21, HUB-26 ; décisions D2 à D5) — le
// devis complet. SC-02 étapes 3 à 5 : Camille compose un devis type depuis son modèle
// (sections, deux options, acompte), l'envoie ; Léa coche une option sur son portail, le total
// suit ; la planner voit le choix, daté et nominatif. Sans assurance, l'envoi est refusé et
// le champ nommé, avec le lien pour le remplir. Modèles de devis « à adapter ». En taille
// ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { createEventLink, createProspect, createProspectSource } from "../modules/events/service";
import { completeSetup, saveOnboardingStep } from "../modules/hub/service";
import { addQuoteLine, addQuoteSection, addScheduleItem, createQuote, saveQuoteAsTemplate } from "../modules/quotes/service";
import { openEventTab, readyOrganization } from "./helpers";

const PASSWORD = "mot-de-passe-terrain-e2e";

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

// Atelier de Camille, en franchise de TVA ; son devis « Mariage complet » (sections, formule
// complète, deux options, acompte à la signature), modèle si les mentions sont remplies ; le
// mariage de Léa et Maxime.
async function atelier(options: { mentions: boolean }) {
  const { sql, db } = createAppConnection();
  try {
    const organization = options.mentions ? await readyOrganization(db, `Atelier ${randomUUID()}`) : await createOrganization(db, `Atelier ${randomUUID()}`);
    if (!options.mentions) await completeSetup(db, organization.id);
    const organizationId = organization.id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, siren: "123456789", address: "12 rue des Tilleuls, 24200 Sarlat", metier: "wedding_planner" });
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const model = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Modèle" }], eventDate: "2027-06-12" });
    const draft = await createQuote({ organizationId, eventId: model.id, createdByUserId: owner.id });
    let detail = await addQuoteSection(organizationId, draft.id, "Formule complète");
    detail = await addQuoteSection(organizationId, draft.id, "Options");
    const [formula, extras] = detail.current.sections;
    await addQuoteLine(organizationId, draft.id, { label: "Organisation complète", unit: "forfait", quantityMilli: 1000, unitPriceCents: 420000, sectionId: formula!.id });
    await addQuoteLine(organizationId, draft.id, { label: "Coordination de la répétition", unit: "forfait", quantityMilli: 1000, unitPriceCents: 60000, sectionId: extras!.id, isOption: true });
    await addQuoteLine(organizationId, draft.id, { label: "Brunch du lendemain", unit: "forfait", quantityMilli: 1000, unitPriceCents: 80000, sectionId: extras!.id, isOption: true });
    await addScheduleItem(organizationId, draft.id, { label: "À la signature", percentageBasisPoints: 3000, dueDate: "2026-11-20" });
    if (options.mentions) await saveQuoteAsTemplate({ organizationId, quoteId: draft.id, name: "Mariage complet", eventTypeId: null });
    const wedding = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], eventDate: "2027-06-12" });
    return { organizationId, ownerId: owner.id, email, eventId: wedding.id, draftId: draft.id };
  } finally {
    await sql.end();
  }
}

test("FAC-01 / HUB-21 / SC-02 étapes 3 à 5 — devis type depuis un modèle, envoyé ; Léa coche une option sur son portail ; le total suit", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const setup = await atelier({ mentions: true });
  await login(page, setup.email);
  const started = Date.now();

  // Étape 3 : depuis la fiche, le devis part du modèle (sections, options, acompte).
  await page.goto(`/events/${setup.eventId}`);
  await openEventTab(page, "Devis");
  await page.getByLabel("Partir d'un modèle").selectOption({ label: "Mariage complet" });
  await page.getByRole("button", { name: "Créer un devis" }).click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);
  const lines = page.getByRole("region", { name: "Lignes de la version 1" });
  await expect(lines).toContainText("Formule complète");
  await expect(lines).toContainText("Sous-total Formule complète");
  await expect(lines.getByRole("rowheader", { name: /^Brunch du lendemain Option : non retenue, hors du total/ })).toBeVisible();
  await expect(page.getByText("Créé depuis un modèle (version 1).")).toBeVisible();
  await expect(page.getByLabel("Acompte ou arrhes")).toHaveValue("deposit");
  await expectNoAxeViolation(page);

  // Étape 4 : envoi.
  await page.getByRole("button", { name: "Marquer comme envoyé" }).click();
  await expect(page.getByText("Devis envoyé : cette version est figée.").first()).toBeVisible();
  expect(Date.now() - started).toBeLessThan(5 * 60_000);

  // Étape 5 : Léa ouvre son portail, coche le brunch ; le total suit.
  const { sql } = createAppConnection();
  let url: string;
  try {
    url = (
      await createEventLink({
        organizationId: setup.organizationId,
        eventId: setup.eventId,
        createdByUserId: setup.ownerId,
        audience: "client",
        locale: "fr",
        link: { personName: "Léa Martin", email: `lea-${randomUUID()}@symbola.test`, rights: { rubrics: ["quotes"], budgetScope: "all", sharedSlotIds: [] } },
      })
    ).url;
  } finally {
    await sql.end();
  }
  const leaContext = await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() });
  const lea = await leaContext.newPage();
  await lea.goto(url);
  await expect(lea).toHaveURL(/\/portail$/);
  const options = lea.getByRole("region", { name: "Vos options" });
  await expect(options).toContainText("Total avec vos options : 4 200,00 €");
  await expect(options).toContainText("Sommes versées d'avance : des acomptes.");
  await options.getByLabel(/^Brunch du lendemain/).check();
  await options.getByRole("button", { name: "Enregistrer mon choix" }).click();
  await expect(options.getByRole("status")).toHaveText("Votre choix est enregistré.");
  await expect(options).toContainText("Total avec vos options : 5 000,00 €");
  await expect(options).toContainText("Choisies par Léa Martin");
  await expectNoAxeViolation(lea);
  await leaContext.close();

  // La planner voit le choix, daté et nominatif ; le total du devis a suivi.
  await page.reload();
  await expect(page.getByRole("region", { name: "Choix des options" })).toContainText("Choisies par Léa Martin sur son portail");
  await expect(lines.getByRole("rowheader", { name: /^Brunch du lendemain Option : choisie/ })).toBeVisible();
  await expect(lines).toContainText("5 000,00 €");
});

test("FAC-07 / JUR-09 / JUR-08 — sans assurance ni médiateur, l'envoi est refusé et chaque champ est nommé ; une fois remplis, il part", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelier({ mentions: false });
  await login(page, setup.email);
  await page.goto(`/devis/${setup.draftId}`);
  const panel = page.getByRole("note").filter({ hasText: "Avant l'envoi, il manque :" });
  await expect(panel).toContainText("Assurance de responsabilité civile professionnelle (assureur et contrat)");
  await expect(panel).toContainText("Médiateur de la consommation (nom et site)");
  await expect(panel).toContainText("Conditions générales de vente");
  await expect(panel).toContainText("Acompte ou arrhes, sur ce devis");
  await page.getByRole("button", { name: "Marquer comme envoyé" }).click();
  const refusal = page.getByRole("form", { name: "Marquer comme envoyé" });
  await expect(refusal.getByRole("alert")).toHaveText("Mentions requises manquantes : remplissez-les, puis recommencez.");
  await expect(refusal.getByRole("link", { name: "Assurance de responsabilité civile professionnelle (assureur et contrat)" })).toHaveAttribute("href", "/parametres#informations-professionnel");
  await expectNoAxeViolation(page);

  // Arrhes sur ce devis, puis les informations du professionnel.
  const advance = page.getByRole("form", { name: "Sommes versées d'avance" });
  await advance.getByLabel("Acompte ou arrhes").selectOption("earnest");
  await advance.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(advance.getByRole("status")).toHaveText("Enregistré.");
  await refusal.getByRole("link", { name: "Assurance de responsabilité civile professionnelle (assureur et contrat)" }).click();
  await expect(page).toHaveURL(/\/parametres#informations-professionnel$/);
  const form = page.getByRole("form", { name: "Informations du professionnel" });
  await form.getByLabel("Assureur (responsabilité civile professionnelle)").fill("Assurances du Périgord");
  await form.getByLabel("Numéro de contrat").fill("RCP-2027-001");
  await form.getByLabel("Médiateur de la consommation").fill("Médiateur de la consommation des services");
  await form.getByLabel("Site du médiateur").fill("mediateur.example");
  await form.getByLabel("Conditions générales de vente").fill("Conditions générales de vente de l'atelier (à faire relire).");
  await form.getByRole("button", { name: "Enregistrer les informations" }).click();
  await expect(form.getByRole("status")).toHaveText("Informations enregistrées.");
  await expectNoAxeViolation(page);

  await page.goto(`/devis/${setup.draftId}`);
  await expect(page.getByRole("note").filter({ hasText: "Avant l'envoi, il manque :" })).toHaveCount(0);
  await page.getByRole("button", { name: "Marquer comme envoyé" }).click();
  await expect(page.getByText("Devis envoyé : cette version est figée.").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Sommes versées d'avance" })).toContainText("Arrhes");
});

test("HUB-21 / HUB-26 — modèles de devis : modèle de départ « à adapter », avertissement, dupliquer, renommer, supprimer", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelier({ mentions: true });
  await login(page, setup.email);
  await page.goto("/devis/modeles");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Modèles de devis");
  await expect(page.getByRole("note").filter({ hasText: "Modèles à adapter" })).toBeVisible();
  await page.getByRole("button", { name: "Ajouter le modèle de départ" }).click();
  const list = page.getByRole("list", { name: "Modèles de devis" });
  const starter = list.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Mariage — organisation complète (à adapter)", exact: true }) });
  await expect(starter).toContainText("3 sections, 5 lignes dont 2 options, 2 échéances");
  await expectNoAxeViolation(page);

  await starter.getByRole("button", { name: "Dupliquer le modèle Mariage — organisation complète (à adapter)" }).click();
  const copy = list.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Mariage — organisation complète (à adapter) (copie)" }) });
  await expect(copy).toBeVisible();
  await copy.getByText(/^Renommer le modèle/).click();
  await copy.getByLabel("Nom du modèle").fill("Mariage intime");
  await copy.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(list.getByRole("heading", { name: "Mariage intime" })).toBeVisible();
  await list.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Mariage intime" }) }).getByRole("button", { name: "Supprimer le modèle Mariage intime" }).click();
  await expect(list.getByRole("heading", { name: "Mariage intime" })).toHaveCount(0);
});
