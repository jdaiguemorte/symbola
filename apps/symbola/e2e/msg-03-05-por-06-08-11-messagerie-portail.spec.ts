// Lot 55 — MSG-03, POR-06, MSG-04, MSG-05, POR-08, POR-11 (scénario SC-06, étapes 5 et 6 ; personas
// SU-01 Camille et SU-05 Léa), en taille ordinateur et en 375 px (projets de playwright.config.ts),
// pages passées à axe-core :
// - Camille ouvre le sujet « Traiteur » : deux zones d'écriture, le bouton nomme Léa ; la note
//   interne s'affiche sur son fond, avec l'étiquette « Interne » ;
// - Léa ouvre « Messages » dans son portail (aux couleurs de l'atelier, contraste corrigé), lit la
//   réponse de Camille sans la note interne, et répond avec une pièce jointe ;
// - le manifeste du portail porte le nom et la couleur de l'atelier ; la proposition d'installation
//   n'apparaît qu'à la deuxième visite, puis se tait après un refus ;
// - l'adresse d'envoi et le journal des envois ; un rejet remonte en alerte sur la fiche du contact.
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { configureMailTransport, memoryTransport } from "@symbola/mail";
import { expect, test, type Page } from "@playwright/test";
import {
  createEventLink,
  createMessageTopic,
  createProspect,
  createProspectSource,
  getMessageThread,
  messageRecipientsDigest,
  postInternalNote,
  postSharedMessage,
} from "../modules/events/service";
import { configureDeliveryWebhookAdapter, createContact, handleEmailDeliveryWebhook, sendOrganizationEmail, signSimulatedWebhook, simulatedWebhookAdapter, SIMULATED_SIGNATURE_HEADER } from "../modules/hub/service";
import { getDocumentSettings, updateDocumentSettings } from "../modules/quotes/service";
import { readyOrganization, signIn } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// L'atelier de Camille, sa couleur de documents trop claire (crème), le mariage de Léa et Maxime, le
// lien de Léa avec la rubrique « Messages ».
async function wedding() {
  const email = `owner-lot55-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let ownerId: string;
  try {
    organizationId = (await readyOrganization(db, `Atelier Camille ${randomUUID().slice(0, 6)}`)).id;
    ownerId = (await createUser(db, { organizationId, email, role: "owner" })).id;
  } finally {
    await sql.end();
  }
  await updateDocumentSettings(organizationId, { ...(await getDocumentSettings(organizationId)), color: "#f5e6c8" });
  const source = await createProspectSource(organizationId, "Salon");
  const { id: eventId } = await createProspect({ organizationId, createdByUserId: ownerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-06-12" });
  const leaEmail = `lea-${randomUUID()}@example.test`;
  configureMailTransport(memoryTransport());
  const { url } = await createEventLink({ organizationId, eventId, createdByUserId: ownerId, audience: "client", locale: "fr", link: { personName: "Léa", email: leaEmail, rights: { rubrics: ["messages", "tasks"], budgetScope: "all", sharedSlotIds: [] } } });
  return { organizationId, ownerId, email, eventId, url, leaEmail };
}

test.afterEach(() => {
  configureMailTransport(null);
  configureDeliveryWebhookAdapter(undefined);
});

test("MSG-03 (SU-01) — Camille écrit dans le sujet « Traiteur » : deux zones distinctes, le bouton nomme Léa, la note interne a son fond et son étiquette", async ({ page }) => {
  const w = await wedding();
  await signIn(page, w.email);
  await page.goto(`/events/${w.eventId}`);
  await page.getByRole("link", { name: "Messages", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
  await page.getByLabel("Nom du sujet").fill("Traiteur");
  await page.getByRole("button", { name: "Créer le sujet" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Traiteur" })).toBeVisible();
  // Deux zones, chacune son titre ; le bouton du message partagé dit à qui il part.
  await expect(page.getByRole("form", { name: "Message partagé" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Note interne — équipe seulement" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Envoyer à Léa" })).toBeVisible();
  await page.getByLabel("Note pour l'équipe").fill("Karim relance demain pour le devis.");
  await page.getByRole("button", { name: "Enregistrer la note interne" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Note interne enregistrée" })).toBeVisible();
  const note = page.locator(".message-item-internal");
  await expect(note).toContainText("Karim relance demain");
  await expect(note.getByText("Interne", { exact: true })).toBeVisible();
  await page.getByLabel("Message aux destinataires").fill("Bonjour Léa, voici le menu proposé par le traiteur.");
  await page.getByRole("button", { name: "Envoyer à Léa" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Message envoyé" })).toBeVisible();
  await expect(page.locator(".message-item:not(.message-item-internal)")).toContainText("voici le menu");
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
});

test("POR-06, POR-08 (SU-05) — Léa lit la réponse dans « Messages », sans la note interne, et répond avec une pièce jointe ; le portail est aux couleurs de l'atelier", async ({ page }) => {
  const w = await wedding();
  const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "Traiteur" });
  await postInternalNote({ organizationId: w.organizationId, eventId: w.eventId, topicId: topic.id, userId: w.ownerId, body: "Note interne : marge de 12 %." });
  const thread = await getMessageThread(w.organizationId, topic.id, w.eventId);
  await postSharedMessage({ organizationId: w.organizationId, eventId: w.eventId, topicId: topic.id, userId: w.ownerId, body: "Bonjour Léa, voici le menu.", recipientsDigest: messageRecipientsDigest(thread.recipients) });

  await page.goto(w.url);
  await expect(page).toHaveURL(/\/portail$/);
  // POR-08 : la couleur crème est assombrie pour garder 4,5:1 ; le titre la porte.
  const color = await page.getByRole("heading", { level: 1 }).evaluate((element) => getComputedStyle(element).color);
  expect(color).not.toBe("rgb(245, 230, 200)");
  await page.getByRole("link", { name: "Messages", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
  await page.getByRole("link", { name: "Traiteur" }).click();
  await expect(page.getByText("Bonjour Léa, voici le menu.")).toBeVisible();
  await expect(page.getByText(/marge de 12/)).toHaveCount(0);
  await page.getByLabel("Votre message").fill("Merci ! Pouvez-vous ajouter une option végétarienne ?");
  await page.getByLabel(/Pièces jointes/).setInputFiles({ name: "allergies.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: /^Envoyer à Atelier Camille/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Message envoyé" })).toBeVisible();
  await expect(page.getByText("Merci ! Pouvez-vous ajouter une option végétarienne ?")).toBeVisible();
  await expect(page.getByRole("link", { name: "allergies" })).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
});

test("POR-11 (SU-05) — le manifeste porte le nom et la couleur de l'atelier ; l'installation se propose à la deuxième visite, pas avant, puis se tait après « Plus tard »", async ({ page, context }) => {
  const w = await wedding();
  await page.goto(w.url);
  await expect(page).toHaveURL(/\/portail$/);
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBe(`/portail/manifeste/${w.organizationId}`);
  const manifest = (await (await page.request.get(manifestHref!)).json()) as { name: string; theme_color: string; start_url: string; display: string };
  expect(manifest).toMatchObject({ start_url: "/portail", display: "standalone" });
  expect(manifest.name).toMatch(/^Atelier Camille .* — mon espace$/);
  expect(manifest.theme_color).not.toBe("#f5e6c8");
  // Première visite : même si le navigateur propose l'installation, rien ne s'affiche.
  // La visite est comptée par l'écran une fois hydraté : on l'attend avant que le navigateur propose.
  const visited = (target: Page, visits: number) => target.waitForFunction((count) => (JSON.parse(window.localStorage.getItem("symbola_portail_installation") ?? "{}") as { visits?: number }).visits === count, visits);
  const offer = (target: Page) => target.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    event.prompt = async () => undefined;
    event.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(event);
  });
  await visited(page, 1);
  await offer(page);
  await expect(page.getByRole("complementary", { name: "Ajouter à l'écran d'accueil" })).toHaveCount(0);
  // Deuxième visite (nouvel onglet, nouvelle session du navigateur) : la proposition apparaît.
  const second = await context.newPage();
  await second.goto("/portail");
  await visited(second, 2);
  await offer(second);
  const prompt = second.getByRole("complementary", { name: "Ajouter à l'écran d'accueil" });
  await expect(prompt).toBeVisible();
  await expectAccessible(second);
  await prompt.getByRole("button", { name: "Plus tard" }).click();
  await expect(prompt).toHaveCount(0);
  // Une troisième visite dans les 30 jours : rien.
  const third = await context.newPage();
  await third.goto("/portail");
  await visited(third, 3);
  await offer(third);
  await expect(third.getByRole("complementary", { name: "Ajouter à l'écran d'accueil" })).toHaveCount(0);
});

test("MSG-04, MSG-05 (SU-01) — l'adresse d'envoi de l'atelier, le journal des envois, et l'alerte d'un rejet sur la fiche du contact", async ({ page }) => {
  const w = await wedding();
  const contact = await createContact(w.organizationId, { kind: "person", firstName: "Bernard", lastName: "Martin", email: `bernard-${randomUUID()}@example.test` });
  const memory = memoryTransport();
  configureMailTransport(memory);
  await sendOrganizationEmail({ organizationId: w.organizationId, to: contact.email!, kind: "new_message", locale: "fr", values: { first_name: "Bernard", event: "le mariage", topic: "Paiements", link: "https://app.symbola.test/portail" } });
  const reference = memory.sent.at(-1)!.messageId!.replace(/^<|>$/g, "");
  const secret = "s".repeat(40);
  configureDeliveryWebhookAdapter(simulatedWebhookAdapter(secret));
  const rawBody = JSON.stringify({ events: [{ reference, status: "bounced", reason: "mailbox_not_found", occurred_at: new Date().toISOString() }] });
  expect((await handleEmailDeliveryWebhook({ headers: new Headers({ [SIMULATED_SIGNATURE_HEADER]: signSimulatedWebhook(secret, rawBody) }), rawBody })).httpStatus).toBe(200);

  await signIn(page, w.email);
  await page.goto("/parametres/adresse-envoi");
  await expect(page.getByRole("heading", { level: 1, name: "Adresse d'envoi des e-mails" })).toBeVisible();
  await expect(page.getByText(/^atelier-camille-[0-9a-f]{6}@envoi\./)).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await page.goto("/parametres/envois");
  await expect(page.getByRole("cell", { name: /Rejeté — adresse inexistante/ })).toBeVisible();
  await expectAccessible(page);
  await page.goto(`/contacts/${contact.id}`);
  await expect(page.getByRole("alert").filter({ hasText: "L'adresse de Bernard Martin est rejetée (adresse inexistante)" })).toBeVisible();
  await expectAccessible(page);
});
