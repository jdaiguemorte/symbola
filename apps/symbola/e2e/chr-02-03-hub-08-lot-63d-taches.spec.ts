// Lot 63d (CHR-02, CHR-03, HUB-08, BUD-11, UX-07 ; recette du 21/11/2026, maquettes M3 et M6) — le
// tableau des tâches agit sur la ligne (rond « Fait » annulable, sélection et actions groupées,
// « Reporter », « Supprimer » annulable, fenêtre de la tâche), le même dans le rétroplanning ; les
// catégories se règlent dans les Paramètres ; « Aujourd'hui » montre le calendrier du mois (la semaine
// en cours sur téléphone), échéances de paiement comprises. En taille ordinateur et en 375 px, avec axe-core.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { formatShortCalendarDate, parisToday } from "@symbola/i18n";
import AxeBuilder from "./axe";
import { addDefaultVendorSlots, addEventTask, createProspect, createProspectSource, listEventVendorSlots } from "../modules/events/service";
import { addBudgetLine, addVendorPayment } from "../modules/budget/service";
import { postponedDueDate } from "../lib/tasks/postpone";
import { readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;

function inDays(days: number): string {
  const date = new Date(`${parisToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function wedding() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    const email = `planner-63d-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-lot-63d", role: "owner" });
    await addDefaultVendorSlots(organizationId, ["Traiteur", "Musique"]);
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], eventDate: inDays(200), applyTemplate: false });
    for (const [label, days] of [
      ["Envoyer le questionnaire", 0],
      ["Confirmer le menu", 2],
      ["Préparer la facture d'acompte", 5],
    ] as const) {
      await addEventTask(organizationId, event.id, { label, dueDate: inDays(days), responsible: "planner" });
    }
    const slot = (await listEventVendorSlots(organizationId, event.id)).find((entry) => entry.label === "Musique")!;
    const view = await addBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId: slot.id, label: "DJ" });
    const line = view.lines.find((entry) => entry.label === "DJ")!;
    await addVendorPayment({ organizationId, eventId: event.id, lineId: line.id, label: "Solde", fixedAmountCents: 90000, dueOn: parisToday(), changedByUserId: owner.id });
    return { organizationId, email, eventId: event.id };
  } finally {
    await sql.end();
  }
}

const row = (page: Page, label: string) => page.getByRole("row", { name: new RegExp(label) });

test("CHR-02, UX-07 — tâches : rond « Fait » annulable, actions groupées, « Reporter », fenêtre, « Supprimer » annulable ; le même tableau dans le rétroplanning", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await wedding();
  await signIn(page, setup.email);
  await page.goto("/taches");
  await expect(page.getByRole("checkbox", { name: "Tout sélectionner" })).toBeVisible();
  await expectNoAxeViolation(page);

  // SC-03, étape 3 : une tâche cochée par erreur s'annule.
  await page.getByRole("button", { name: "Marquer « Envoyer le questionnaire » comme faite" }).click();
  const undo = page.getByRole("status").filter({ hasText: "Envoyer le questionnaire" });
  await undo.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("button", { name: "Marquer « Envoyer le questionnaire » comme faite" })).toBeVisible();

  // Deux tâches choisies, rangées d'un coup dans « Prestataires ».
  await page.getByRole("checkbox", { name: "Sélectionner « Envoyer le questionnaire »" }).check();
  await page.getByRole("checkbox", { name: "Sélectionner « Confirmer le menu »" }).check();
  const bulk = page.getByRole("form", { name: "Actions sur les tâches sélectionnées" });
  await expect(bulk).toContainText("2 tâches sélectionnées");
  await bulk.getByText("Catégorie", { exact: true }).first().click();
  await bulk.getByLabel("Catégorie").selectOption({ label: "Prestataires" });
  await bulk.getByRole("button", { name: "Appliquer" }).last().click();
  await expect(page.getByRole("status").filter({ hasText: "Catégorie changée pour 2 tâches." })).toBeVisible();
  await expect(row(page, "Confirmer le menu")).toContainText("Prestataires");

  // « Reporter » : à demain, la date est écrite dans le menu.
  const tomorrow = formatShortCalendarDate(postponedDueDate("tomorrow"), "fr");
  await page.getByText("Reporter", { exact: true }).nth(2).click();
  await page.getByRole("button", { name: `Demain (${tomorrow})` }).click();
  await expect(row(page, "Préparer la facture")).toContainText(tomorrow);

  // La fenêtre de la tâche : priorité haute, enregistrée, la ligne le dit.
  await page.getByRole("link", { name: "Modifier « Confirmer le menu »" }).click();
  const window = page.getByRole("dialog", { name: "Modifier la tâche" });
  await expect(window.getByLabel(/^Tâche/)).toHaveValue("Confirmer le menu");
  await expect(window).toContainText("* obligatoire");
  await expectNoAxeViolation(page);
  await window.getByLabel("Priorité").selectOption("high");
  await window.getByRole("button", { name: "Enregistrer" }).click();
  await expect(window).toHaveCount(0);
  await expect(row(page, "Confirmer le menu")).toContainText("Haute");

  // « Supprimer » agit tout de suite ; « Annuler » la rend.
  await page.getByRole("button", { name: "Supprimer « Confirmer le menu »" }).click();
  const banner = page.getByRole("status").filter({ hasText: "Tâche supprimée." });
  await expect(row(page, "Confirmer le menu")).toHaveCount(0);
  await banner.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText("C'est rétabli.")).toBeVisible();
  await page.reload();
  await expect(row(page, "Confirmer le menu")).toContainText("Prestataires");

  // Le rétroplanning de l'évènement emploie le même tableau.
  await page.goto(`/events/${setup.eventId}?onglet=retroplanning`);
  await expect(page.getByRole("checkbox", { name: "Tout sélectionner" })).toBeVisible();
  await expect(row(page, "Confirmer le menu")).toContainText("Haute");
  await page.getByRole("link", { name: "Confirmer le menu", exact: true }).click();
  const retroWindow = page.getByRole("dialog", { name: "Modifier la tâche" });
  await expect(retroWindow.getByRole("heading", { name: "Commentaires de l'équipe" })).toBeVisible();
  await expectNoAxeViolation(page);
});

test("CHR-03, HUB-20 — catégories des tâches : celles de départ, ajout, dans les Paramètres des évènements", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await signIn(page, setup.email);
  await page.goto("/events/parametres/taches");
  await expect(page.getByRole("heading", { level: 1, name: "Catégories des tâches" })).toBeVisible();
  for (const label of ["Client", "Prestataires", "Administratif", "Jour J"]) await expect(page.getByLabel(`Nom de la catégorie ${label}`)).toHaveValue(label);
  const add = page.getByRole("region", { name: "Ajouter la catégorie" });
  await add.getByLabel("Nom de la catégorie").fill("Mairie");
  await add.getByLabel("Couleur").selectOption({ label: "Vert" });
  await add.getByRole("button", { name: "Ajouter la catégorie" }).click();
  await expect(page.getByLabel("Nom de la catégorie Mairie")).toHaveValue("Mairie");
  await expectNoAxeViolation(page);
});

test("HUB-08, BUD-11 — « Aujourd'hui » : le calendrier du mois avec tâches et échéances de paiement ; la semaine en cours sur téléphone", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await signIn(page, setup.email);
  await page.goto("/");
  if (isPhone(page)) {
    const week = page.getByRole("list", { name: "La semaine en cours" });
    await expect(week).toContainText("Envoyer le questionnaire");
    await expect(week).toContainText("Solde DJ");
    await expect(week).toContainText("Paiements");
  } else {
    const month = page.getByRole("table", { name: "Calendrier du mois" });
    await expect(month).toContainText("Envoyer le questionnaire");
    await page.locator(".calendar-day.is-today button.calendar-day-num").click();
    const day = page.getByRole("dialog");
    await expect(day).toContainText("Solde DJ");
    await expect(day).toContainText("Paiements");
    await expectNoAxeViolation(page);
    await day.getByRole("button", { name: "Fermer" }).click();
  }
  await expectNoAxeViolation(page);
});
