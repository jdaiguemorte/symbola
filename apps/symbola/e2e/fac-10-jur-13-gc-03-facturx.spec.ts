// Lot 41 (FAC-10, JUR-02, JUR-12, JUR-13, GC-03 ; D1, D6, D8, D12) — SC-11 étapes 4 et 5 : un devis
// professionnel complet jusqu'à la facture de solde. La planner désigne l'entreprise acheteuse ; le
// panneau « Vérifications avant envoi » signale le bon de commande manquant sans bloquer ; Claire
// indique le numéro de bon de commande depuis son lien, puis signe ; les factures sont des Factur-X
// qui portent le SIREN, le bon de commande et l'adresse de facturation. En taille ordinateur et en
// 375 px, axe-core sur chaque écran. Données fictives (Novaléa SAS, SIREN fictif).
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { createEventLink, createProspect, createProspectSource, getEvent } from "../modules/events/service";
import { createContact, saveOnboardingStep } from "../modules/hub/service";
import { addQuoteLine, addScheduleItem, createQuote, getQuoteSettings, sendQuote, setQuoteClientKind, updateQuoteSettings } from "../modules/quotes/service";
import { readyOrganization, signIn as signInByLink } from "./helpers";
import { openQuoteRubric } from "./devis-rubriques";

const MAILPIT_API = "http://localhost:8025/api/v1";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function signingLinkSentTo(to: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const { messages } = (await (await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string }[] };
    for (const message of messages) {
      const { Text } = (await (await fetch(`${MAILPIT_API}/message/${message.ID}`)).json()) as { Text: string };
      const link = /https?:\/\/\S+\/signature-fictive\/[0-9a-f-]{36}/.exec(Text)?.[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("e-mail de signature non reçu");
}

// L'agence (assujettie, conditions des professionnels remplies), Novaléa SAS cliente de l'évènement
// avec Claire, le devis professionnel envoyé (une prestation, des biens livrés), un lien pour Claire.
async function agence() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Agence ${randomUUID()}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000, vatNumber: "FR40123456782", metier: "autre" });
    await updateQuoteSettings(organizationId, { ...(await getQuoteSettings(organizationId)), invoiceMentionsProfessional: "Paiement par virement à réception.", latePenaltyRate: "three_times_legal" });
    const email = `nadia-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-e2e-lot41", role: "owner" });
    const novalea = await createContact(organizationId, {
      kind: "company",
      name: "Novaléa SAS",
      companyIdNumber: "55210055400013",
      vatNumber: "FR83552100554",
      addressLine: "1 rue Fictive",
      postalCode: "44000",
      city: "Nantes",
      country: "France",
    });
    const source = await createProspectSource(organizationId, "Recommandation");
    const seminar = await createProspect({
      organizationId,
      createdByUserId: owner.id,
      prospectSourceId: source.id,
      clients: [{ firstName: "Claire", lastName: "Fontaine" }, { contactId: novalea.id, firstName: "Novaléa SAS" }],
      eventDate: "2027-10-07",
    });
    const quote = await createQuote({ organizationId, eventId: seminar.id, createdByUserId: owner.id });
    await setQuoteClientKind(organizationId, quote.id, "professional");
    await addQuoteLine(organizationId, quote.id, { label: "Honoraires d'agence", unit: "forfait", quantityMilli: 1000, unitPriceCents: 500000, vatRateBasisPoints: 2000 });
    await addQuoteLine(organizationId, quote.id, { label: "Kits d'accueil", unit: "lot", quantityMilli: 80000, unitPriceCents: 1500, vatRateBasisPoints: 2000, nature: "goods" });
    await addScheduleItem(organizationId, quote.id, { label: "Acompte à la commande", percentageBasisPoints: 3000, dueDate: "2027-09-01" });
    const sent = await sendQuote({ organizationId, quoteId: quote.id });
    const event = await getEvent(organizationId, seminar.id);
    const claire = event!.clients.find((client) => client.firstName === "Claire")!;
    const claireEmail = `claire-${randomUUID()}@symbola.test`;
    const link = await createEventLink({
      organizationId,
      eventId: seminar.id,
      createdByUserId: owner.id,
      audience: "client",
      locale: "fr",
      link: { personName: "Claire Fontaine", email: claireEmail, eventClientId: claire.id, rights: { rubrics: ["quotes"], budgetScope: "all", sharedSlotIds: [] } },
    });
    return { email, quoteId: quote.id, number: sent.number, link: link.url, claireEmail };
  } finally {
    await sql.end();
  }
}

test("FAC-10 / JUR-02 / JUR-13 / GC-03 / SC-11 étapes 4 et 5 — devis professionnel jusqu'à la facture de solde Factur-X, bon de commande indiqué par la cliente", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const setup = await agence();
  await signInByLink(page, setup.email, /\/$/);

  // La planner désigne l'acheteuse (rubrique « Acheteur et livraison ») ; l'adresse de livraison reprend le lieu proposé.
  await page.goto(`/devis/${setup.quoteId}?rubrique=acheteur`);
  await page.waitForLoadState("networkidle");
  const buyer = page.getByRole("form", { name: "Acheteur, bon de commande et livraison" });
  await buyer.getByLabel("Entreprise acheteuse").selectOption({ label: "Novaléa SAS" });
  await buyer.getByLabel("Adresse", { exact: true }).fill("Hôtel fictif des Bords de Loire, quai Fictif");
  await buyer.getByLabel("Code postal").fill("44000");
  await buyer.getByLabel("Ville").fill("Nantes");
  await buyer.getByRole("button", { name: "Enregistrer" }).click();
  await expect(buyer.getByRole("status")).toContainText("Acheteur et références enregistrés.");
  await expect(page.getByText("Acheteur de la facture : Novaléa SAS.")).toBeVisible();

  // GC-03 : le bon de commande manque ; le point informe, l'envoi reste possible (rubrique « Contrat et signature »).
  await openQuoteRubric(page, "contrat");
  const checks = page.getByRole("group", { name: "Vérifications avant l'envoi du devis" });
  await expect(checks).toContainText("Client professionnel sans numéro de bon de commande");
  await expect(checks).toContainText("elles ne remplacent pas le conseil d'un professionnel du droit ou de la comptabilité");
  await expectNoAxeViolation(page);

  // Envoi en signature à Claire seule.
  const send = page.getByRole("form", { name: "Envoyer en signature" });
  const first = send.getByRole("group", { name: "Signataire 1" });
  await expect(first.getByLabel("E-mail")).toHaveValue(setup.claireEmail);
  await first.getByLabel("Adresse de facturation").fill("1 rue Fictive, 44000 Nantes");
  // La ligne de l'entreprise (pré-remplie) est vidée : seule Claire signe pour elle.
  const second = send.getByRole("group", { name: "Signataire 2" });
  await second.getByLabel("Nom et prénom").fill("");
  await second.getByLabel("E-mail").fill("");
  await second.getByLabel("Adresse de facturation").fill("");
  await send.getByRole("button", { name: "Envoyer en signature" }).click();
  await expect(page.getByText("En attente de signature.")).toBeVisible();

  // SC-11 étape 4 : Claire indique son numéro de bon de commande depuis son lien, puis signe.
  const clientContext = await browser.newContext();
  const client = await clientContext.newPage();
  await client.goto(setup.link);
  await expect(client).toHaveURL(/\/portail$/);
  // Formulaire envoyé après l'hydratation (un envoi natif, sous Referrer-Policy no-referrer, part avec
  // « Origin: null », que les actions serveur refusent).
  await client.waitForLoadState("networkidle");
  const order = client.getByRole("form", { name: "Bon de commande" });
  await order.getByLabel("Numéro de bon de commande de votre entreprise").fill("BC-2027-0142");
  await order.getByRole("button", { name: "Enregistrer le numéro" }).click();
  await expect(order.getByRole("status")).toContainText("Numéro enregistré.");
  await expectNoAxeViolation(client);
  await client.goto(new URL(await signingLinkSentTo(setup.claireEmail)).pathname);
  await client.getByRole("button", { name: "Signer le devis" }).click();
  await expect(client.getByText("Vous avez signé ce devis.")).toBeVisible();
  await clientContext.close();

  // SC-11 étape 5 : la planner voit le numéro ; les factures sont des Factur-X.
  await page.goto(`/devis/${setup.quoteId}?rubrique=acheteur`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Numéro de bon de commande du client")).toHaveValue("BC-2027-0142");
  await openQuoteRubric(page, "factures");
  await page.getByRole("button", { name: "Émettre la facture d'acompte « Acompte à la commande »" }).click();
  await expect(page.getByText(/^F-\d{4}-0001 — Facture d'acompte/)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Émettre la facture de solde" }).click();
  await expect(page.getByText(/^F-\d{4}-0002 — Facture de solde/)).toBeVisible();
  await expectNoAxeViolation(page);

  const href = await page.getByRole("link", { name: /^PDF de la facture F-\d{4}-0002$/ }).getAttribute("href");
  const pdf = await page.request.get(href!);
  expect(pdf.status()).toBe(200);
  const bytes = (await pdf.body()).toString("latin1");
  expect(bytes.startsWith("%PDF-")).toBe(true);
  expect(bytes).toContain("/AFRelationship /Alternative");
  const xml = Buffer.from(bytes.slice(bytes.indexOf("<?xml")), "latin1").toString("utf8");
  expect(xml).toContain('<ram:ID schemeID="0002">552100554</ram:ID>');
  expect(xml).toContain("<ram:IssuerAssignedID>BC-2027-0142</ram:IssuerAssignedID>");
  expect(xml).toContain("<ram:LineOne>1 rue Fictive</ram:LineOne>");
  expect(xml).toContain("<ram:ShipToTradeParty>");
});
