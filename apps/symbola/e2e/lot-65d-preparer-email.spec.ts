// Lot 65d (MSG-01, HUB-20, HUB-28 ; décisions de Julien du 22/11/2026 ; ADR 0110) — SC-02 dans le
// réglage par défaut : la planner envoie les messages de la relation de sa messagerie.
// - Camille prévient Léa de sa proposition : la fenêtre « Préparer l'e-mail » s'ouvre sur le message
//   prérempli (destinataire, objet, texte modifiable) ; « Ouvrir dans ma messagerie », « Copier le
//   message », « J'ai envoyé » ; rien ne part de Symbola ; l'envoi noté est dans l'activité de
//   l'évènement.
// - Un élément « À envoyer » d'« Aujourd'hui » ouvre la même fenêtre ; « Ne pas l'envoyer » l'écarte.
// - Paramètres › Modèles d'e-mails : « Je les envoie de ma messagerie » par défaut, « Symbola les
//   envoie pour moi » se règle.
// En taille ordinateur et en 375 px, axe-core sur la fenêtre et sur le réglage.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { createEventLink, createProspect, createProspectSource, getEvent } from "../modules/events/service";
import { depositPreparedEmail, saveOnboardingStep } from "../modules/hub/service";
import { addQuoteLine, addScheduleItem, createQuote, sendQuote } from "../modules/quotes/service";
import { openQuoteRubric } from "./devis-rubriques";
import { readyOrganization, signIn } from "./helpers";

const MAILPIT = "http://localhost:8025/api/v1";

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

// L'atelier de Camille (réglage par défaut), le mariage de Léa et Maxime, leur devis envoyé, un lien
// personnel pour Léa avec la rubrique « Devis ».
async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier Camille ${randomUUID().slice(0, 6)}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-e2e-65d", role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const wedding = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Durand" }], eventDate: "2027-06-12" });
    const quote = await createQuote({ organizationId, eventId: wedding.id, createdByUserId: owner.id });
    await addQuoteLine(organizationId, quote.id, { label: "Organisation complète", unit: "forfait", quantityMilli: 1000, unitPriceCents: 500000 });
    await addScheduleItem(organizationId, quote.id, { label: "Acompte à la signature", percentageBasisPoints: 3000, dueDate: parisDay(10) });
    const sent = await sendQuote({ organizationId, quoteId: quote.id });
    const lea = (await getEvent(organizationId, wedding.id))!.clients.find((client) => client.firstName === "Léa")!;
    const leaEmail = `lea-${randomUUID()}@symbola.test`;
    const link = await createEventLink({
      organizationId,
      eventId: wedding.id,
      createdByUserId: owner.id,
      audience: "client",
      locale: "fr",
      link: { personName: "Léa Martin", email: leaEmail, eventClientId: lea.id, rights: { rubrics: ["quotes"], budgetScope: "all", sharedSlotIds: [] } },
    });
    return { organizationId, email, eventId: wedding.id, quoteId: quote.id, versionId: sent.current.id, number: sent.number, leaEmail, leaLinkId: link.link.id };
  } finally {
    await sql.end();
  }
}

async function mailsTo(email: string): Promise<{ Subject: string }[]> {
  const response = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  return ((await response.json()) as { messages?: { Subject: string }[] }).messages ?? [];
}

test("SC-02 / MSG-01 — la proposition se prépare pour la messagerie de Camille ; rien ne part de Symbola ; « J'ai envoyé » entre dans l'activité de l'évènement", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/devis/${setup.quoteId}`);
  await openQuoteRubric(page, "proposition");
  await page.getByRole("form", { name: "Prévenir le client par e-mail" }).getByRole("button", { name: "Prévenir le client par e-mail" }).click();

  const dialog = page.getByRole("dialog", { name: "Préparer l'e-mail" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/[?&]preparer=/);
  await expect(dialog).toContainText(`Léa Martin <${setup.leaEmail}>`);
  await expect(dialog.getByLabel("Objet")).toHaveValue(new RegExp(`^Votre proposition ${setup.number}`));
  await expect(dialog.getByLabel("Message")).toHaveValue(/Bonjour Léa Martin,/);
  await expect(dialog).toContainText("Pas de pièce jointe");
  await expect(dialog.getByRole("link", { name: "Télécharger le PDF" })).toHaveAttribute("href", `/devis/${setup.quoteId}/pdf`);
  // Le texte se modifie ; « Ouvrir dans ma messagerie » reprend le texte affiché.
  await dialog.getByLabel("Message").fill("Bonjour Léa,\n\nVotre proposition vous attend dans votre espace.\n\nCamille");
  const mailto = await dialog.getByRole("link", { name: "Ouvrir dans ma messagerie" }).getAttribute("href");
  expect(mailto).toMatch(new RegExp(`^mailto:${encodeURIComponent(setup.leaEmail).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?`));
  expect(decodeURIComponent(mailto!.split("body=")[1]!)).toContain("Votre proposition vous attend dans votre espace.");
  await expect(dialog.getByRole("button", { name: "Copier le message" })).toBeVisible();
  await expectNoAxeViolation(page);
  if (testInfo.project.name === "mobile-375") await expectNoHorizontalScroll(page);

  await dialog.getByRole("button", { name: "J'ai envoyé" }).click();
  await expect(dialog.getByRole("status")).toContainText("Envoi noté");
  await dialog.getByRole("button", { name: testInfo.project.name === "mobile-375" ? "Retour" : "Fermer" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/preparer=/);

  // Rien n'est parti de Symbola vers Léa (seul son lien personnel, technique, l'a été).
  expect((await mailsTo(setup.leaEmail)).filter((message) => message.Subject.startsWith("Votre proposition"))).toEqual([]);
  // L'envoi déclaré est dans le fil d'activité de l'évènement.
  await page.goto(`/events/${setup.eventId}`);
  await expect(page.getByRole("list", { name: "Fil d'activité" })).toContainText(`${setup.email} a envoyé « Proposition envoyée » de sa messagerie.`);
});

test("HUB-28 / MSG-01 — un élément « À envoyer » d'« Aujourd'hui » ouvre la fenêtre ; « Ne pas l'envoyer » l'écarte", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  // Ce qu'aurait déposé la relance avant l'expiration de la proposition (automatisme du lot 53).
  await depositPreparedEmail({ organizationId: setup.organizationId, kind: "proposal_expiry_reminder", eventId: setup.eventId, recipientType: "event_link", recipientId: setup.leaLinkId, ref: { quoteId: setup.quoteId, versionId: setup.versionId, locale: "fr" }, origin: "automation", automationKey: "proposal_expiry_reminder", sourceKey: `proposal-expiry:${setup.versionId}:${setup.leaLinkId}` });
  await signIn(page, setup.email, /\/$/);
  const item = page.getByRole("link", { name: "À envoyer : Proposition bientôt expirée" }).first();
  await expect(item).toBeVisible();
  await item.click();
  const dialog = page.getByRole("dialog", { name: "Préparer l'e-mail" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Objet")).toHaveValue(new RegExp(`^Votre proposition ${setup.number} expire bientôt`));
  await expectNoAxeViolation(page);
  await dialog.getByRole("button", { name: "Ne pas l'envoyer" }).click();
  await expect(dialog.getByRole("status")).toContainText("Message écarté");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name: "À envoyer : Proposition bientôt expirée" })).toHaveCount(0);
});

test("HUB-20 — Paramètres › Modèles d'e-mails : « Je les envoie de ma messagerie » par défaut ; « Symbola les envoie pour moi » se règle", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await page.goto("/parametres/emails");
  const planner = page.getByRole("radio", { name: "Je les envoie de ma messagerie" });
  const symbola = page.getByRole("radio", { name: "Symbola les envoie pour moi" });
  await expect(planner).toBeChecked();
  await expect(page.getByText("Préparé pour votre messagerie").first()).toBeVisible();
  await expectNoAxeViolation(page);
  await symbola.check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Réglage enregistré." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Symbola les envoie pour moi" })).toBeChecked();
  await expect(page.getByText("Préparé pour votre messagerie")).toHaveCount(0);
});
