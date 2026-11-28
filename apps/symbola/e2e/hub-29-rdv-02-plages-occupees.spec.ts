// Lot 64 (HUB-29, RDV-01, RDV-02 ; D1 à D8 ; maquettes M1 à M9 ; ADR 0109) — Camille règle la plage
// occupée d'un mariage (8 h à 22 h par défaut), pose pour celui de Kévin et Kévina la veille 14 h au
// lendemain 12 h et télécharge le fichier à importer ; elle ajoute une question obligatoire et une
// description à son type de rendez-vous ; Léa réserve sur la page publique, une question par écran,
// sans pouvoir passer la question obligatoire. En taille ordinateur et en 375 px, axe-core (WCAG 2.2)
// sur chaque écran, sans défilement horizontal.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { changeEventStatus, createProspect, createProspectSource, setEventType } from "../modules/events/service";
import { ensureEventTypes } from "../lib/events/event-types";
import { createAppointmentType, saveAvailabilityRules, saveBookingPage } from "../modules/appointments/service";
import { setModuleEnabled } from "../modules/hub/service";
import { openEventInfo, readyOrganization, saveEventInfo, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Atelier prêt, module Rendez-vous ouvert, un mariage confirmé (Kévin et Kévina), un type de
// rendez-vous et sa page publique.
async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId: organization.id, moduleKey: "appointments", enabled: true });
    const email = `camille-lot64-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    const wedding = await createProspect({ organizationId: organization.id, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Kévin" }, { firstName: "Kévina" }], eventDate: "2027-06-12" });
    await changeEventStatus({ organizationId: organization.id, eventId: wedding.id, changedByUserId: owner.id, toStatus: "confirmed" });
    const types = await ensureEventTypes(organization.id, "fr");
    await setEventType(organization.id, wedding.id, types.find((type) => type.starterKey === "wedding")!.id);
    const type = await createAppointmentType(organization.id, { name: "Découverte", durationMinutes: 60, minNoticeMinutes: 0 }, owner.id);
    await saveAvailabilityRules(organization.id, owner.id, [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "09:00", endTime: "18:00" })));
    const slug = `atelier-${randomUUID().slice(0, 8)}`;
    await saveBookingPage(organization.id, { slug, active: true, privacyNotice: null });
    return { email, weddingId: wedding.id, typeId: type.id, slug };
  } finally {
    await sql.end();
  }
}

test("HUB-29, RDV-01, RDV-02 — plages occupées par type et par évènement ; questions une par une sur la page de réservation", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const { email, weddingId, typeId, slug } = await atelier();
  await signIn(page, email);

  // M1, M2 : la règle du type Mariage, modifiée en fenêtre, avec l'aperçu en clair.
  await page.goto("/events/parametres/plages-occupees");
  await expect(page.getByRole("heading", { level: 1, name: "Plages occupées dans l'agenda" })).toBeVisible();
  const weddingRow = page.getByRole("row", { name: /Mariage/ });
  await expect(weddingRow).toContainText("Le jour même, 8 h → le jour même, 22 h");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Modifier la plage occupée : Mariage" }).click();
  const dialog = page.getByRole("dialog", { name: "Plage occupée — Mariage" });
  await expect(dialog).toContainText("Occupée le samedi, de 8 h à 22 h, soit 14 h.");
  await dialog.getByRole("group", { name: "Fin" }).getByLabel("Heure").fill("23:00");
  await expect(dialog).toContainText("de 8 h à 23 h, soit 15 h.");
  await expectNoAxeViolation(page);
  await dialog.getByRole("button", { name: "Enregistrer la règle" }).click();
  await expect(weddingRow).toContainText("le jour même, 23 h");

  // D2 : les options ne bloquent pas, sauf réglage.
  const optionsSwitch = page.getByRole("switch", { name: "Les options bloquent aussi mon agenda" });
  await expect(optionsSwitch).toHaveAttribute("aria-checked", "false");

  // M3, M4 : le mariage de Kévin et Kévina, de la veille 14 h au lendemain 12 h.
  // Lot 72e : la plage se lit sur la ligne « Agenda » d'« Informations » et se règle dans la rubrique
  // « Date et lieux » de « Modifier les informations ».
  await page.goto(`/events/${weddingId}`);
  const agenda = page.locator('.overview-info-row[data-key="busy"] dd');
  await expect(agenda).toContainText("samedi 12 juin 2027, de 8 h à 23 h");
  await expectNoAxeViolation(page);
  let info = await openEventInfo(page, "Date et lieux");
  await expect(info.getByRole("radio", { name: "Selon le type de l'évènement" })).toBeChecked();
  await info.getByRole("radio", { name: "Régler pour cet évènement" }).check();
  await info.getByRole("group", { name: "Début" }).getByLabel("Jour").selectOption("-1");
  await info.getByRole("group", { name: "Début" }).getByLabel("Heure").fill("14:00");
  await info.getByRole("group", { name: "Fin" }).getByLabel("Jour").selectOption("1");
  await info.getByRole("group", { name: "Fin" }).getByLabel("Heure").fill("12:00");
  await expect(info).toContainText("soit 46 h.");
  await saveEventInfo(page);
  await expect(agenda).toContainText("Du vendredi 11 juin 2027, 14 h, au dimanche 13 juin 2027, 12 h");
  const file = await page.request.get(`/events/${weddingId}/agenda`);
  expect(file.status()).toBe(200);
  const ics = await file.text();
  expect(ics).toContain("DTSTART:20270611T120000Z");
  expect(ics).toContain("TRANSP:OPAQUE");
  await agenda.getByRole("button", { name: "Ajouter à mon agenda" }).click();
  await expect(page.getByRole("dialog", { name: "Ajouter à mon agenda" })).toContainText("ne suit pas les changements");
  await expectNoAxeViolation(page);
  await page.keyboard.press("Escape");
  // Revenir à la règle du type.
  info = await openEventInfo(page, "Date et lieux");
  await expect(info.getByRole("radio", { name: "Régler pour cet évènement" })).toBeChecked();
  await info.getByRole("radio", { name: "Selon le type de l'évènement" }).check();
  await saveEventInfo(page);
  await expect(agenda).toContainText("samedi 12 juin 2027, de 8 h à 23 h");

  // M7 (D7, D8) : une description et une question obligatoire à choix.
  await page.goto(`/rendez-vous/reglages/types/${typeId}`);
  await page.getByLabel("Description (facultative)").fill("Faisons connaissance : vos envies, votre date.");
  await page.getByRole("button", { name: "+ Ajouter une question" }).click();
  await page.getByRole("textbox", { name: "Question", exact: true }).fill("Combien d'invités ?");
  await page.getByRole("radio", { name: "Un choix" }).click();
  for (const choice of ["Moins de 50", "50 à 100"]) {
    await page.getByLabel("Nouveau choix").fill(choice);
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  }
  await page.getByLabel("Obligatoire : le client doit répondre pour réserver").check();
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Enregistrer le type" }).click();
  await expect(page.getByRole("status")).toContainText("Type enregistré");
  await expect(page.getByText("Combien d'invités ?")).toBeVisible();

  // M8, M9 : Léa réserve, une étape à la fois ; la question obligatoire ne se passe pas.
  const visitor = await browser.newContext({ viewport: page.viewportSize(), locale: "fr-FR" });
  const lea = await visitor.newPage();
  await lea.goto(`/reserver/${slug}`);
  await expect(lea.getByText("Faisons connaissance : vos envies, votre date.")).toBeVisible();
  await expectNoAxeViolation(lea);
  await expectNoHorizontalScroll(lea);
  await lea.locator("button.booking-time").first().click();
  await lea.getByRole("button", { name: /^Suivant, créneau du/ }).click();
  await lea.getByLabel("Votre nom").fill("Léa Martin");
  await lea.getByLabel("Votre e-mail").fill(`lea-${randomUUID()}@symbola.test`);
  await lea.getByRole("button", { name: "Continuer" }).click();
  await expect(lea.getByRole("heading", { name: /Combien d'invités \?/ })).toBeFocused();
  await expect(lea.getByRole("button", { name: "Passer" })).toHaveCount(0);
  await expectNoAxeViolation(lea);
  await lea.keyboard.press("b");
  await expect(lea.getByRole("heading", { name: "Vérifiez et réservez" })).toBeVisible();
  await expect(lea.locator(".booking-recap")).toContainText("50 à 100");
  await lea.getByRole("button", { name: "Réserver ce rendez-vous" }).click();
  await expect(lea.getByRole("heading", { name: "Votre rendez-vous est confirmé" })).toBeVisible();
  await expectNoAxeViolation(lea);
  await visitor.close();
});
