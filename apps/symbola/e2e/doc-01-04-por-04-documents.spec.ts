// Lot 37a (DOC-01, DOC-04, POR-04, POR-10 ; décisions D3 à D7 ; ADR 0070) — l'espace documents
// d'un évènement : un dossier, un document rangé, une nouvelle version, l'aperçu sans
// téléchargement ; le partage avec les clients (portail), pas avec le prestataire ; un lien de
// partage qui n'ouvre que son document, compté au fil d'activité, puis révoqué sans rien révéler.
// En taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { addEventVendorSlot, addVendorCandidate, attachEventDocument, createEventLink, createProspect, createProspectSource } from "../modules/events/service";
import { readyOrganization, signIn as signInByLink } from "./helpers";

const PASSWORD = "mot-de-passe-doc01-e2e";
const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");
const SECOND_PDF = Buffer.from("%PDF-1.4\n% version 2\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");
const NO_RIGHTS = { rubrics: [], budgetScope: "all" as const, sharedSlotIds: [] };

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Mariage de Léa : un lien client sans rubrique, un traiteur consulté avec son lien.
async function wedding(options: { document?: boolean } = {}) {
  const email = `planner-doc01-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const owner = await createUser(db, { organizationId: organization.id, email, password: PASSWORD, role: "owner" });
    const organizationId = organization.id;
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }], eventDate: "2027-06-12" });
    const slot = await addEventVendorSlot(organizationId, event.id, "Traiteur");
    const vendor = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: slot.id, vendorName: "Traiteur Karim" });
    const couple = await createEventLink({ organizationId, eventId: event.id, createdByUserId: owner.id, audience: "client", locale: "fr", link: { personName: "Léa", email: `${randomUUID()}@symbola.test`, rights: NO_RIGHTS } });
    const caterer = await createEventLink({
      organizationId,
      eventId: event.id,
      createdByUserId: owner.id,
      audience: "vendor",
      vendorCandidateId: vendor.id,
      locale: "fr",
      link: { personName: "Karim", email: `${randomUUID()}@symbola.test`, rights: NO_RIGHTS },
    });
    if (options.document) await attachEventDocument({ organizationId, eventId: event.id, label: "Plan de table", content: new Uint8Array(TINY_PDF), uploadedByUserId: owner.id });
    return { email, organizationId, eventId: event.id, coupleUrl: couple.url, catererUrl: caterer.url };
  } finally {
    await sql.end();
  }
}

async function openDocumentsTab(page: Page, eventId: string) {
  await page.goto(`/events/${eventId}?onglet=documents`);
  await expect(page.getByRole("heading", { name: "Documents de l'événement" })).toBeVisible();
}

async function openManage(page: Page, label: string) {
  const details = page.locator("details.document-manage").filter({ has: page.locator("summary", { hasText: `Gérer « ${label} »` }) });
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) await details.locator("summary").click();
  return details;
}

test("DOC-01 — l'espace documents : un dossier, un document rangé, une nouvelle version ; l'aperçu s'affiche sans téléchargement", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await signInByLink(page, setup.email, /\/$/);
  await openDocumentsTab(page, setup.eventId);

  // Un dossier « Plans ».
  await page.locator("details.document-folders > summary").click();
  await page.getByLabel("Nouveau dossier").fill("Plans");
  await page.getByRole("button", { name: "Créer le dossier" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Dossier créé." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plans", exact: true })).toBeVisible();

  // Le plan de table, déposé dans « Plans ».
  await page.getByLabel("Intitulé").fill("Plan de table");
  await page.getByLabel("Dossier", { exact: true }).selectOption({ label: "Plans" });
  await page.getByLabel("Fichier (PDF ou image, 20 Mo au plus)").setInputFiles({ name: "plan.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
  await page.getByRole("button", { name: "Envoyer le document" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Document ajouté." })).toBeVisible();
  const plans = page.getByRole("region", { name: "Plans" });
  await expect(plans).toContainText("Plan de table");
  await expect(plans).toContainText("version 1");
  await expect(plans).toContainText("non partagé");

  // L'aperçu : le PDF à afficher, dans un nouvel onglet ; le téléchargement, à part.
  const preview = plans.getByRole("link", { name: "Aperçu de « Plan de table » (nouvel onglet)" });
  await expect(preview).toHaveAttribute("target", "_blank");
  const shown = await page.request.get((await preview.getAttribute("href"))!);
  expect([shown.status(), shown.headers()["content-type"], shown.headers()["content-disposition"]?.split(";")[0]]).toEqual([200, "application/pdf", "inline"]);
  const saved = await page.request.get((await plans.getByRole("link", { name: "Télécharger « Plan de table »" }).getAttribute("href"))!);
  expect(saved.headers()["content-disposition"]?.split(";")[0]).toBe("attachment");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  // Une nouvelle version : la dernière se voit, la précédente reste consultable.
  const manage = await openManage(page, "Plan de table");
  await manage.getByLabel("Nouvelle version de « Plan de table » (PDF ou image, 20 Mo au plus)").setInputFiles({ name: "plan-v2.pdf", mimeType: "application/pdf", buffer: SECOND_PDF });
  await manage.getByRole("button", { name: "Déposer la nouvelle version" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Nouvelle version déposée." })).toBeVisible();
  await expect(plans).toContainText("version 2");
  const versions = (await openManage(page, "Plan de table")).getByRole("region", { name: "Versions de « Plan de table »" });
  await expect(versions.getByRole("listitem")).toHaveCount(2);
  const first = await page.request.get((await versions.getByRole("link", { name: "Aperçu de « Plan de table, version 1 » (nouvel onglet)" }).getAttribute("href"))!);
  expect(Buffer.from(await first.body()).equals(TINY_PDF)).toBe(true);
  // Next.js 15.5.29 retire Content-Length des réponses des routes (GHSA-pc58-hwjq-p385) :
  // on compare le contenu servi, pas sa taille annoncée.
  const latest = await page.request.get((await preview.getAttribute("href"))!);
  expect(Buffer.from(await latest.body()).equals(SECOND_PDF)).toBe(true);
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);
});

test("POR-10 / POR-04 / DOC-04 — partagé avec les clients, au portail seulement ; un lien de partage n'ouvre que son document, puis révoqué ne révèle rien", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const setup = await wedding({ document: true });
  const viewport = page.viewportSize();
  const couple = await (await browser.newContext({ locale: "fr-FR", viewport })).newPage();
  const caterer = await (await browser.newContext({ locale: "fr-FR", viewport })).newPage();
  const stranger = await (await browser.newContext({ locale: "fr-FR", viewport })).newPage();

  // Rien n'est partagé par défaut (POR-10).
  await couple.goto(setup.coupleUrl);
  await expect(couple).toHaveURL(/\/portail$/);
  await expect(couple.getByRole("region", { name: "Documents" })).toHaveCount(0);

  // La planner le partage avec les clients.
  await signInByLink(page, setup.email, /\/$/);
  await openDocumentsTab(page, setup.eventId);
  const manage = await openManage(page, "Plan de table");
  await manage.getByLabel("Avec les clients de l'évènement (leur portail)").check();
  await manage.getByRole("button", { name: "Enregistrer le partage" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Partage enregistré." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Divers" })).toContainText("partagé avec les clients");

  // Au portail : le document, à afficher ou à télécharger. Pas chez le prestataire.
  await couple.reload();
  const shared = couple.getByRole("region", { name: "Documents" });
  await expect(shared).toContainText("Plan de table");
  const shown = await couple.request.get((await shared.getByRole("link", { name: "Aperçu de « Plan de table » (nouvel onglet)" }).getAttribute("href"))!);
  expect([shown.status(), shown.headers()["content-disposition"]?.split(";")[0]]).toEqual([200, "inline"]);
  await expectNoAxeViolation(couple);
  await expectNoHorizontalScroll(couple);
  await caterer.goto(setup.catererUrl);
  await expect(caterer).toHaveURL(/\/prestataire$/);
  await expect(caterer.getByRole("region", { name: "Documents" })).toHaveCount(0);

  // Un lien de partage de 3 jours.
  const links = (await openManage(page, "Plan de table")).getByRole("region", { name: "Liens de partage de « Plan de table »" });
  await links.getByLabel("Durée d'un nouveau lien pour « Plan de table », en jours").fill("3");
  await links.getByRole("button", { name: "Créer un lien de partage" }).click();
  await expect(links.getByRole("status")).toContainText("Lien créé, valable jusqu'au");
  const url = await links.getByLabel("Adresse du lien, à envoyer vous-même").inputValue();
  expect(url).toMatch(new RegExp(`/partage#${setup.organizationId}\\.[A-Za-z0-9_-]{43}$`));
  await expectNoAxeViolation(page);

  // La personne sans lien personnel : le nom du document, puis le document seul.
  await stranger.goto(url);
  await expect(stranger.getByRole("heading", { name: "Un document a été partagé avec vous" })).toBeVisible();
  await expect(stranger.getByRole("main")).toContainText("Plan de table");
  expect(stranger.url()).not.toContain("#");
  await expectNoAxeViolation(stranger);
  await expectNoHorizontalScroll(stranger);
  const [file] = await Promise.all([
    stranger.waitForResponse((response) => response.url().endsWith("/partage/fichier") && response.request().method() === "POST"),
    stranger.getByRole("button", { name: "Ouvrir le document" }).click(),
  ]);
  expect([file.status(), file.headers()["content-type"], file.headers()["content-disposition"]?.split(";")[0]]).toEqual([200, "application/pdf", "inline"]);

  // L'ouverture est comptée, et au fil d'activité de la fiche.
  await openDocumentsTab(page, setup.eventId);
  await expect((await openManage(page, "Plan de table")).getByRole("region", { name: "Liens de partage de « Plan de table »" })).toContainText("ouvert 1 fois");
  await page.goto(`/events/${setup.eventId}`);
  await expect(page.getByRole("list", { name: "Fil d'activité" })).toContainText("Lien de partage ouvert : « Plan de table ».");

  // Révoqué : la même réponse qu'un lien inconnu, sans nom de fichier ni d'évènement.
  await openDocumentsTab(page, setup.eventId);
  await (await openManage(page, "Plan de table")).getByRole("button", { name: "Révoquer le lien" }).click();
  await expect((await openManage(page, "Plan de table")).getByRole("region", { name: "Liens de partage de « Plan de table »" })).toContainText("Révoqué");
  for (const address of [url, url.replace(/#.*$/, `#${setup.organizationId}.${"A".repeat(43)}`)]) {
    await stranger.goto("about:blank");
    await stranger.goto(address);
    await expect(stranger.getByRole("heading", { name: "Ce lien n'est plus valable" })).toBeVisible();
    await expect(stranger.getByRole("main")).not.toContainText("Plan de table");
    await expect(stranger.getByRole("main")).not.toContainText("Léa");
  }
  await expectNoAxeViolation(stranger);
});
