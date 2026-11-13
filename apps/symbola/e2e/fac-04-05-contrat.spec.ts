// Lot 31b (FAC-04, FAC-05, DOC-02, DOC-03, JUR-07, JUR-20 ; décisions D6, D7, D9, D11 à D13) —
// le contrat et la signature. SC-02 étapes 4 à 7 : Camille génère le contrat du devis envoyé ;
// un lieu vide et une clause encore à rédiger sont signalés, puis comblés ; à distance, il manque
// l'information légale tant que ses clauses ne sont pas cochées. Le devis et son contrat partent
// ensemble ; Léa et Maxime lisent le contrat, commandent sur leur espace, demandent l'exécution
// anticipée, puis signent. La facture d'acompte existe sans autre saisie, le dossier de preuve
// se télécharge. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { createEventLink, createProspect, createProspectSource, getEvent } from "../modules/events/service";
import { saveOnboardingStep } from "../modules/hub/service";
import { addQuoteLine, addScheduleItem, addStarterContractTemplates, createQuote, sendQuote, updateContractClause } from "../modules/quotes/service";
import { readyOrganization } from "./helpers";

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

function parisDay(offsetDays = 0): string {
  const day = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
}

// Atelier de Camille (mentions remplies), le mariage de Léa et Maxime sans lieu, leur devis envoyé
// (acompte de 30 % dans dix jours), le modèle de contrat de départ dont les textes sont rédigés,
// sauf « Annulation et report » ; un lien personnel pour chacun des mariés.
async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const wedding = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Durand" }], eventDate: "2027-06-12" });
    const quote = await createQuote({ organizationId, eventId: wedding.id, createdByUserId: owner.id });
    await addQuoteLine(organizationId, quote.id, { label: "Organisation complète", unit: "forfait", quantityMilli: 1000, unitPriceCents: 420000 });
    await addScheduleItem(organizationId, quote.id, { label: "À la signature", percentageBasisPoints: 3000, dueDate: parisDay(10) });
    const sent = await sendQuote({ organizationId, quoteId: quote.id });
    const [template] = await addStarterContractTemplates(organizationId, "fr");
    for (const clause of template!.clauses) {
      if (clause.body.includes("[À rédiger") && clause.title !== "Annulation et report") {
        await updateContractClause(organizationId, clause.id, { title: clause.title, body: `Texte de « ${clause.title} » relu par le conseil de l'atelier (fictif).`, optional: clause.optional, role: clause.role });
      }
    }
    const event = await getEvent(organizationId, wedding.id);
    const links: Record<string, { url: string; email: string }> = {};
    for (const client of event!.clients) {
      const clientEmail = `${client.firstName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}-${randomUUID()}@symbola.test`;
      const delivery = await createEventLink({
        organizationId,
        eventId: wedding.id,
        createdByUserId: owner.id,
        audience: "client",
        locale: "fr",
        link: { personName: `${client.firstName} ${client.lastName}`, email: clientEmail, eventClientId: client.id, rights: { rubrics: ["quotes"], budgetScope: "all", sharedSlotIds: [] } },
      });
      links[client.firstName] = { url: delivery.url, email: clientEmail };
    }
    return { email, eventId: wedding.id, quoteId: quote.id, number: sent.number, templateId: template!.id, links };
  } finally {
    await sql.end();
  }
}

// Le client lit son contrat, commande, demande l'exécution anticipée, puis signe.
async function clientSigns(page: Page, url: string, number: string) {
  await page.goto(url);
  await expect(page).toHaveURL(/\/portail$/);
  const quotes = page.getByRole("region", { name: "Devis", exact: true });
  await expect(quotes).toContainText("Avec le devis, son contrat « Contrat de prestation de services » (version");
  await expect(quotes).toContainText("Vous disposez d'un droit de rétractation de 14 jours");
  const pdf = await page.request.get(await quotes.getByRole("link", { name: "Lire le contrat (PDF)" }).getAttribute("href").then((href) => href!));
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  // Pas de lien de signature avant la commande.
  await expect(quotes.getByRole("link", { name: `Signer le devis ${number}` })).toHaveCount(0);
  await quotes.getByRole("button", { name: "Je commande avec obligation de paiement" }).click();
  await expect(quotes).toContainText("Commande enregistrée le");
  const early = quotes.getByRole("form", { name: "Démarrage avant la fin du délai de rétractation" });
  await early.getByLabel(/Exécution avant la fin du délai de rétractation/).check();
  await early.getByRole("button", { name: "Enregistrer ma demande" }).click();
  await expect(quotes).toContainText("Demande de démarrage avant la fin du délai enregistrée le");
  await expectNoAxeViolation(page);
  const signing = await quotes.getByRole("link", { name: `Signer le devis ${number}` }).getAttribute("href");
  await page.goto(new URL(signing!).pathname);
  await page.getByRole("button", { name: "Signer le devis" }).click();
  await expect(page.getByText("Vous avez signé ce devis.")).toBeVisible();
}

test("FAC-04 / DOC-03 / FAC-05 / SC-02 étapes 4 à 7 — contrat généré (problèmes nommés puis comblés), signé avec le devis après la commande ; facture d'acompte sans autre saisie", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const setup = await atelier();
  await login(page, setup.email);

  // Étape 6 : le contrat du devis envoyé. Ce qui empêche de le générer est nommé.
  await page.goto(`/devis/${setup.quoteId}`);
  const section = page.getByRole("region", { name: "Contrat" });
  await expect(section).toContainText("Base à adapter, à faire relire par un professionnel du droit.");
  await expect(section).toContainText("Lieu de l'événement : vide");
  await expect(section).toContainText("Clause « Annulation et report » : texte encore à rédiger ou à compléter");

  // La clause se rédige dans le modèle (sa version augmente), le lieu sur la fiche de l'événement.
  await section.getByRole("link", { name: /^Modifier le modèle/ }).click();
  await page.getByText("Modifier la clause « Annulation et report »").click();
  const clause = page.getByRole("form", { name: "Modifier la clause « Annulation et report »" });
  await clause.getByLabel("Texte (variables entre accolades)").fill("Texte d'annulation et de report fourni par le conseil de l'atelier (fictif).");
  await clause.getByRole("button", { name: "Enregistrer la clause" }).click();
  await expect(clause.getByRole("status")).toHaveText("✓ Clause enregistrée.");
  await expectNoAxeViolation(page);
  await page.goto(`/events/${setup.eventId}`);
  // Lot 32a (D5) : les formulaires de la synthèse sont repliés.
  await page.locator("summary", { hasText: "Modifier les informations" }).click();
  const venue = page.getByRole("form", { name: "Lieu de l'événement" });
  await venue.getByLabel("Lieu", { exact: true }).fill("Domaine des Tilleuls");
  await venue.getByLabel("Ville").fill("Senlis");
  await venue.getByRole("button", { name: "Enregistrer le lieu" }).click();
  await expect(venue.getByRole("status")).toHaveText("✓ Lieu enregistré.");

  await page.goto(`/devis/${setup.quoteId}`);
  await expect(section).not.toContainText("À régler avant de générer");
  const generate = section.getByRole("form", { name: "Générer le contrat" });
  await generate.getByLabel("À distance").check();
  await generate.getByLabel(/J'ai lu/).check();
  await generate.getByRole("button", { name: "Générer le contrat" }).click();
  // À distance, l'information légale manque tant que ses clauses ne sont pas cochées.
  await expect(generate.getByRole("alert")).toHaveText("Le contrat ne peut pas être généré :");
  await expect(generate).toContainText("Information légale absente du contrat : Formulaire de rétractation.");
  await expect(generate).toContainText("Le devis prévoit des acomptes : cochez la clause correspondante.");
  // Le canal et l'avertissement restent cochés après le refus.
  await expect(generate.getByLabel("À distance")).toBeChecked();
  await expect(generate.getByLabel(/J'ai lu/)).toBeChecked();
  for (const label of [/Droit de rétractation/, /Formulaire de rétractation/, /Exécution avant la fin du délai/, /Durée et résiliation/, /Acompte et annulation/]) {
    await generate.getByLabel(label).check();
  }
  await generate.getByRole("button", { name: "Générer le contrat" }).click();
  await expect(section).toContainText("Le droit de rétractation s'applique.");
  await expect(section).toContainText("À distance : le client commande sur son portail avant de signer.");
  await expectNoAxeViolation(page);

  // Le devis et son contrat partent ensemble ; à distance, le lien s'affiche sur l'espace du client.
  const send = page.getByRole("form", { name: "Envoyer en signature" });
  await expect(send).toContainText("Le devis et son contrat (V1) seront signés ensemble, dans un même document.");
  await send.getByLabel("Adresse de facturation").first().fill("4 rue des Lilas, 60300 Senlis");
  await send.getByLabel("Adresse de facturation").nth(1).fill("4 rue des Lilas, 60300 Senlis");
  await send.getByRole("button", { name: "Envoyer en signature" }).click();
  await expect(page.getByText("En attente de signature.")).toBeVisible();
  await expect(page.getByText("Document signé : le devis et son contrat, dans un même document.")).toBeVisible();

  // Étape 7 : Léa puis Maxime lisent le contrat, commandent, demandent l'exécution anticipée, signent.
  for (const name of ["Léa", "Maxime"]) {
    const context = await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() });
    await clientSigns(await context.newPage(), setup.links[name]!.url, setup.number);
    await context.close();
  }

  // Devis signé ; actes et dossier de preuve ; la facture d'acompte existe sans autre saisie.
  await page.goto(`/devis/${setup.quoteId}`);
  await expect(page.getByText("Devis signé par tous les signataires.")).toBeVisible();
  await expect(section).toContainText("Léa Martin — Commande avec obligation de paiement");
  await expect(section).toContainText("Maxime Durand — Demande d'exécution avant la fin du délai de rétractation");
  const evidence = await page.request.get(await section.getByRole("link", { name: "Télécharger le dossier de preuve (PDF)" }).getAttribute("href").then((href) => href!), { maxRedirects: 0 });
  expect(evidence.status()).toBe(200);
  expect(evidence.headers()["content-type"]).toBe("application/pdf");
  // Worker des événements (toutes les 15 secondes) : la facture d'acompte part d'elle-même.
  const invoices = page.getByRole("region", { name: "Factures" });
  await expect(async () => {
    await page.reload();
    await expect(invoices).toContainText(/F-\d{4}-0001 — Facture d'acompte \(À la signature\)/, { timeout: 2_000 });
  }).toPass({ timeout: 90_000, intervals: [5_000] });
  await expectNoAxeViolation(page);
});

test("HUB-21 / JUR-20 — Modèles de contrat : bandeau « à adapter », version et date de revue, variables documentées", async ({ page }) => {
  const { sql, db } = createAppConnection();
  let email: string;
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    email = `camille-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
  } finally {
    await sql.end();
  }
  await login(page, email);
  await page.goto("/devis/modeles-contrat");
  await expect(page.getByRole("note")).toHaveText("Base à adapter, à faire relire par un professionnel du droit.");
  await page.getByRole("button", { name: "Ajouter le modèle de départ" }).click();
  await page.getByRole("link", { name: "Contrat de prestation — mariage (à adapter)" }).click();
  await expect(page.getByText("Version 1 — aucune revue juridique datée")).toBeVisible();
  await page.getByLabel("Date de la dernière revue juridique").fill("2027-01-15");
  await page.getByRole("button", { name: "Enregistrer le modèle" }).click();
  await expect(page.getByText("Version 2 — dernière revue juridique le 15 janvier 2027")).toBeVisible();
  await expect(page.getByRole("region", { name: "Variables" })).toContainText("{evenement.lieu}");
  await expectNoAxeViolation(page);
});
