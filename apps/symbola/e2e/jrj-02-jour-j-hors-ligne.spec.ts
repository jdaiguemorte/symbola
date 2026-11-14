// Lot 29a (ARC-09, JRJ-02, NFR-09, UX-05 ; ADR 0064, décisions D3 à D7) — le jour J hors
// ligne : la planner ouvre l'écran du jour J depuis la fiche, le garde sur l'appareil, coupe
// le réseau : programme, lieux, contacts et PDF restent lisibles ; un autre écran mène à
// « Hors ligne ». « Retirer », la déconnexion, la connexion d'un autre compte et le lendemain
// de l'évènement effacent la copie. Tests d'abus : autre organisation, évènement non
// confirmé, Admin, lien personnel. En taille ordinateur et en 375 px, contrôle à 360 px,
// axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { parisToday } from "@symbola/i18n";
import { expect, test, type Page } from "@playwright/test";
import {
  addEventPlace,
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  changeEventStatus,
  createEventLink,
  createProspect,
  createProspectSource,
  getEvent,
  updateEventClientContact,
  updateVendorCandidate,
} from "../modules/events/service";
import { createVendor } from "../modules/vendors/service";
import { logout, readyOrganization, signIn as signInByLink } from "./helpers";

const PASSWORD = "mot-de-passe-jrj02-e2e";

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function login(page: Page, email: string, landing: RegExp = /\/$/) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, landing);
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Caches de Symbola et service worker restant sur l'appareil.
async function deviceState(page: Page) {
  return page.evaluate(async () => ({
    caches: (await caches.keys()).filter((name) => name.startsWith("symbola-")),
    workers: (await navigator.serviceWorker.getRegistrations()).length,
  }));
}

// Mariage de Léa et Hugo demain : traiteur retenu (fiche du carnet, avec ses coordonnées),
// fleuriste retenu en saisie libre, photographe encore en lice ; deux séquences, un lieu.
async function wedding(options: { status?: "confirmed" | "prospect" } = {}) {
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const organizationId = organization.id;
    const email = `planner-jrj02-${randomUUID()}@symbola.test`;
    const memberEmail = `membre-jrj02-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
    await createUser(db, { organizationId, email: memberEmail, password: PASSWORD, role: "member" });
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({
      organizationId,
      createdByUserId: owner.id,
      prospectSourceId: source.id,
      clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Hugo" }],
      eventDate: addDays(parisToday(), 1),
      venueName: "Domaine des Tilleuls",
      venueCity: "Lyon",
    });
    const lea = (await getEvent(organizationId, event.id))!.clients[0]!;
    await updateEventClientContact({ organizationId, eventId: event.id, clientId: lea.id, contact: { phone: "07 00 00 00 01" } });
    if ((options.status ?? "confirmed") === "confirmed") {
      await changeEventStatus({ organizationId, eventId: event.id, changedByUserId: owner.id, toStatus: "confirmed" });
    }
    const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
    const flowers = await addEventVendorSlot(organizationId, event.id, "Fleurs");
    const photo = await addEventVendorSlot(organizationId, event.id, "Photographe");
    const { vendor } = await createVendor(organizationId, { name: "Maison Ruche", typeId: null, contactName: "Karim Haddad", phone: "06 12 34 56 78", email: "karim@ruche.example" });
    const ruche = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: "Maison Ruche", vendorId: vendor.id });
    await updateVendorCandidate({ organizationId, candidateId: ruche.id, status: "retained", changedByUserId: owner.id });
    const verveine = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: flowers.id, vendorName: "Atelier Verveine" });
    await updateVendorCandidate({ organizationId, candidateId: verveine.id, status: "retained", changedByUserId: owner.id });
    await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: photo.id, vendorName: "Studio Lumière" });
    await addProgramItem(organizationId, event.id, { startTime: "16:00", endTime: "17:00", label: "Cérémonie laïque", location: "Jardin", internalNote: "Prévoir les parapluies", vendorSlotIds: [flowers.id], freeParticipants: ["Officiante"] });
    await addProgramItem(organizationId, event.id, { startTime: "18:00", label: "Cocktail", vendorSlotIds: [caterer.id], freeParticipants: [] });
    await addEventPlace(organizationId, event.id, { label: "Domaine des Tilleuls", address: "1 allée des Tilleuls, Lyon" });
    const clientLink = await createEventLink({
      organizationId,
      eventId: event.id,
      createdByUserId: owner.id,
      audience: "client",
      locale: "fr",
      link: { personName: "Léa", email: `lea-${randomUUID()}@symbola.test`, rights: { rubrics: ["program"], budgetScope: "all", sharedSlotIds: [] } },
    });
    return { email, memberEmail, eventId: event.id, organizationId, clientLinkUrl: clientLink.url };
  } finally {
    await sql.end();
  }
}

test("JRJ-02 / ARC-09 — gardé la veille, le jour J s'ouvre sans réseau : programme, lieux, contacts et PDF ; un autre écran mène à « Hors ligne »", async ({ page, context }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await login(page, setup.email);

  // Depuis la fiche, le bouton « Jour J ».
  await page.goto(`/events/${setup.eventId}`);
  await page.getByRole("link", { name: "Jour J", exact: true }).click();
  await expect(page).toHaveURL(`/jour-j/${setup.eventId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Léa & Hugo");
  const program = page.getByRole("region", { name: "Programme du jour" });
  await expect(program).toContainText("16:00 – 17:00");
  await expect(program).toContainText("Cérémonie laïque");
  await expect(program).toContainText("Fleurs (Atelier Verveine) · Officiante");
  await expect(program).toContainText("Note interne : Prévoir les parapluies");
  const contacts = page.getByRole("region", { name: "Contacts" });
  await expect(contacts.getByRole("link", { name: "Appeler Maison Ruche au 06 12 34 56 78" })).toHaveAttribute("href", "tel:0612345678");
  await expect(contacts).toContainText("Karim Haddad");
  await expect(contacts).toContainText("Atelier Verveine");
  await expect(contacts).not.toContainText("Studio Lumière");
  await expect(contacts.getByRole("link", { name: "Appeler Léa Martin au 07 00 00 00 01" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Lieux" })).toContainText("1 allée des Tilleuls, Lyon");
  await expect(page.getByRole("status")).toHaveText("Ce jour J n'est pas encore gardé sur cet appareil.");
  await expectNoAxeViolation(page);

  // Garder sur cet appareil.
  await page.getByRole("button", { name: "Garder sur cet appareil" }).click();
  await expect(page.getByRole("status")).toContainText("Prêt hors ligne. Mis à jour le");
  expect((await deviceState(page)).workers).toBe(1);

  // Mode avion : l'écran se recharge depuis la copie.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Léa & Hugo");
  await expect(page.getByRole("region", { name: "Programme du jour" })).toContainText("Prévoir les parapluies");
  await expect(page.getByRole("status")).toContainText("Sans réseau : vous lisez la copie du");
  await expectNoAxeViolation(page);

  // Le PDF du programme s'ouvre sans réseau.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Programme du jour (PDF)" }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);

  // Lisible à 360 px, sans défilement horizontal.
  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoHorizontalScroll(page);

  // Un autre écran, sans réseau : la page « Hors ligne » liste le jour J gardé.
  await page.goto("/events");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hors ligne");
  await page.getByRole("link", { name: /Léa & Hugo, le/ }).click();
  await expect(page).toHaveURL(`/jour-j/${setup.eventId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Léa & Hugo");
  await page.goto("/hors-ligne");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  // Retour du réseau, puis déconnexion : la copie et le service worker s'en vont.
  await context.setOffline(false);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await logout(page);
  await expect(page).toHaveURL(/\/login$/);
  expect(await deviceState(page)).toEqual({ caches: [], workers: 0 });
});

test("NFR-09 — serveur injoignable, puis session expirée : la copie s'ouvre et dit de quand elle date", async ({ page, context }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await login(page, setup.email);
  await page.goto(`/jour-j/${setup.eventId}`);
  await page.getByRole("button", { name: "Garder sur cet appareil" }).click();
  await expect(page.getByRole("status")).toContainText("Prêt hors ligne");

  // Le réseau répond, le serveur non (erreur 502 du frontal) : la copie.
  await context.route(`**/jour-j/${setup.eventId}`, (route) => route.fulfill({ status: 502, body: "Bad Gateway" }));
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Léa & Hugo");
  await expect(page.getByRole("status")).toContainText("Sans réseau : vous lisez la copie du");
  await context.unroute(`**/jour-j/${setup.eventId}`);

  // Session expirée (8 h sans activité) : la copie, et l'invitation à se reconnecter.
  await context.clearCookies();
  await page.reload();
  await expect(page).toHaveURL(`/jour-j/${setup.eventId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Léa & Hugo");
  await expect(page.getByRole("status")).toContainText("Votre session a expiré : vous lisez la copie du");
  await expect(page.getByRole("link", { name: "Se reconnecter" })).toHaveAttribute("href", "/login");
});

test("ARC-09 (D4) — « Retirer de cet appareil », un autre compte et le lendemain de l'évènement effacent la copie", async ({ page, context }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await login(page, setup.email);
  const keep = async () => {
    await page.goto(`/jour-j/${setup.eventId}`);
    await page.getByRole("button", { name: "Garder sur cet appareil" }).click();
    await expect(page.getByRole("status")).toContainText("Prêt hors ligne");
  };

  await keep();
  await page.getByRole("button", { name: "Retirer de cet appareil" }).click();
  await expect(page.getByRole("status")).toHaveText("Le jour J est retiré de cet appareil.");
  expect(await deviceState(page)).toEqual({ caches: [], workers: 0 });

  // La session expire (cookie perdu) : la copie reste ; un autre compte se connecte, elle s'efface.
  await keep();
  await context.clearCookies();
  await page.goto("/login");
  expect((await deviceState(page)).caches.length).toBeGreaterThan(0);
  await login(page, setup.memberEmail);
  await expect.poll(async () => (await deviceState(page)).caches).toEqual([]);

  // Le lendemain de l'évènement à minuit, à la première ouverture qui suit.
  await keep();
  await page.clock.setFixedTime(new Date(`${addDays(parisToday(), 3)}T08:00:00+02:00`));
  await page.goto("/");
  await expect.poll(async () => (await deviceState(page)).caches).toEqual([]);
});

test("JRJ-02 — abus : autre organisation, évènement non confirmé, Admin et lien personnel n'ouvrent pas le jour J", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const mine = await wedding();
  const other = await wedding();
  const prospect = await wedding({ status: "prospect" });
  await login(page, mine.email);

  const missing = await page.goto(`/jour-j/${randomUUID()}`);
  const missingText = await page.locator("main").innerText();
  for (const eventId of [other.eventId, prospect.eventId]) {
    const response = await page.goto(`/jour-j/${eventId}`);
    expect(response!.status()).toBe(missing!.status());
    expect(await page.locator("main").innerText()).toBe(missingText);
    expect((await page.request.get(`/jour-j/${eventId}/programme`)).status()).toBe(404);
  }
  expect(missing!.status()).toBe(404);
  await expect(page.locator("main")).not.toContainText("Léa");

  // Un lien personnel du client n'ouvre pas l'écran de l'équipe.
  const clientContext = await browser.newContext({ locale: "fr-FR" });
  const client = await clientContext.newPage();
  await client.goto(mine.clientLinkUrl);
  await expect(client).toHaveURL(/\/portail$/);
  await client.goto(`/jour-j/${mine.eventId}`);
  await expect(client).toHaveURL(/\/login$/);
  expect((await client.request.get(`/jour-j/${mine.eventId}/programme`)).status()).toBe(401);
  await clientContext.close();

  // L'Admin n'a aucune donnée métier.
  const adminEmail = `admin-jrj02-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    await createUser(db, { organizationId: null, email: adminEmail, password: PASSWORD, role: "admin" });
  } finally {
    await sql.end();
  }
  const adminContext = await browser.newContext({ locale: "fr-FR" });
  const admin = await adminContext.newPage();
  await login(admin, adminEmail, /\/exploitation/);
  await admin.goto(`/jour-j/${mine.eventId}`);
  await expect(admin).not.toHaveURL(/\/jour-j\//);
  await expect(admin.locator("body")).not.toContainText("Léa & Hugo");
  expect((await admin.request.get(`/jour-j/${mine.eventId}/programme`)).status()).toBe(401);
  await adminContext.close();
});
