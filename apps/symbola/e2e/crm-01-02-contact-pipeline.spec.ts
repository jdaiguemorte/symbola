// Lot 44 — CRM-01 et CRM-02 (parcours PAR-02 étape 1, scénario SC-02 variante V1, personas SU-01
// Camille et SU-05 Léa), en taille ordinateur et en 375 px (projets de playwright.config.ts) :
// - Léa remplit le formulaire de contact public, sans compte ; la mention d'information est avant le
//   bouton ; la page passe axe-core ; elle ne voit qu'une confirmation ;
// - en-têtes : seule /contact/<adresse>/cadre accepte d'être encadrée, par les sites déclarés ;
// - Camille voit la demande dans « Aujourd'hui », avec la date déjà prise, puis la carte dans le
//   pipeline ; elle la déplace au clavier seul (bouton, liste, annonce, focus revenu), à la souris sur
//   ordinateur, puis la pose sur « Gagné » : l'évènement est confirmé ;
// - à 375 px : une étape à la fois, sans défilement horizontal.
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { createLossReason, createProspect, createProspectSource, getEvent, listEvents, saveContactFormSettings, winPipelineCard } from "../modules/events/service";
import { readyOrganization, signIn } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SITE = "https://www.atelier-camille.test";

async function organization() {
  const email = `owner-crm-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let ownerId: string;
  try {
    organizationId = (await readyOrganization(db, `Atelier Camille ${randomUUID().slice(0, 6)}`)).id;
    ownerId = (await createUser(db, { organizationId, email, role: "owner" })).id;
  } finally {
    await sql.end();
  }
  // Un mariage déjà confirmé le 12 juin 2027 : la date de Léa est prise (CRM-04).
  const source = await createProspectSource(organizationId, "Salon du mariage");
  const busy = await createProspect({ organizationId, createdByUserId: ownerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: "Petit" }], eventDate: "2027-06-12" });
  await winPipelineCard({ organizationId, eventId: busy.id, userId: ownerId });
  const slug = `atelier-camille-${randomUUID().slice(0, 6)}`;
  await saveContactFormSettings(organizationId, { active: true, slug, hiddenFields: [], privacyPolicyUrl: `${SITE}/confidentialite`, allowedOrigins: [SITE], notifyOwner: true, locale: "fr" });
  return { organizationId, ownerId, email, slug };
}

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Léa remplit le formulaire, sans compte, et attend le délai minimal de remplissage (D4).
async function sendRequest(page: Page, slug: string) {
  await page.goto(`/contact/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name: /Contacter Atelier Camille/ })).toBeVisible();
  await page.getByRole("textbox", { name: "Prénom", exact: true }).fill("Léa");
  await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Martin");
  await page.getByLabel("E-mail").fill(`lea-${randomUUID().slice(0, 6)}@example.test`);
  await page.getByLabel("Date souhaitée").fill("2027-06-12");
  await page.getByLabel("Lieu ou ville").fill("Domaine des Tilleuls, Mâcon");
  await page.getByLabel("Budget").fill("25 000 €");
  await page.getByLabel("Nombre d'invités").fill("120");
  await page.getByLabel("Votre message").fill("<b>Bonjour</b>, nous cherchons une wedding planner.");
  await page.waitForTimeout(3_200);
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();
  await expect(page.getByRole("heading", { name: "Merci, votre demande est envoyée" })).toBeFocused();
}

test("CRM-01 (SU-05) — Léa envoie sa demande par le formulaire public, sans compte ; mention avant le bouton ; page accessible", async ({ page }) => {
  const org = await organization();
  await page.goto(`/contact/${org.slug}`);
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  // RGP-03 : la mention d'information est affichée avant le bouton d'envoi.
  const notice = page.getByRole("region", { name: "Vos informations" });
  await expect(notice).toContainText("responsable de leur traitement");
  await expect(notice.getByRole("link", { name: /Politique de confidentialité/ })).toHaveAttribute("href", `${SITE}/confidentialite`);
  const before = await page.evaluate(() => {
    const region = document.querySelector(".contact-notice");
    const button = document.querySelector("form.contact-form button[type=submit]");
    return Boolean(region && button && region.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(before).toBe(true);
  await sendRequest(page, org.slug);
  await expectAccessible(page);
});

test("CRM-01 (D1) — seule la page encadrée accepte un cadre, des sites déclarés ; partout ailleurs, DENY", async ({ page }) => {
  const org = await organization();
  const framed = await page.request.get(`/contact/${org.slug}/cadre`);
  expect(framed.status()).toBe(200);
  expect(framed.headers()["x-frame-options"]).toBeUndefined();
  expect(framed.headers()["content-security-policy"]).toContain(`frame-ancestors 'self' ${SITE};`);
  for (const path of [`/contact/${org.slug}`, "/login"]) {
    const response = await page.request.get(path);
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  }
  // Une adresse inconnue : « introuvable », et pas de cadre.
  const unknown = await page.request.get(`/contact/inconnue-${randomUUID().slice(0, 6)}/cadre`);
  expect(unknown.status()).toBe(404);
  expect(unknown.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("CRM-01 et CRM-02 (SU-01, PAR-02) — la demande arrive dans « Aujourd'hui » avec la date prise ; Camille déplace la carte au clavier, puis la gagne", async ({ page }, testInfo) => {
  const org = await organization();
  await sendRequest(page, org.slug);

  await signIn(page, org.email);
  await page.goto("/");
  const item = page.getByRole("link", { name: /Nouvelle demande : Léa, 12 juin 2027/ }).first();
  await expect(item).toBeVisible();
  await expect(page.getByText("Date déjà prise").first()).toBeVisible();

  await page.goto("/events/pipeline");
  await expect(page.getByRole("heading", { level: 1, name: "Pipeline" })).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  const mobile = testInfo.project.name === "mobile-375";
  if (mobile) {
    // D10 : une étape à la fois ; les onglets donnent le nombre de cartes.
    await expect(page.getByRole("button", { name: /Nouvelle demande 1/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { level: 2, name: /Premier échange/ })).toBeHidden();
  }
  const card = page.locator("[data-move-item]").filter({ hasText: "Léa" });
  await expect(card.getByText("Date déjà prise")).toBeVisible();
  await expect(card.getByText("120")).toBeVisible();

  // Au clavier seul : le bouton « Déplacer », la liste des étapes, l'annonce, le focus revenu.
  const move = card.getByRole("button", { name: "Déplacer Léa" });
  await move.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("list", { name: "Où déplacer Léa" });
  await expect(menu.getByRole("button").first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("button", { name: "Rendez-vous" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Léa déplacé vers « Rendez-vous »." })).toBeAttached();
  await expect(page.locator("[data-move-item]").filter({ hasText: "Léa" }).getByRole("button", { name: "Déplacer Léa" })).toBeFocused();
  await expect(page.locator(".pipeline-column", { has: page.getByRole("heading", { name: /^Rendez-vous/ }) }).getByText("Léa")).toBeAttached();

  if (!mobile) {
    // À la souris : glisser-déposer vers « Devis envoyé ».
    const target = page.locator(".pipeline-column", { has: page.getByRole("heading", { name: /^Devis envoyé/ }) });
    await page.locator("[data-move-item]").filter({ hasText: "Léa" }).dragTo(target);
    await expect(page.getByRole("status").filter({ hasText: "Léa déplacé vers « Devis envoyé »." })).toBeAttached();
  }

  // « Gagné » : confirmation, puis l'évènement est confirmé et quitte le pipeline.
  await page.locator("[data-move-item]").filter({ hasText: "Léa" }).getByRole("button", { name: "Déplacer Léa" }).click();
  await page.getByRole("list", { name: "Où déplacer Léa" }).getByRole("button", { name: "Gagné" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirmer l'évènement de Léa ?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmer l'évènement" }).click();
  await expect(page.locator("[data-move-item]").filter({ hasText: "Léa" })).toHaveCount(0);
  await expect.poll(async () => (await listEvents({ organizationId: org.organizationId, statusIn: ["confirmed"] })).length).toBe(2);
});

test("CRM-02 — « Perdu » demande le motif ; Échap referme sans rien changer", async ({ page }) => {
  const org = await organization();
  const source = await createProspectSource(org.organizationId, "Instagram");
  const prospect = await createProspect({ organizationId: org.organizationId, createdByUserId: org.ownerId, prospectSourceId: source.id, clients: [{ firstName: "Zoé", lastName: "Leroy" }], eventDate: "2027-09-04" });
  await createLossReason(org.organizationId, "Budget trop serré", false);
  await signIn(page, org.email);
  await page.goto("/events/pipeline");
  const card = page.locator("[data-move-item]").filter({ hasText: "Zoé" });
  await card.getByRole("button", { name: "Déplacer Zoé" }).click();
  await page.getByRole("list", { name: "Où déplacer Zoé" }).getByRole("button", { name: "Perdu" }).click();
  const dialog = page.getByRole("dialog", { name: "Annuler l'option de Zoé ?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect((await getEvent(org.organizationId, prospect.id))?.status).toBe("option");
  await card.getByRole("button", { name: "Déplacer Zoé" }).click();
  await page.getByRole("list", { name: "Où déplacer Zoé" }).getByRole("button", { name: "Perdu" }).click();
  await dialog.getByLabel("Motif de perte").selectOption({ label: "Budget trop serré" });
  await dialog.getByRole("button", { name: "Annuler l'option" }).click();
  await expect(page.locator("[data-move-item]").filter({ hasText: "Zoé" })).toHaveCount(0);
  await expect.poll(async () => (await getEvent(org.organizationId, prospect.id))?.status).toBe("cancelled");
});
