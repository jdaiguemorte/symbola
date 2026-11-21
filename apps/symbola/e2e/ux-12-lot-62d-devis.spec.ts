// Lot 62d (UX-12, UX-13, UX-05, NFR-19) — le devis en rubriques : l'écran s'ouvre sur les lignes et
// les totaux ; la page de proposition, le paiement et l'acompte, l'acheteur et la livraison, les
// honoraires et commissions, le contrat et la signature, les factures et avoirs sont des onglets, chacun
// à son adresse (`?rubrique=`) ; un encart résume l'état de chaque rubrique et y mène ; un seul bouton
// principal, celui de la prochaine action selon le statut. Rien de ce qui engage n'est caché : chaque
// information d'un devis envoyé ou signé reste atteignable. Modèles de contrat et relances : formulaires
// en grille. En taille ordinateur (1440 px) et en 375 px, axe-core sur chaque écran.
// Avec MESURES_DIR, les mesures et les captures de chaque écran sont écrites dans ce dossier.
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { createProspect, createProspectSource } from "../modules/events/service";
import { saveOnboardingStep } from "../modules/hub/service";
import {
  actOnFakeSignature,
  addPaymentMethods,
  addQuoteLine,
  addQuoteSection,
  addScheduleItem,
  addStarterContractTemplates,
  createCatalogItem,
  createQuote,
  issueCreditNote,
  issueDepositInvoice,
  markScheduleItemPaid,
  reviseQuote,
  sendQuote,
  sendQuoteForSignature,
} from "../modules/quotes/service";
import { minimalPdf } from "../lib/test-fixtures/pdf";
import { readyOrganization, signIn } from "./helpers";
import { measureScreen, openQuoteForm, openQuoteRubric, QUOTE_RUBRICS, quoteRubricNav, type QuoteRubric, type ScreenMeasure } from "./devis-rubriques";

const MESURES_DIR = process.env.MESURES_DIR ?? "";
const PDF = minimalPdf("devis");

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

function parisDay(offset: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const value = new Date(`${today}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

// L'atelier de Camille, en franchise de TVA, et trois mariages : un devis en brouillon (sections,
// options, acompte), un devis envoyé en version 2 (la version 1 reste consultable), un devis signé
// (acompte facturé, un avoir, acompte encaissé).
async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, siren: "123456789", address: "12 rue des Tilleuls, 24200 Sarlat", metier: "wedding_planner" });
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-e2e-62d", role: "owner" });
    const [method] = await addPaymentMethods(organizationId, ["Virement bancaire"]);
    await createCatalogItem(organizationId, { label: "Coordination du jour J", unit: "forfait", unitPriceCents: 120000, vatRateBasisPoints: 0, category: "Prestations" });
    await addStarterContractTemplates(organizationId, "fr", "wedding_planner");
    const source = await createProspectSource(organizationId, "Salon");
    const compose = async (first: string, second: string) => {
      const event = await createProspect({
        organizationId,
        createdByUserId: owner.id,
        prospectSourceId: source.id,
        clients: [
          { firstName: first, lastName: "Martin" },
          { firstName: second, lastName: "Durand" },
        ],
        eventDate: "2027-06-12",
      });
      const quote = await createQuote({ organizationId, eventId: event.id, createdByUserId: owner.id });
      await addQuoteSection(organizationId, quote.id, "Formule complète");
      const detail = await addQuoteSection(organizationId, quote.id, "Options");
      const [formula, extras] = detail.current.sections;
      await addQuoteLine(organizationId, quote.id, { label: "Organisation complète", unit: "forfait", quantityMilli: 1000, unitPriceCents: 420000, sectionId: formula!.id });
      await addQuoteLine(organizationId, quote.id, { label: "Coordination de la répétition", unit: "forfait", quantityMilli: 1000, unitPriceCents: 60000, sectionId: extras!.id, isOption: true });
      await addQuoteLine(organizationId, quote.id, { label: "Brunch du lendemain", unit: "forfait", quantityMilli: 1000, unitPriceCents: 80000, sectionId: extras!.id, isOption: true });
      await addScheduleItem(organizationId, quote.id, { label: "Acompte à la signature", percentageBasisPoints: 3000, dueDate: parisDay(10) });
      return { eventId: event.id, quoteId: quote.id, number: quote.number };
    };
    const draft = await compose("Léa", "Maxime");

    const sent = await compose("Inès", "Hugo");
    await sendQuote({ organizationId, quoteId: sent.quoteId });
    await reviseQuote(organizationId, sent.quoteId);
    await sendQuote({ organizationId, quoteId: sent.quoteId });

    const signed = await compose("Chloé", "Adrien");
    await sendQuote({ organizationId, quoteId: signed.quoteId });
    const signing = await sendQuoteForSignature({
      organizationId,
      quoteId: signed.quoteId,
      signers: [{ name: "Chloé Martin", email: `chloe-${randomUUID()}@symbola.test`, billingAddress: "4 rue des Lilas, 60300 Senlis" }],
      documentPdf: PDF,
      locale: "fr",
    });
    for (const signer of signing.signature!.signers) await actOnFakeSignature(signer.signingUrl.split("/").pop()!, "sign");
    const itemId = signing.current.schedule.items[0]!.id;
    const invoice = await issueDepositInvoice({ organizationId, scheduleItemId: itemId, renderOriginal: async () => PDF });
    await issueCreditNote({ organizationId, invoiceId: invoice.id, amountCents: 10000, reason: "Geste commercial", renderOriginal: async () => PDF });
    await markScheduleItemPaid({ organizationId, scheduleItemId: itemId, paidOn: parisDay(0), paymentMethodId: method!.id });
    return { email, organizationId, draft, sent, signed };
  } finally {
    await sql.end();
  }
}

// La taille « ordinateur » des critères du lot 62 est 1440 × 900 (celle de l'outil de relevé).
async function useMeasuredViewport(page: Page): Promise<"1440" | "375"> {
  if ((page.viewportSize()?.width ?? 0) > 600) {
    await page.setViewportSize({ width: 1440, height: 900 });
    return "1440";
  }
  return "375";
}

const measures: Record<string, ScreenMeasure> = {};

async function record(page: Page, name: string, width: "1440" | "375"): Promise<ScreenMeasure> {
  const measure = await measureScreen(page);
  measures[`${name}--${width}`] = measure;
  if (MESURES_DIR !== "") {
    mkdirSync(MESURES_DIR, { recursive: true });
    await page.screenshot({ path: join(MESURES_DIR, `${name}--${width}.jpg`), fullPage: true, type: "jpeg", quality: 60 });
    writeFileSync(join(MESURES_DIR, `mesures--${width}.json`), JSON.stringify(measures, null, 1));
  }
  return measure;
}

// Critères communs du lot 62 pour un écran repris.
function expectCommonCriteria(measure: ScreenMeasure, name: string, width: "1440" | "375", maxScreens = 3) {
  expect.soft(measure.primary, `${name} : un seul bouton principal (${measure.primaryLabels.join(", ")})`).toBeLessThanOrEqual(1);
  expect.soft(measure.wideShortFields, `${name} : aucun nombre ni date de plus de 260 px`).toBe(0);
  if (width === "1440") {
    expect.soft(measure.screens, `${name} : ${maxScreens} écrans au plus en 1440 px`).toBeLessThanOrEqual(maxScreens);
    expect.soft(measure.stackedRun, `${name} : pas six champs empilés sur un même bord`).toBeLessThan(6);
  } else {
    expect.soft(measure.overflowX, `${name} : aucun débordement horizontal en 375 px`).toBeLessThanOrEqual(0);
    expect.soft(measure.smallTargets, `${name} : aucune cible de moins de 44 px`).toEqual([]);
  }
}

test.describe("UX-12 — Le devis en rubriques (lot 62d)", () => {
  test("l'écran s'ouvre sur les lignes et les totaux ; chaque rubrique est un onglet à son adresse, l'onglet affiché marqué", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await atelier();
    await signIn(page, setup.email, /\/$/);
    await page.goto(`/devis/${setup.draft.quoteId}`);

    // Les lignes et les totaux d'abord.
    const tabs = quoteRubricNav(page);
    await expect(tabs.getByRole("link", { name: "Lignes et totaux", exact: true })).toHaveAttribute("aria-current", "page");
    const lines = page.getByRole("table", { name: "Lignes de la version 1" });
    await expect(lines.getByRole("rowheader", { name: /^Organisation complète/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Totaux" })).toContainText("4 200,00 €");
    await expect(page.getByRole("region", { name: "Échéancier" })).toHaveCount(0);
    // Les lignes précèdent tout formulaire de l'écran.
    const firstField = page.locator("main").locator("input:not([type=hidden]), select, textarea").first();
    if ((await firstField.count()) > 0) {
      const [tableBox, fieldBox] = await Promise.all([lines.boundingBox(), firstField.boundingBox()]);
      expect(tableBox!.y).toBeLessThan(fieldBox!.y);
    }
    await expectNoAxeViolation(page);

    // Chaque rubrique a son onglet et son adresse ; un brouillon n'a pas encore de factures.
    await expect(tabs.getByRole("link")).toHaveText(["Lignes et totaux", "Page de proposition", "Paiement et acompte", "Acheteur et livraison", "Honoraires et commissions", "Contrat et signature"]);
    const landmarks: Record<Exclude<QuoteRubric, "lignes" | "factures">, string> = {
      proposition: "Page de proposition",
      paiement: "Échéancier",
      acheteur: "Acheteur, bon de commande et livraison",
      honoraires: "Vos honoraires, vos commissions et vos modes",
      contrat: "Signature en ligne",
    };
    for (const [rubric, region] of Object.entries(landmarks) as [QuoteRubric, string][]) {
      await openQuoteRubric(page, rubric);
      await expect(page).toHaveURL(new RegExp(`/devis/${setup.draft.quoteId}\\?rubrique=${rubric}$`));
      await expect(page.getByRole("region", { name: region, exact: true })).toBeVisible();
      await expect(page.getByRole("table", { name: "Lignes de la version 1" })).toHaveCount(0);
      await expect(tabs.locator('[aria-current="page"]')).toHaveText(QUOTE_RUBRICS[rubric]);
      await expectNoAxeViolation(page);
    }
    // L'adresse d'une rubrique s'ouvre directement ; une rubrique inconnue ramène aux lignes.
    await page.goto(`/devis/${setup.draft.quoteId}?rubrique=paiement`);
    await expect(page.getByRole("region", { name: "Sommes versées d'avance" })).toBeVisible();
    await page.goto(`/devis/${setup.draft.quoteId}?rubrique=inconnue`);
    await expect(page.getByRole("table", { name: "Lignes de la version 1" })).toBeVisible();
    // Une ancre d'avant le lot (« Aujourd'hui », vérifications) mène à sa rubrique.
    await page.goto(`/devis/${setup.draft.quoteId}#echeancier`);
    await expect(page).toHaveURL(new RegExp(`\\?rubrique=paiement#echeancier$`));
    await expect(page.getByRole("region", { name: "Échéancier" })).toBeVisible();
  });

  test("brouillon : les lignes se composent en place (une ligne ouverte à la fois), l'encart « Avant d'envoyer » résume chaque rubrique et y mène", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await atelier();
    await signIn(page, setup.email, /\/$/);
    await page.goto(`/devis/${setup.draft.quoteId}`);
    await page.waitForLoadState("networkidle");

    // Une ligne s'ouvre en place ; en ouvrir une autre ferme la première.
    const lines = page.getByRole("table", { name: "Lignes de la version 1" });
    await page.getByRole("button", { name: "Modifier la ligne « Organisation complète »" }).click();
    const edit = page.getByRole("form", { name: "Modifier la ligne « Organisation complète »" });
    await expect(edit).toBeVisible();
    await page.getByRole("button", { name: "Modifier la ligne « Brunch du lendemain »" }).click();
    await expect(edit).toHaveCount(0);
    const brunch = page.getByRole("form", { name: "Modifier la ligne « Brunch du lendemain »" });
    await brunch.getByLabel("Prix unitaire HT (€)").fill("900");
    await brunch.getByRole("button", { name: "Enregistrer la ligne" }).click();
    await expect(lines.getByRole("row", { name: /Brunch du lendemain/ })).toContainText("900,00 €");
    await expectNoAxeViolation(page);

    // Ajouter depuis le catalogue, puis une ligne libre : un formulaire ouvert à la fois, sous le tableau.
    const fromCatalog = await openQuoteForm(page, "Ajouter un article du catalogue");
    await fromCatalog.getByLabel("Article").selectOption({ label: "Prestations — Coordination du jour J" });
    await fromCatalog.getByRole("button", { name: "Ajouter la ligne" }).click();
    await expect(lines.getByRole("rowheader", { name: /^Coordination du jour J/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Totaux" })).toContainText("5 400,00 €");
    const freeLine = await openQuoteForm(page, "Ajouter une ligne libre");
    await expect(fromCatalog).toHaveCount(0);
    await freeLine.getByLabel("Intitulé").fill("Déplacement");
    await freeLine.getByLabel("Unité").fill("forfait");
    await freeLine.getByLabel("Prix unitaire HT (€)").fill("200");
    await freeLine.getByRole("button", { name: "Ajouter la ligne" }).click();
    await expect(lines.getByRole("rowheader", { name: /^Déplacement/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Totaux" })).toContainText("5 600,00 €");
    await page.getByRole("button", { name: "Retirer la ligne « Déplacement »" }).click();
    await expect(lines.getByRole("rowheader", { name: /^Déplacement/ })).toHaveCount(0);
    await expectNoAxeViolation(page);

    // L'encart résume l'état de chaque rubrique, et y mène.
    const summary = page.getByRole("region", { name: "Avant d'envoyer" });
    await expect(summary.getByRole("link")).toHaveCount(5);
    await expect(summary.getByRole("link", { name: /^Page de proposition/ })).toContainText("Mot d'accueil du modèle");
    await expect(summary.getByRole("link", { name: /^Paiement et acompte/ })).toContainText("Acompte, 1 échéance");
    await expect(summary.getByRole("link", { name: /^Acheteur et livraison/ })).toContainText("Client particulier");
    await expect(summary.getByRole("link", { name: /^Honoraires et commissions/ })).toContainText("Aucune commission");
    await expect(summary.getByRole("link", { name: /^Contrat et signature/ })).toContainText("après l'envoi du devis");
    await summary.getByRole("link", { name: /^Paiement et acompte/ }).click();
    await expect(page).toHaveURL(/\?rubrique=paiement$/);
    await expect(quoteRubricNav(page).locator('[aria-current="page"]')).toHaveText("Paiement et acompte");

    // L'état suit : des arrhes à la place de l'acompte.
    const advance = page.getByRole("form", { name: "Sommes versées d'avance" });
    await advance.getByLabel("Acompte ou arrhes").selectOption("earnest");
    await advance.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(advance.getByRole("status")).toHaveText("Enregistré.");
    await openQuoteRubric(page, "lignes");
    await expect(page.getByRole("region", { name: "Avant d'envoyer" }).getByRole("link", { name: /^Paiement et acompte/ })).toContainText("Arrhes, 1 échéance");
  });

  test("un seul bouton principal, celui de la prochaine action : envoyer, puis faire signer, puis facturer", async ({ page }) => {
    test.setTimeout(180_000);
    const setup = await atelier();
    await signIn(page, setup.email, /\/$/);
    const primaryLabels = async () => (await measureScreen(page)).primaryLabels;

    // Brouillon : « Envoyer le devis », sur chaque rubrique.
    for (const rubric of ["lignes", "proposition", "paiement", "acheteur", "honoraires", "contrat"] as const) {
      await page.goto(`/devis/${setup.draft.quoteId}?rubrique=${rubric}`);
      expect(await primaryLabels(), `brouillon, ${rubric}`).toEqual(["Envoyer le devis"]);
    }
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Devis envoyé : cette version est figée." })).toBeVisible();

    // Envoyé : « Faire signer » mène à la signature, dont l'envoi devient le bouton principal.
    await expect(page.getByText(/^Envoyé — version 1/)).toBeVisible();
    expect(await primaryLabels()).toEqual(["Faire signer"]);
    await page.getByRole("link", { name: "Faire signer" }).click();
    await expect(page).toHaveURL(/\?rubrique=contrat#signature$/);
    expect(await primaryLabels()).toEqual(["Envoyer en signature"]);
    await expectNoAxeViolation(page);

    // Signé : « Facturer » mène aux factures ; la prochaine pièce à émettre est le bouton principal.
    await page.goto(`/devis/${setup.signed.quoteId}`);
    await expect(page.getByText(/^Signé — version 1/)).toBeVisible();
    expect(await primaryLabels()).toEqual(["Facturer"]);
    await page.getByRole("link", { name: "Facturer" }).click();
    await expect(page).toHaveURL(/\?rubrique=factures$/);
    expect(await primaryLabels()).toEqual(["Émettre la facture de solde"]);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Émettre la facture de solde" }).click();
    await expect(page.getByText(/^F-\d{4}-0002 — Facture de solde/)).toBeVisible();
    // Tout est facturé : plus de prochaine action, plus de bouton principal.
    expect(await primaryLabels()).toEqual([]);
    await expectNoAxeViolation(page);
  });

  test("rien de ce qui engage n'est caché : devis envoyé puis signé, chaque information et chaque action reste atteignable", async ({ page }) => {
    test.setTimeout(180_000);
    const setup = await atelier();
    await signIn(page, setup.email, /\/$/);

    // Devis envoyé (version 2) : l'encart de suivi dit l'état de chaque rubrique.
    await page.goto(`/devis/${setup.sent.quoteId}`);
    await expect(page.getByRole("status").filter({ hasText: "Devis envoyé : cette version est figée." })).toBeVisible();
    await expect(page.getByText(/^Valable jusqu'au/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Télécharger le PDF (version 2)" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir la proposition comme le client" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Choix des options" })).toContainText("Aucune option choisie pour l'instant");
    await expect(page.getByRole("heading", { name: "Versions précédentes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Télécharger le PDF (version 1)" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Créer une nouvelle version" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Enregistrer comme modèle" })).toHaveCount(0);
    await openQuoteForm(page, "Enregistrer comme modèle");
    const follow = page.getByRole("region", { name: "Suivi du devis" });
    await expect(follow.getByRole("link", { name: /^Paiement et acompte/ })).toContainText("1 échéance, aucune encaissée");
    await expect(follow.getByRole("link", { name: /^Contrat et signature/ })).toContainText("Aucun contrat généré, pas encore envoyé en signature");
    await expectNoAxeViolation(page);

    await openQuoteRubric(page, "proposition");
    await expect(page.getByRole("form", { name: "Prévenir le client par e-mail" })).toBeVisible();
    await expect(page.getByText("Prolonger la validité")).toBeVisible();
    await openQuoteRubric(page, "paiement");
    await expect(page.getByRole("region", { name: "Sommes versées d'avance" })).toContainText("Acompte");
    await expect(page.getByRole("region", { name: "Échéancier" })).toContainText("Acompte à la signature");
    await expect(page.getByText("Marquer payée l'échéance « Acompte à la signature »")).toBeVisible();
    await expect(page.getByRole("region", { name: "Règlement par virement" })).toContainText("Acompte à la signature");
    await openQuoteRubric(page, "contrat");
    await expect(page.getByRole("region", { name: "Contrat", exact: true })).toContainText("Base à adapter, à faire relire par un professionnel du droit.");
    await expect(page.getByRole("form", { name: "Type de client" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Vérifications avant l'envoi du devis" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Envoyer en signature" })).toBeVisible();
    await expectNoAxeViolation(page);

    // Devis signé : signature, échéancier encaissé, facture, avoir.
    await page.goto(`/devis/${setup.signed.quoteId}`);
    const signedFollow = page.getByRole("region", { name: "Suivi du devis" });
    await expect(signedFollow.getByRole("link", { name: /^Paiement et acompte/ })).toContainText("1 échéance, 1 encaissée");
    await expect(signedFollow.getByRole("link", { name: /^Contrat et signature/ })).toContainText("signé par tous les signataires");
    await expect(signedFollow.getByRole("link", { name: /^Factures et avoirs/ })).toContainText("1 facture, 1 avoir");
    await expect(page.getByRole("form", { name: "Créer une nouvelle version" })).toHaveCount(0);
    await signedFollow.getByRole("link", { name: /^Contrat et signature/ }).click();
    const signature = page.getByRole("region", { name: "Signature en ligne" });
    await expect(signature).toContainText("Devis signé par tous les signataires.");
    await expect(signature).toContainText("Chloé Martin");
    await expect(signature.getByRole("link", { name: "Télécharger le devis signé" })).toBeVisible();
    await expect(signature.getByRole("link", { name: "Télécharger le certificat de preuve" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Contrat", exact: true })).toBeVisible();
    await expectNoAxeViolation(page);
    await openQuoteRubric(page, "paiement");
    await expect(page.getByRole("region", { name: "Échéancier" }).getByText(/^Payée le .* \(Virement bancaire\)$/)).toBeVisible();
    await expect(page.getByRole("form", { name: "Annuler le paiement de « Acompte à la signature »" })).toBeVisible();
    await openQuoteRubric(page, "factures");
    const invoices = page.getByRole("region", { name: "Factures" });
    await expect(invoices.getByText(/^F-\d{4}-0001 — Facture d'acompte \(Acompte à la signature\)/)).toContainText("dont 100,00 € annulés par avoir");
    await expect(invoices.getByText(/^A-\d{4}-0001 — .* — Geste commercial/)).toBeVisible();
    await expect(invoices.getByRole("link", { name: /^PDF de la facture F-\d{4}-0001$/ })).toBeVisible();
    await expect(invoices.getByRole("link", { name: /^PDF de l'avoir A-\d{4}-0001$/ })).toBeVisible();
    await expect(invoices.getByText(/^Établir un avoir sur la facture F-\d{4}-0001$/)).toBeVisible();
    await expect(invoices.getByRole("form", { name: "Type de client" })).toBeVisible();
    await expect(invoices.getByRole("button", { name: "Émettre la facture de solde" })).toBeVisible();
    await expectNoAxeViolation(page);
    await openQuoteRubric(page, "acheteur");
    await expect(page.getByRole("form", { name: "Acheteur, bon de commande et livraison" })).toBeVisible();
    await openQuoteRubric(page, "honoraires");
    await expect(page.getByRole("region", { name: "Vos honoraires, vos commissions et vos modes" })).toContainText("Aucune commission tracée pour cet évènement.");
  });

  test("mesures — critères communs sur chaque rubrique, en brouillon, envoyé et signé", async ({ page }) => {
    test.setTimeout(300_000);
    const setup = await atelier();
    await signIn(page, setup.email, /\/$/);
    const width = await useMeasuredViewport(page);
    const rubrics: Record<"draft" | "sent" | "signed", QuoteRubric[]> = {
      draft: ["lignes", "proposition", "paiement", "acheteur", "honoraires", "contrat"],
      sent: ["lignes", "proposition", "paiement", "acheteur", "honoraires", "contrat"],
      signed: ["lignes", "proposition", "paiement", "acheteur", "honoraires", "contrat", "factures"],
    };
    const names = { draft: "brouillon", sent: "envoye", signed: "signe" } as const;
    for (const status of ["draft", "sent", "signed"] as const) {
      for (const rubric of rubrics[status]) {
        await page.goto(`/devis/${setup[status].quoteId}${rubric === "lignes" ? "" : `?rubrique=${rubric}`}`, { waitUntil: "networkidle" });
        const name = `devis-${names[status]}-${rubric}`;
        expectCommonCriteria(await record(page, name, width), name, width);
        const axe = await new AxeBuilder({ page }).analyze();
        expect.soft(axe.violations, `${name} : ${JSON.stringify(axe.violations.map((violation) => violation.id))}`).toEqual([]);
      }
    }
    // Brouillon, formulaires ouverts : la ligne en cours de modification et l'ajout d'une ligne libre.
    await page.goto(`/devis/${setup.draft.quoteId}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Modifier la ligne « Organisation complète »" }).click();
    await openQuoteForm(page, "Ajouter une ligne libre");
    expectCommonCriteria(await record(page, "devis-brouillon-lignes-ouvertes", width), "devis-brouillon-lignes-ouvertes", width);
  });
});

test.describe("UX-12 — Modèles de contrat et relances en grille (lot 62d)", () => {
  test("mesures — création d'un modèle de contrat, modèle ouvert, relances : formulaires en grille, champs courts", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await atelier();
    await signIn(page, setup.email, /\/$/);
    const width = await useMeasuredViewport(page);

    await page.goto("/devis/modeles-contrat", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Modèles de contrat");
    const create = page.getByRole("form", { name: "Créer un modèle" });
    await expect(create.getByLabel("Date de la dernière revue juridique")).toBeVisible();
    expectCommonCriteria(await record(page, "modeles-contrat", width), "modeles-contrat", width);
    await expectNoAxeViolation(page);
    if (width === "1440") {
      // En grille : le nom et le titre côte à côte.
      const [name, title] = await Promise.all([create.getByLabel("Nom du modèle").boundingBox(), create.getByLabel("Titre du contrat").boundingBox()]);
      expect(Math.abs(name!.y - title!.y)).toBeLessThan(4);
      expect(title!.x).toBeGreaterThan(name!.x + name!.width);
    }
    // Le modèle se crée toujours, et s'ouvre.
    await create.getByLabel("Nom du modèle").fill("Séminaire d'entreprise");
    await create.getByRole("button", { name: "Créer un modèle" }).click();
    await expect(page).toHaveURL(/\/devis\/modeles-contrat\/[0-9a-f-]{36}$/);
    await page.waitForLoadState("networkidle");
    expectCommonCriteria(await record(page, "modele-contrat-ouvert", width), "modele-contrat-ouvert", width);
    await expectNoAxeViolation(page);

    await page.goto("/devis/relances", { waitUntil: "networkidle" });
    const reminders = page.getByRole("form", { name: "Réglages des relances" });
    expectCommonCriteria(await record(page, "relances", width), "relances", width);
    const days = await reminders.getByLabel("Relance avant l'expiration d'une proposition (jours avant)").boundingBox();
    expect(days!.width).toBeLessThanOrEqual(260);
    await expectNoAxeViolation(page);
    // Les réglages s'enregistrent toujours.
    await reminders.getByLabel("Relance avant l'expiration d'une proposition (jours avant)").fill("5");
    await reminders.getByLabel("Relances d'une échéance impayée (jours après l'échéance)").fill("3, 10");
    await reminders.getByRole("button", { name: "Enregistrer les réglages" }).click();
    await expect(reminders.getByRole("status")).toHaveText("Réglages enregistrés.");
    await page.reload();
    await expect(page.getByLabel("Relance avant l'expiration d'une proposition (jours avant)")).toHaveValue("5");
  });
});
