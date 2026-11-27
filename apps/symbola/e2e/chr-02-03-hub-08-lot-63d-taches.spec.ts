// Lot 63d (CHR-02, CHR-03, HUB-08, BUD-11, UX-07 ; recette du 21/11/2026, maquettes M3 et M6) — les
// tâches agissent sur la ligne (« Fait » annulable, sélection et actions groupées, « Changer la date »,
// « Supprimer » annulable, panneau de la tâche : ligne type du lot 70c), la même dans la fiche ; les
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
import { feedback, readyOrganization, signIn } from "./helpers";

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
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], eventDate: inDays(200) });
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

// Lot 70c : la ligne type remplace le tableau (une ligne de liste, plus une rangée).
const row = (page: Page, label: string) => page.locator(".task-line").filter({ has: page.getByRole("link", { name: label, exact: true }) });

test("CHR-02, UX-07 — tâches : « Fait » annulable, sélection et actions groupées, « Changer la date », panneau, « Supprimer » annulable ; la même ligne dans la fiche", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await wedding();
  await signIn(page, setup.email);
  await page.goto("/taches");
  await expect(page.getByRole("button", { name: "Sélectionner" })).toBeVisible();
  await expectNoAxeViolation(page);

  // SC-03, étape 3 : une tâche cochée par erreur s'annule.
  await row(page, "Envoyer le questionnaire").getByRole("button", { name: /^Fait/ }).click();
  const undo = feedback(page).filter({ hasText: "Envoyer le questionnaire" });
  await undo.getByRole("button", { name: "Annuler" }).click();
  await expect(row(page, "Envoyer le questionnaire").getByRole("button", { name: /^Fait/ })).toBeVisible();

  // Lot 70c (M2) : « Sélectionner » montre les cases ; deux tâches rangées d'un coup dans « Prestataires ».
  await page.getByRole("button", { name: "Sélectionner" }).click();
  await page.getByRole("checkbox", { name: "Choisir « Envoyer le questionnaire »" }).check();
  await page.getByRole("checkbox", { name: "Choisir « Confirmer le menu »" }).check();
  const bulk = page.getByRole("form", { name: "Actions sur les tâches sélectionnées" });
  await expect(bulk).toContainText("2 tâches sélectionnées");
  await bulk.getByText("Catégorie", { exact: true }).first().click();
  await bulk.getByLabel("Catégorie").selectOption({ label: "Prestataires" });
  await bulk.getByRole("button", { name: "Appliquer" }).last().click();
  await expect(feedback(page).filter({ hasText: "Catégorie changée pour 2 tâches." })).toBeVisible();
  await page.getByRole("button", { name: "Terminer" }).click();

  // « Changer la date… » : « Demain », la date est écrite dans le petit panneau.
  const tomorrow = formatShortCalendarDate(inDays(1), "fr");
  await row(page, "Préparer la facture d'acompte").getByRole("button", { name: "Autres actions pour « Préparer la facture d'acompte »" }).click();
  await page.getByRole("menuitem", { name: /^Changer la date…/ }).click();
  await page.getByRole("dialog", { name: "Changer la date" }).getByRole("button", { name: new RegExp(`^Demain ${tomorrow}`) }).click();
  await expect(row(page, "Préparer la facture d'acompte")).toContainText(tomorrow);

  // Le panneau de la tâche : prioritaire, enregistrée, la ligne le dit.
  await page.getByRole("link", { name: "Confirmer le menu", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Confirmer le menu" });
  await expect(panel.getByLabel(/^Tâche/)).toHaveValue("Confirmer le menu");
  await expect(panel.getByLabel("Catégorie")).toHaveValue(/.+/);
  await expect(panel).toContainText("* obligatoire");
  await expectNoAxeViolation(page);
  await panel.getByLabel("Prioritaire").check();
  await panel.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(row(page, "Confirmer le menu")).toContainText("Prioritaire");

  // « Supprimer », dans le menu, agit tout de suite ; « Annuler » la rend.
  await row(page, "Confirmer le menu").getByRole("button", { name: "Autres actions pour « Confirmer le menu »" }).click();
  await page.getByRole("menuitem", { name: /^Supprimer/ }).click();
  const banner = feedback(page).filter({ hasText: "Tâche supprimée" });
  await expect(row(page, "Confirmer le menu")).toHaveCount(0);
  await banner.getByRole("button", { name: "Annuler" }).click();
  await expect(feedback(page).filter({ hasText: "C'est rétabli" })).toBeVisible();
  await page.reload();
  await expect(row(page, "Confirmer le menu")).toContainText("Prioritaire");

  // L'onglet « Tâches » de la fiche emploie la même ligne et le même panneau.
  await page.goto(`/events/${setup.eventId}?onglet=taches`);
  await expect(row(page, "Confirmer le menu")).toContainText("Prioritaire");
  await page.getByRole("link", { name: "Confirmer le menu", exact: true }).click();
  const eventPanel = page.getByRole("dialog", { name: "Confirmer le menu" });
  await expect(eventPanel.getByRole("heading", { name: "Commentaires" })).toBeVisible();
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
