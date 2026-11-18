// Lot 45 — CRM-05, CRM-06, CRM-07, CRM-09, POR-07 (parcours PAR-02 étapes 2 et 7, scénario SC-02,
// personas SU-01 Camille et SU-05 Léa ; SC-10 pour les doublons), en taille ordinateur et en 375 px
// (projets de playwright.config.ts), pages passées à axe-core :
// - Camille répond en un clic depuis un modèle : le texte se relit et se modifie, puis part de Symbola
//   et entre dans l'historique ;
// - la relance prête apparaît dans « Aujourd'hui » ; Camille la relit et l'envoie d'un geste ;
// - Léa répond au questionnaire par son lien, sans compte : à 375 px une question par écran ; chaque
//   réponse est gardée (reprise après rechargement) ; « Terminer » préremplit l'évènement ;
// - deux fiches au même téléphone : Camille compare, choisit, confirme et fusionne.
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import {
  addStarterQuestionnaires,
  createProspect,
  createProspectSource,
  getEvent,
  listQuestionnaireTemplates,
  prepareDueFollowUps,
  prospectMessageContext,
  sendEventQuestionnaire,
  sendProspectMessage,
} from "../modules/events/service";
import { createContact } from "../modules/hub/service";
import { readyOrganization, signIn } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const DAY = 86_400_000;

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function organization() {
  const email = `owner-lot45-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let ownerId: string;
  try {
    organizationId = (await readyOrganization(db, `Atelier Camille ${randomUUID().slice(0, 6)}`)).id;
    ownerId = (await createUser(db, { organizationId, email, role: "owner" })).id;
  } finally {
    await sql.end();
  }
  const source = await createProspectSource(organizationId, "Instagram");
  return { organizationId, ownerId, email, sourceId: source.id };
}

async function prospect(org: Awaited<ReturnType<typeof organization>>, firstName: string) {
  const { id } = await createProspect({ organizationId: org.organizationId, createdByUserId: org.ownerId, prospectSourceId: org.sourceId, clients: [{ firstName, lastName: "Martin", email: `${firstName.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()}-${randomUUID().slice(0, 6)}@example.test` }] });
  return id;
}

test("CRM-05, CRM-06 (SU-01) — Camille répond depuis un modèle, relit et envoie ; puis relit la relance prête dans « Aujourd'hui » et l'envoie", async ({ page }) => {
  const org = await organization();
  const eventId = await prospect(org, "Léa");
  // Une autre demande, à qui Camille a répondu il y a quatre jours : la relance de J+3 est prête.
  const waiting = await prospect(org, "Inès");
  const context = await prospectMessageContext({ organizationId: org.organizationId, eventId: waiting, locale: "fr", bookingUrl: null });
  await sendProspectMessage({ organizationId: org.organizationId, eventId: waiting, recipients: context!.recipients, templateId: null, subject: "Merci", body: "Bonjour Inès,\n\nMerci pour votre message.", userId: org.ownerId, locale: "fr", delivery: "sent", values: {}, now: new Date(Date.now() - 4 * DAY) });
  await prepareDueFollowUps({ organizationId: org.organizationId, locale: "fr", context: ({ eventId: id, contactIds }) => prospectMessageContext({ organizationId: org.organizationId, eventId: id, locale: "fr", contactIds, bookingUrl: null }) });

  await signIn(page, org.email);
  await page.goto(`/events/${eventId}/ecrire`);
  await expect(page.getByRole("heading", { level: 1, name: "Écrire au client" })).toBeVisible();
  const subject = page.getByRole("textbox", { name: "Objet" });
  await expect(subject).toHaveValue(/Merci pour votre message/);
  await subject.fill("Votre mariage — premier échange");
  await page.getByRole("textbox", { name: "Texte" }).fill("Bonjour Léa,\n\nMerci pour votre message ! Parlons-en de vive voix.");
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Envoyer depuis Symbola" }).click();
  await expect(page.getByRole("status")).toContainText("Message envoyé et rangé dans l'historique");
  await page.goto(`/events/${eventId}`);
  await expect(page.getByRole("region", { name: "Échanges avec le contact" })).toContainText("Réponse : Votre mariage — premier échange");

  await page.goto("/");
  await page.getByRole("link", { name: /Relancer Inès : prête, à relire/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Relance 1" })).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Envoyer la relance" }).click();
  await expect(page.getByRole("status")).toContainText("Relance envoyée");
});

test("POR-07, CRM-09 (SU-05) — Léa répond au questionnaire par son lien : une question par écran à 375 px, réponses gardées, « Terminer » préremplit l'évènement", async ({ page }, testInfo) => {
  const org = await organization();
  const eventId = await prospect(org, "Léa");
  await addStarterQuestionnaires(org.organizationId, "fr");
  const discovery = (await listQuestionnaireTemplates(org.organizationId)).find((template) => template.starterKey === "discovery")!;
  const event = await getEvent(org.organizationId, eventId);
  const sent = await sendEventQuestionnaire({ organizationId: org.organizationId, eventId, eventClientId: event!.clients[0]!.id, templateId: discovery.id, userId: org.ownerId, locale: "fr" });

  await page.goto(sent.url);
  await expect(page).toHaveURL(/\/portail$/);
  await page.getByRole("link", { name: "Mes questionnaires" }).click();
  await page.getByRole("link", { name: "Découverte" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Découverte" })).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  const mobile = testInfo.project.name.startsWith("mobile");
  const date = page.getByLabel("À quelle date pensez-vous ?");
  await date.fill("2027-06-12");
  await expect(page.getByRole("status")).toContainText("Réponse enregistrée");
  if (mobile) {
    // Une question par écran : la suivante n'est pas affichée avant « Suivante ».
    await expect(page.getByLabel("Combien d'invités environ ?")).toBeHidden();
    await page.getByRole("button", { name: "Suivante" }).click();
    await page.getByRole("button", { name: "Suivante" }).click();
    await page.getByRole("button", { name: "Suivante" }).click();
  } else {
    await expect(page.getByRole("button", { name: "Suivante" })).toBeHidden();
  }
  const guests = page.getByLabel("Combien d'invités environ ?");
  await guests.fill("140");
  await guests.blur();
  await expect(page.getByRole("status")).toContainText("Réponse enregistrée");
  // Reprise : après rechargement, les réponses sont là.
  await page.reload();
  await expect(page.getByLabel("À quelle date pensez-vous ?")).toHaveValue("2027-06-12");
  await page.getByRole("button", { name: "Terminer" }).click();
  await expect(page.getByRole("status")).toContainText("Merci ! Vos réponses sont transmises.");
  const filled = await getEvent(org.organizationId, eventId);
  expect(filled).toMatchObject({ eventDate: "2027-06-12", guestsEstimated: 140 });
});

test("CRM-07 (SU-01, SC-10) — deux fiches au même téléphone : Camille compare, choisit champ par champ, confirme et fusionne", async ({ page }) => {
  const org = await organization();
  const kept = await createContact(org.organizationId, { firstName: "Léa", lastName: "Martin", phone: "06 12 34 56 78", email: `lea-${randomUUID().slice(0, 6)}@example.test` });
  await createContact(org.organizationId, { firstName: "Léa", lastName: "Martin-Dupont", phone: "+33 6 12 34 56 78", city: "Lyon" });

  await signIn(page, org.email);
  await page.goto("/contacts");
  await page.getByRole("link", { name: "Un doublon possible à vérifier" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Doublons possibles" })).toBeVisible();
  await expect(page.getByText("Même téléphone")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("link", { name: "Comparer et fusionner" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fusionner deux fiches" })).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("radio", { name: "Léa Martin", exact: true }).check();
  await page.getByRole("radio", { name: "Garder Martin-Dupont pour Nom" }).check();
  // Sans la confirmation, rien ne se fusionne.
  await page.getByRole("checkbox", { name: /ces deux fiches sont la même personne/ }).check();
  await page.getByRole("button", { name: "Fusionner" }).click();
  await expect(page).toHaveURL(new RegExp(`/contacts/${kept.id}`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Léa Martin-Dupont");
});
