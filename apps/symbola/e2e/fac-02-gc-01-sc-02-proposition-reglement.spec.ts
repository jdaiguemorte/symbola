// Lot 43 (FAC-02, FAC-08 Divergent, GC-01, SEC-16, BUD-06, BUD-11 ; ADR 0087, ADR 0089) — SC-02 étapes 4
// à 8 : Camille vérifie l'aperçu « vu par le client » ; Léa ouvre la proposition sur son téléphone,
// coche une option, reçoit son code, signe ; Maxime signe depuis un autre appareil ; Léa règle l'acompte
// par virement (RIB, référence, QR code, « J'ai fait le virement ») ; Camille voit la déclaration dans
// « Aujourd'hui » et confirme l'encaissement. Mesure : trois minutes pour Léa. Puis les payeurs et le
// calendrier des sorties d'argent. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { addDefaultVendorSlots, createEventLink, createProspect, createProspectSource, getEvent, listEventVendorSlots } from "../modules/events/service";
import { saveOnboardingStep } from "../modules/hub/service";
import { addPaymentMethods, addQuoteLine, addScheduleItem, createQuote, getDocumentSettings, sendQuote, updateDocumentSettings } from "../modules/quotes/service";
import { addEventPayer, addVendorPayment, listBudgetLines, setLinePayerShares, setVendorPaymentPayer, updateBudgetLine } from "../modules/budget/service";
import { readyOrganization, signIn } from "./helpers";

const MAILPIT = "http://localhost:8025/api/v1";
const IBAN = "FR7630006000011234567890189";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

function parisDay(offsetDays = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

async function signingCodeSentTo(email: string, after: number): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const list = (await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json()) as { messages?: { Subject: string; Created: string }[] };
    const code = (list.messages ?? []).filter((message) => new Date(message.Created).getTime() >= after).map((message) => /(\d{6})$/.exec(message.Subject)?.[1]).find(Boolean);
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("aucun code reçu");
}

// L'atelier de Camille (franchise en base, RIB renseigné), le mariage de Léa et Maxime, leur devis envoyé
// (5 000 € et une option à 400 €, acompte de 30 % dans dix jours), un lien personnel pour chacun.
async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier Camille ${randomUUID().slice(0, 6)}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    await updateDocumentSettings(organizationId, { ...(await getDocumentSettings(organizationId)), iban: IBAN, bic: "AGRIFRPP" });
    await addPaymentMethods(organizationId, ["Virement bancaire"]);
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-e2e-43", role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const wedding = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Durand" }], eventDate: "2027-06-12" });
    const quote = await createQuote({ organizationId, eventId: wedding.id, createdByUserId: owner.id });
    await addQuoteLine(organizationId, quote.id, { label: "Organisation complète", unit: "forfait", quantityMilli: 1000, unitPriceCents: 500000 });
    await addQuoteLine(organizationId, quote.id, { label: "Brunch du lendemain", unit: "forfait", quantityMilli: 1000, unitPriceCents: 40000, isOption: true });
    await addScheduleItem(organizationId, quote.id, { label: "Acompte à la signature", percentageBasisPoints: 3000, dueDate: parisDay(10) });
    const sent = await sendQuote({ organizationId, quoteId: quote.id });
    const event = (await getEvent(organizationId, wedding.id))!;
    const links: Record<string, { url: string; email: string }> = {};
    for (const client of event.clients) {
      const clientEmail = `${client.firstName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}-${randomUUID()}@symbola.test`;
      const delivery = await createEventLink({
        organizationId,
        eventId: wedding.id,
        createdByUserId: owner.id,
        audience: "client",
        locale: "fr",
        link: { personName: `${client.firstName} ${client.lastName}`, email: clientEmail, eventClientId: client.id, rights: { rubrics: ["quotes", "budget"], budgetScope: "all", sharedSlotIds: [] } },
      });
      links[client.firstName] = { url: delivery.url, email: clientEmail };
    }
    return { email, organizationId, eventId: wedding.id, quoteId: quote.id, number: sent.number, links };
  } finally {
    await sql.end();
  }
}

// Le client ouvre la proposition depuis son espace, reçoit son code, signe, revient à son espace.
async function clientSigns(page: Page, link: { url: string; email: string }, number: string) {
  await page.goto(link.url);
  await expect(page).toHaveURL(/\/portail$/);
  await page.getByRole("link", { name: `Proposition ${number} (version 1)` }).click();
  const flow = page.getByRole("region", { name: "Accepter et signer" });
  const after = Date.now() - 1000;
  await flow.getByRole("button", { name: "Recevoir mon code par e-mail" }).click();
  await expect(flow.getByRole("status")).toContainText("Code envoyé à");
  await flow.getByLabel("Code reçu par e-mail").fill(await signingCodeSentTo(link.email, after));
  await flow.getByRole("button", { name: "Valider le code" }).click();
  const sign = flow.getByRole("link", { name: `Signer le devis ${number}`, exact: true });
  await expect(sign).toBeVisible();
  await page.goto(new URL((await sign.getAttribute("href"))!).pathname);
  await page.getByRole("button", { name: "Signer le devis" }).click();
  await expect(page.getByText("Vous avez signé ce devis.")).toBeVisible();
  await page.getByRole("link", { name: "Revenir à mon espace" }).click();
  await expect(page).toHaveURL(/\/portail$/);
}

async function phone(browser: Browser) {
  return browser.newContext({ locale: "fr-FR", viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
}

test("SC-02 étapes 4 à 8 / FAC-02 / GC-01 / SEC-16 / FAC-08 — aperçu, option, code, signature à deux, virement déclaré puis confirmé ; trois minutes pour Léa", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const setup = await atelier();
  let leaMs = 0;
  const timed = async (work: () => Promise<void>) => {
    const start = Date.now();
    await work();
    leaMs += Date.now() - start;
  };

  // Étape 4 : Camille vérifie l'aperçu « vu par le client », sans rien enregistrer.
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/devis/${setup.quoteId}`);
  await page.getByRole("link", { name: "Voir la proposition comme le client" }).click();
  await expect(page.getByRole("note").filter({ hasText: "Aperçu : la proposition telle que la voit le client." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Proposition de Atelier Camille/);
  await expect(page.getByText("Proposition valable jusqu'au")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enregistrer mon choix" })).toBeDisabled();
  await expectNoAxeViolation(page);

  // Étape 5 : Léa, sur son téléphone, ouvre la proposition et coche le brunch.
  const leaContext = await phone(browser);
  const lea = await leaContext.newPage();
  await timed(async () => {
    await lea.goto(setup.links["Léa"]!.url);
    await expect(lea).toHaveURL(/\/portail$/);
    await lea.getByRole("link", { name: `Proposition ${setup.number} (version 1)` }).click();
    await expect(lea.getByText("Total avec vos options : 5 000,00 €")).toBeVisible();
    await lea.getByLabel(/Brunch du lendemain/).check();
    await lea.getByRole("button", { name: "Enregistrer mon choix" }).click();
    await expect(lea.getByText("Votre choix est enregistré.", { exact: true })).toBeVisible();
    await lea.reload();
    await expect(lea.getByText("Total avec vos options : 5 400,00 €")).toBeVisible();
    await expect(lea.getByRole("region", { name: "Accepter et signer" })).toContainText("prépare le document à signer");
  });
  await expectNoHorizontalScroll(lea);
  await expectNoAxeViolation(lea);

  // Camille envoie le devis en signature aux deux mariés (rubrique « Contrat et signature »).
  await page.goto(`/devis/${setup.quoteId}?rubrique=contrat`);
  const send = page.getByRole("form", { name: "Faire signer" });
  await send.getByLabel("Adresse de facturation").first().fill("4 rue des Lilas, 60300 Senlis");
  await send.getByLabel("Adresse de facturation").nth(1).fill("4 rue des Lilas, 60300 Senlis");
  await send.getByRole("button", { name: "Faire signer" }).click();
  await send.getByRole("button", { name: "Envoyer à 2 personnes" }).click();
  await expect(page.getByText("En attente de signature.")).toBeVisible();

  // SEC-16 : sans le code, pas de lien de signature ; Léa le reçoit, signe, et attend Maxime.
  await timed(async () => {
    await clientSigns(lea, setup.links["Léa"]!, setup.number);
    await lea.getByRole("link", { name: `Proposition ${setup.number} (version 1)` }).click();
    await expect(lea.getByRole("region", { name: "Accepter et signer" })).toContainText("En attente de la signature de Maxime.");
  });
  await expectNoAxeViolation(lea);

  // Étape 6 : Maxime signe depuis un autre appareil.
  const maximeContext = await browser.newContext({ locale: "fr-FR" });
  await clientSigns(await maximeContext.newPage(), setup.links["Maxime"]!, setup.number);
  await maximeContext.close();

  // Étape 8 : Léa règle l'acompte par virement.
  await timed(async () => {
    // Léa est restée sur sa proposition : elle la recharge, Maxime a signé.
    await lea.reload();
    await expect(lea.getByRole("region", { name: "Accepter et signer" })).toContainText("Tous les signataires ont signé.");
    await lea.getByRole("link", { name: "Régler l'acompte" }).click();
    await expect(lea.getByRole("heading", { level: 1 })).toHaveText("Régler : Acompte à la signature");
    await expect(lea.getByText("1 620,00 €")).toBeVisible();
    await expect(lea.getByText("FR76 3000 6000 0112 3456 7890 189")).toBeVisible();
    await expect(lea.getByText(/^SYM-\d{4}-[0-9A-HJKMNP-TV-Z]{6}$/)).toBeVisible();
    await expect(lea.getByRole("img", { name: "QR code de virement, avec le montant et la référence" })).toBeVisible();
    await lea.getByRole("button", { name: "J'ai fait le virement" }).click();
    await expect(lea.getByRole("status").filter({ hasText: /confirmera la réception|La réception sera confirmée/ })).toBeVisible();
  });
  await expectNoHorizontalScroll(lea);
  await expectNoAxeViolation(lea);
  // Mesure SC-02 : signer et régler en moins de trois minutes pour Léa.
  expect(leaMs).toBeLessThan(180_000);

  // Camille voit la déclaration dans « Aujourd'hui », puis confirme l'encaissement.
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Léa Martin déclare avoir viré 1 620,00 €")).toBeVisible();
  // Lot 62d : l'encart de suivi annonce le virement déclaré, et mène à la rubrique du paiement.
  await page.goto(`/devis/${setup.quoteId}`);
  const follow = page.getByRole("region", { name: "Suivi du devis" }).getByRole("link", { name: /^Paiement et acompte/ });
  await expect(follow).toContainText("1 virement déclaré à confirmer");
  await follow.click();
  await expect(page.getByRole("region", { name: "Règlement par virement" })).toContainText("Léa Martin déclare avoir viré le");
  await page.getByText("Marquer payée l'échéance « Acompte à la signature »").click();
  const pay = page.getByRole("form", { name: "Marquer payée l'échéance « Acompte à la signature »" });
  await pay.getByLabel("Mode de paiement").selectOption({ label: "Virement bancaire" });
  await pay.getByRole("button", { name: "Marquer payée" }).click();
  await expect(page.getByText(/^Payée le .* \(Virement bancaire\)$/)).toBeVisible();
  await expectNoAxeViolation(page);
  await lea.reload();
  await expect(lea.getByText(/^Réglé le .*\. Merci !$/)).toBeVisible();
  await leaContext.close();
});

test("BUD-06 / BUD-11 — la famille ne voit que sa part ; le client décide ; calendrier des sorties d'argent mois par mois", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const { sql, db } = createAppConnection();
  let setup: { email: string; eventId: string; family: string; lea: string };
  try {
    const organizationId = (await readyOrganization(db, `Atelier Camille ${randomUUID().slice(0, 6)}`)).id;
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-e2e-43", role: "owner" });
    await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur"]);
    const source = await createProspectSource(organizationId, "Salon");
    const wedding = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Durand" }], eventDate: "2027-06-12" });
    const [venue, caterer] = await listEventVendorSlots(organizationId, wedding.id);
    await updateBudgetLine({ organizationId, eventId: wedding.id, eventVendorSlotId: venue!.id, field: "committed", amountCents: 650000, changedByUserId: owner.id });
    await updateBudgetLine({ organizationId, eventId: wedding.id, eventVendorSlotId: caterer!.id, field: "committed", amountCents: 960000, changedByUserId: owner.id });
    const lines = (await listBudgetLines(organizationId, wedding.id)).lines;
    const catererLine = lines.find((line) => line.eventVendorSlotId === caterer!.id)!;
    const venueLine = lines.find((line) => line.eventVendorSlotId === venue!.id)!;
    await addVendorPayment({ organizationId, eventId: wedding.id, lineId: catererLine.id, label: "Acompte traiteur", fixedAmountCents: 288000, dueOn: "2027-01-05", changedByUserId: owner.id });
    await addVendorPayment({ organizationId, eventId: wedding.id, lineId: venueLine.id, label: "Solde du lieu", fixedAmountCents: 300000, dueOn: "2027-05-30", changedByUserId: owner.id });
    const event = (await getEvent(organizationId, wedding.id))!;
    const rights = { rubrics: ["budget" as const], budgetScope: "all" as const, sharedSlotIds: [] };
    const familyLink = await createEventLink({ organizationId, eventId: wedding.id, createdByUserId: owner.id, audience: "client", locale: "fr", link: { personName: "Bernard Martin", email: `bernard-${randomUUID()}@symbola.test`, rights } });
    const leaLink = await createEventLink({ organizationId, eventId: wedding.id, createdByUserId: owner.id, audience: "client", locale: "fr", link: { personName: "Léa Martin", email: `lea-${randomUUID()}@symbola.test`, eventClientId: event.clients[0]!.id, rights } });
    const family = await addEventPayer(organizationId, { eventId: wedding.id, name: "Famille Martin", kind: "family_one", linkId: familyLink.link.id });
    await setLinePayerShares(organizationId, { eventId: wedding.id, lineId: catererLine.id, shares: [{ payerId: family.id, percentageBasisPoints: 5000, amountCents: null }] });
    const payment = (await listBudgetLines(organizationId, wedding.id)).lines.flatMap((line) => line.payments).find((entry) => entry.label === "Acompte traiteur")!;
    await setVendorPaymentPayer(organizationId, { eventId: wedding.id, paymentId: payment.id, payerId: family.id });
    setup = { email, eventId: wedding.id, family: familyLink.url, lea: leaLink.url };
  } finally {
    await sql.end();
  }

  // Camille : les payeurs, la part de chacun au centime, et le calendrier.
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/budget/${setup.eventId}/payeurs`);
  await expect(page.getByRole("region", { name: "Payeurs de l'évènement" })).toContainText("Famille Martin — Famille de l'un — sa part : 4 800,00 €");
  await expect(page.getByRole("region", { name: "Répartition par ligne" })).toContainText("Famille Martin : 4 800,00 €");
  await expectNoAxeViolation(page);
  await page.goto(`/budget/${setup.eventId}/calendrier`);
  await expect(page.getByRole("heading", { name: "janvier 2027" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "mai 2027" })).toBeVisible();
  await expectNoAxeViolation(page);

  // La famille, sur son téléphone : sa part seule, ni total ni autre ligne ; son calendrier.
  const familyContext = await phone(browser);
  const familyPage = await familyContext.newPage();
  await familyPage.goto(setup.family);
  await expect(familyPage).toHaveURL(/\/portail$/);
  const share = familyPage.getByRole("region", { name: "Votre part" });
  await expect(share).toContainText("Traiteur");
  await expect(share).toContainText("4 800,00 €");
  await expect(familyPage.getByText("6 500,00 €")).toHaveCount(0);
  await expectNoAxeViolation(familyPage);
  await familyPage.getByRole("link", { name: "Calendrier des sorties d'argent" }).click();
  await expect(familyPage.getByRole("heading", { name: "janvier 2027" })).toBeVisible();
  await expect(familyPage.getByText("Solde du lieu")).toHaveCount(0);
  await expectNoHorizontalScroll(familyPage);
  await expectNoAxeViolation(familyPage);

  // Léa décide de montrer tout le budget à sa famille.
  const leaContext = await phone(browser);
  const lea = await leaContext.newPage();
  await lea.goto(setup.lea);
  await lea.getByRole("link", { name: "Ce que voit chaque payeur" }).click();
  const visibility = lea.getByRole("form", { name: "Ce que voit Famille Martin" });
  await visibility.getByLabel("Tout le budget").check();
  await visibility.getByRole("button", { name: "Enregistrer" }).click();
  await expect(async () => {
    await lea.reload();
    await expect(lea.getByRole("form", { name: "Ce que voit Famille Martin" }).getByLabel("Tout le budget")).toBeChecked({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expectNoAxeViolation(lea);
  await familyPage.goto("/portail");
  await expect(familyPage.getByRole("region", { name: "Votre part" })).toHaveCount(0);
  await expect(familyPage.getByRole("list", { name: "Budget par poste" })).toContainText("Lieu");
  await familyContext.close();
  await leaContext.close();
});
