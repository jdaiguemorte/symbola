// Lot 37b (CHR-07, DAT-14, DOC-12 ; décisions D8 à D12 ; ADR 0071) — le programme diffusé : la
// planner diffuse une version numérotée, voit ce qui a changé, garde les versions consultables ; le
// prestataire lit ses séquences et le déroulé du jour dans la dernière version diffusée, sans note
// interne ni autre intervenant, et une nouvelle version lui est signalée une fois ; le client lit la
// même version. Puis Paramètres › Stockage : le relevé du mois, par nature, réservé à la titulaire.
// En taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import {
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  attachEventDocument,
  createEventLink,
  createProspect,
  createProspectSource,
  publishEventProgram,
  updateProgramItem,
} from "../modules/events/service";
import { takeStorageSnapshots } from "../lib/storage-snapshots";
import { readyOrganization, signIn as signInByLink } from "./helpers";

const PASSWORD = "mot-de-passe-programme-e2e";
const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");
const PROGRAM_ONLY = { rubrics: ["program" as const], budgetScope: "all" as const, sharedSlotIds: [] };

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Mariage de Léa : un traiteur et un photographe consultés, deux séquences (avec notes internes),
// le lien du traiteur et celui de Léa (rubrique Programme).
async function wedding() {
  const email = `planner-chr07-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const owner = await createUser(db, { organizationId: organization.id, email, password: PASSWORD, role: "owner" });
    const organizationId = organization.id;
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }], eventDate: "2027-06-12" });
    const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
    const photographer = await addEventVendorSlot(organizationId, event.id, "Photographe");
    const karim = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: "Traiteur Karim" });
    await addProgramItem(organizationId, event.id, { startTime: "15:00", endTime: "16:30", label: "Cérémonie", location: "Jardin", internalNote: "Alliances chez le témoin", vendorSlotIds: [photographer.id], freeParticipants: ["Officiant"] });
    const dinner = await addProgramItem(organizationId, event.id, { startTime: "20:00", label: "Dîner", location: "Orangerie", internalNote: "Allergies : table 4", vendorSlotIds: [caterer.id], freeParticipants: [] });
    const couple = await createEventLink({ organizationId, eventId: event.id, createdByUserId: owner.id, audience: "client", locale: "fr", link: { personName: "Léa", email: `${randomUUID()}@symbola.test`, rights: PROGRAM_ONLY } });
    const karimLink = await createEventLink({
      organizationId,
      eventId: event.id,
      createdByUserId: owner.id,
      audience: "vendor",
      vendorCandidateId: karim.id,
      locale: "fr",
      link: { personName: "Karim", email: `${randomUUID()}@symbola.test`, rights: { rubrics: [], budgetScope: "all", sharedSlotIds: [] } },
    });
    return { email, ownerId: owner.id, organizationId, eventId: event.id, catererSlotId: caterer.id, dinnerId: dinner.id, coupleUrl: couple.url, catererUrl: karimLink.url };
  } finally {
    await sql.end();
  }
}

test("CHR-07 / DAT-14 — diffuser le programme : une version numérotée, ce qui a changé, les versions gardées ; le prestataire et le client lisent la version diffusée", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const setup = await wedding();
  const viewport = page.viewportSize();
  await signInByLink(page, setup.email, /\/$/);
  await page.goto(`/events/${setup.eventId}?onglet=programme`);
  const publication = page.getByRole("region", { name: "Diffusion aux clients et aux prestataires" });
  await expect(publication).toContainText("Pas encore diffusé");

  // Rien n'est encore diffusé : le prestataire ne voit pas le programme.
  const caterer = await (await browser.newContext({ locale: "fr-FR", viewport })).newPage();
  await caterer.goto(setup.catererUrl);
  await expect(caterer).toHaveURL(/\/prestataire$/);
  await expect(caterer.getByRole("region", { name: "Vos horaires" })).toContainText("Le programme n'est pas encore diffusé.");

  // Version 1.
  await publication.getByRole("button", { name: "Diffuser le programme (version 1)" }).click();
  await expect(publication.getByRole("status")).toContainText("Version 1 diffusée");
  await expect(publication).toContainText("Dernière diffusion : version 1");
  await expect(publication).toContainText("Aucun changement depuis la dernière diffusion.");
  await expect(publication.getByRole("button", { name: "Diffuser le programme (version 2)" })).toBeDisabled();
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  // Le prestataire : ses séquences en entier, le déroulé du jour en titres et horaires ; ni note
  // interne, ni autre intervenant.
  await caterer.reload();
  const own = caterer.getByRole("region", { name: "Vos horaires" });
  await expect(own).toContainText("Programme diffusé : version 1");
  await expect(own.getByRole("list", { name: "Vos horaires" })).toContainText("20:00 — Dîner — Orangerie");
  await expect(own.getByRole("list", { name: "Le déroulé du jour" })).toContainText("15:00 – 16:30 — Cérémonie");
  for (const hidden of ["Alliances", "Allergies", "Photographe", "Officiant", "Jardin"]) await expect(caterer.getByRole("main")).not.toContainText(hidden);
  await expect(own.getByRole("status")).toHaveCount(0);
  const pdf = await caterer.request.get((await own.getByRole("link", { name: "Télécharger votre programme (PDF)" }).getAttribute("href"))!);
  expect([pdf.status(), pdf.headers()["content-type"], pdf.headers()["content-disposition"]]).toEqual([200, "application/pdf", 'attachment; filename="programme-v1.pdf"']);
  await expectNoAxeViolation(caterer);
  await expectNoHorizontalScroll(caterer);

  // Une modification ne se voit chez le prestataire qu'à la diffusion suivante.
  await updateProgramItem(setup.organizationId, setup.dinnerId, { startTime: "20:30", label: "Dîner", location: "Orangerie", internalNote: "Allergies : table 4", vendorSlotIds: [setup.catererSlotId], freeParticipants: [] });
  await caterer.reload();
  await expect(own.getByRole("list", { name: "Vos horaires" })).toContainText("20:00 — Dîner");
  await page.reload();
  await expect(publication.getByRole("list", { name: "Changements depuis la version 1" })).toContainText("Séquences modifiées : Dîner");
  await publication.getByRole("button", { name: "Diffuser le programme (version 2)" }).click();
  await expect(publication.getByRole("status")).toContainText("Version 2 diffusée");

  // La nouvelle version est signalée une fois au prestataire.
  await caterer.reload();
  await expect(own.getByRole("status")).toContainText("Nouvelle version du programme : version 2");
  await expect(own.getByRole("list", { name: "Vos horaires" })).toContainText("20:30 — Dîner");
  await caterer.reload();
  await expect(own.getByRole("status")).toHaveCount(0);

  // Les versions restent, chacune consultable telle qu'elle a été diffusée (aperçu sans téléchargement).
  await publication.locator("details.program-versions > summary").click();
  const versions = publication.getByRole("list", { name: "Versions diffusées" });
  await expect(versions.getByRole("listitem")).toHaveCount(2);
  const first = versions.getByRole("link", { name: "Aperçu de la version 1 (nouvel onglet)" });
  await expect(first).toHaveAttribute("target", "_blank");
  const shown = await page.request.get((await first.getAttribute("href"))!);
  expect([shown.status(), shown.headers()["content-type"], shown.headers()["content-disposition"]?.split(";")[0]]).toEqual([200, "application/pdf", "inline"]);
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  // Le client lit la même version.
  const couple = await (await browser.newContext({ locale: "fr-FR", viewport })).newPage();
  await couple.goto(setup.coupleUrl);
  await expect(couple).toHaveURL(/\/portail$/);
  const program = couple.getByRole("region", { name: "Programme du jour J" });
  await expect(program).toContainText("Programme diffusé : version 2");
  await expect(program).toContainText("20:30 — Dîner");
  await expect(couple.getByRole("main")).not.toContainText("Allergies");
  await expectNoAxeViolation(couple);
  await expectNoHorizontalScroll(couple);
});

test("DOC-12 — Paramètres › Stockage : le relevé du mois par nature, réservé à la titulaire", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await attachEventDocument({ organizationId: setup.organizationId, eventId: setup.eventId, label: "Plan de table", content: new Uint8Array(TINY_PDF), uploadedByUserId: setup.ownerId });
  await publishEventProgram({ organizationId: setup.organizationId, eventId: setup.eventId, userId: setup.ownerId });
  await takeStorageSnapshots({ organizationIds: [setup.organizationId] });

  await signInByLink(page, setup.email, /\/$/);
  await page.goto("/parametres/stockage");
  await expect(page.getByRole("heading", { name: "Stockage", level: 1 })).toBeVisible();
  const latest = page.getByRole("region", { name: "Relevé par nature" });
  await expect(latest.getByRole("row", { name: /Dépôts/ })).toContainText("1");
  await expect(latest.getByRole("row", { name: /Originaux légaux/ })).toContainText("0");
  await expect(page.getByRole("main")).not.toContainText("Plan de table");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  // Une collaboratrice n'y a pas accès.
  const memberEmail = `member-chr07-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    await createUser(db, { organizationId: setup.organizationId, email: memberEmail, password: PASSWORD, role: "member" });
  } finally {
    await sql.end();
  }
  const member = await (await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() })).newPage();
  await signInByLink(member, memberEmail, /\/$/);
  await member.goto("/parametres/stockage");
  await expect(member.getByRole("main")).toContainText("Le relevé du stockage est réservé à la titulaire du compte.");
  await expect(member.getByRole("region", { name: "Relevé par nature" })).toHaveCount(0);
});
