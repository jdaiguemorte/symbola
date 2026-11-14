// Lot 30a (JRJ-01, JRJ-03, UX-05 ; décisions D2 à D5) — le mode Jour J : à une heure
// simulée du jour J, « Maintenant » et « Ensuite » ; l'appel du traiteur de la séquence en
// cours en un toucher depuis la barre du bas ; l'annuaire (urgences, contacts du jour J,
// prestataires) avec appel et SMS ; en mode avion aussi. Cibles de 56 px à 360 px,
// axe-core. Sur la fiche : un contact du jour J s'ajoute et se retire.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { parisToday } from "@symbola/i18n";
import { expect, test, type Page } from "@playwright/test";
import {
  addEventDayContact,
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  changeEventStatus,
  createProspect,
  createProspectSource,
  updateVendorCandidate,
} from "../modules/events/service";
import { createVendor } from "../modules/vendors/service";
import { parisMidnight } from "../lib/offline/day-copy";
import { openEventTab, readyOrganization, signIn as signInByLink } from "./helpers";

const PASSWORD = "mot-de-passe-terrain-e2e";

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Instant d'une heure du jour J, à Paris (pas de changement d'heure dans la journée).
function parisTime(date: string, hours: number, minutes: number): Date {
  return new Date(parisMidnight(date).getTime() + (hours * 60 + minutes) * 60_000);
}

async function login(page: Page, email: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, /\/$/);
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// UX-05 : toute cible visible (lien, bouton, sommaire) mesure au moins `min` px de côté.
async function expectTouchTargets(page: Page, min: number) {
  const small = await page.evaluate((size) => {
    const out: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("a[href], button, summary")) {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (box.width === 0 || box.height === 0 || style.visibility === "hidden" || style.display === "none") continue;
      if (box.width < size || box.height < size) out.push(`${element.tagName} « ${element.textContent?.trim().slice(0, 40)} » ${Math.round(box.width)}×${Math.round(box.height)}`);
    }
    return out;
  }, min);
  expect(small).toEqual([]);
}

// Mariage demain : cérémonie (fleurs), cocktail (traiteur, Maison Ruche, avec téléphone),
// dîner sans heure de fin ; un contact du jour J.
async function wedding() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    const email = `planner-terrain-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const eventDate = addDays(parisToday(), 1);
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Hugo" }], eventDate });
    await changeEventStatus({ organizationId, eventId: event.id, changedByUserId: owner.id, toStatus: "confirmed" });
    const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
    const flowers = await addEventVendorSlot(organizationId, event.id, "Fleurs");
    const { vendor } = await createVendor(organizationId, { name: "Maison Ruche", typeId: null, contactName: "Karim Haddad", phone: "06 12 34 56 78" });
    const ruche = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: "Maison Ruche", vendorId: vendor.id });
    await updateVendorCandidate({ organizationId, candidateId: ruche.id, status: "retained", changedByUserId: owner.id });
    await addProgramItem(organizationId, event.id, { startTime: "15:30", endTime: "16:15", label: "Cérémonie laïque", location: "Jardin", vendorSlotIds: [flowers.id], freeParticipants: ["Officiante"] });
    await addProgramItem(organizationId, event.id, { startTime: "17:00", endTime: "19:00", label: "Cocktail", location: "Terrasse", internalNote: "Champagne au frais à 16:30", vendorSlotIds: [caterer.id], freeParticipants: [] });
    await addProgramItem(organizationId, event.id, { startTime: "19:00", label: "Dîner", location: "Grande salle", vendorSlotIds: [caterer.id], freeParticipants: [] });
    await addEventDayContact(organizationId, event.id, { name: "Hélène Vasseur", role: "Régisseuse du domaine", phone: "01 99 00 01 00" });
    return { email, eventId: event.id, eventDate };
  } finally {
    await sql.end();
  }
}

test("JRJ-01 / JRJ-03 / SC-08 étapes 1 et 2 — à 17:20 le jour J : Maintenant le cocktail, Ensuite le dîner ; le traiteur à un toucher, en mode avion aussi", async ({ page, context }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await login(page, setup.email);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.clock.setFixedTime(parisTime(setup.eventDate, 17, 20));
  await page.goto(`/jour-j/${setup.eventId}`);

  const cards = page.getByRole("region", { name: "Maintenant et ensuite" });
  const now = cards.getByRole("article", { name: "Maintenant" });
  await expect(now.locator(".field-now")).toHaveText("Cocktail");
  await expect(now).toContainText("17:00 – 19:00 · 2 h");
  await expect(now).toContainText("Terrasse");
  await expect(now).toContainText("Champagne au frais à 16:30");
  await expect(now).toContainText("Encore 1 h 40");
  const next = cards.getByRole("article", { name: "Ensuite" });
  await expect(next).toContainText("Dîner");
  await expect(next).toContainText("À 19:00, dans 1 h 40");

  // Le contact de la séquence en cours, à un toucher : sur la carte et dans la barre du bas.
  const bar = page.getByRole("navigation", { name: "Jour J" });
  await expect(bar.getByRole("link", { name: "Appeler Maison Ruche au 06 12 34 56 78" })).toHaveAttribute("href", "tel:0612345678");
  await expect(now.getByRole("link", { name: "Appeler Maison Ruche au 06 12 34 56 78" })).toBeVisible();

  // L'annuaire : urgences (appel, SMS pour le 114), contact du jour J, prestataire.
  await bar.getByRole("link", { name: "Contacts" }).click();
  const contacts = page.getByRole("region", { name: "Contacts" });
  await expect(contacts.getByRole("link", { name: "Appeler SAMU au 15" })).toHaveAttribute("href", "tel:15");
  await expect(contacts.getByRole("link", { name: /^Écrire à Urgences par SMS .* au 114$/ })).toHaveAttribute("href", "sms:114");
  await expect(contacts.getByRole("link", { name: "Appeler Hélène Vasseur au 01 99 00 01 00" })).toHaveAttribute("href", "tel:0199000100");
  await expect(contacts.getByRole("link", { name: "Écrire à Hélène Vasseur au 01 99 00 01 00" })).toHaveAttribute("href", "sms:0199000100");
  await expect(contacts).toContainText("Régisseuse du domaine");

  // Programme : les durées se calculent, une fin absente vaut minuit pour la dernière.
  await expect(page.getByRole("region", { name: "Programme du jour" })).toContainText("15:30 – 16:15");
  await expect(page.getByRole("region", { name: "Programme du jour" })).toContainText("45 min");

  await expectTouchTargets(page, 56);
  await expectNoAxeViolation(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // Gardé, puis en mode avion : « Maintenant » se calcule sur l'appareil.
  await page.getByRole("button", { name: "Garder sur cet appareil" }).click();
  await expect(page.getByRole("status")).toContainText("Prêt hors ligne");
  // Gardé, l'écran gagne « Retirer de cet appareil » ; l'aide ouverte reste en thème nuit.
  await expectTouchTargets(page, 56);
  await page.getByRole("button", { name: "Aide sur cet écran" }).click();
  await expect(page.locator(".landmark-panel")).toBeVisible();
  await expectTouchTargets(page, 56);
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Aide sur cet écran" }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("article", { name: "Maintenant" }).locator(".field-now")).toHaveText("Cocktail");
  await expect(page.getByRole("navigation", { name: "Jour J" }).getByRole("link", { name: "Appeler Maison Ruche au 06 12 34 56 78" })).toBeVisible();
  await context.setOffline(false);
});

test("JRJ-01 (D2) — la veille, entre deux séquences, après la dernière", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await login(page, setup.email);
  const nowCard = () => page.getByRole("article", { name: "Maintenant" });

  await page.clock.setFixedTime(parisTime(addDays(setup.eventDate, -1), 20, 0));
  await page.goto(`/jour-j/${setup.eventId}`);
  await expect(nowCard().locator(".field-now")).toHaveText("Le jour J, c'est demain");
  await expect(page.getByRole("article", { name: "Ensuite" })).toContainText("Cérémonie laïque");

  await page.clock.setFixedTime(parisTime(setup.eventDate, 16, 40));
  await page.reload();
  await expect(nowCard().locator(".field-now")).toHaveText("Pause");
  await expect(nowCard()).toContainText("Reprise à 17:00");
  await expect(page.getByRole("navigation", { name: "Jour J" }).getByRole("link", { name: /^Appeler / })).toHaveCount(0);

  await page.clock.setFixedTime(parisTime(addDays(setup.eventDate, 1), 0, 30));
  await page.reload();
  await expect(nowCard().locator(".field-now")).toHaveText("Programme terminé");
});

test("JRJ-03 (D4) — sur la fiche, un contact du jour J s'ajoute et se retire", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await login(page, setup.email);
  await page.goto(`/events/${setup.eventId}`);
  await openEventTab(page, "Programme");
  const section = page.getByRole("region", { name: "Contacts du jour J" });
  await section.getByLabel("Nom").fill("Taxi Périgord");
  await section.getByLabel("Rôle (facultatif)").fill("Navette de nuit");
  await section.getByLabel("Téléphone").fill("05 53 00 00 00");
  await section.getByRole("button", { name: "Ajouter le contact" }).click();
  await expect(section.getByRole("status")).toHaveText("Contact ajouté.");
  await expect(section).toContainText("Taxi Périgord — Navette de nuit — 05 53 00 00 00");
  await expectNoAxeViolation(page);

  await section.getByLabel("Téléphone").fill("pas un numéro");
  await section.getByLabel("Nom").fill("Intrus");
  await section.getByRole("button", { name: "Ajouter le contact" }).click();
  await expect(section.getByRole("alert")).toContainText("Donnez un numéro de téléphone");

  await section.getByRole("button", { name: "Retirer « Taxi Périgord »" }).click();
  await expect(section).not.toContainText("Taxi Périgord");
});
