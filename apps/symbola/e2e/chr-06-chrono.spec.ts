// Lot 30b (CHR-06 ; décisions D6 à D8, UX-07) — le chrono à la minute sur la fiche : les
// durées et les heures de fin se calculent seules (une fin absente vaut la suivante) ; la
// durée saisie donne la fin ; le responsable se propose parmi ceux déjà saisis ; changer
// l'heure de début d'une séquence propose de décaler les suivantes, en un clic, annulable
// dix secondes. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { addProgramItem, createProspect, createProspectSource } from "../modules/events/service";
import { openEventTab, readyOrganization, signIn as signInByLink } from "./helpers";

const PASSWORD = "mot-de-passe-terrain-e2e";

async function login(page: Page, email: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, /\/$/);
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function wedding() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    const email = `planner-chrono-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }], eventDate: "2027-06-12" });
    const line = (startTime: string, label: string, extra: Partial<Parameters<typeof addProgramItem>[2]> = {}) =>
      addProgramItem(organizationId, event.id, { startTime, label, vendorSlotIds: [], freeParticipants: [], ...extra });
    await line("15:30", "Cérémonie laïque", { endTime: "16:15", responsible: "Camille" });
    await line("17:00", "Cocktail", { endTime: "19:00", responsible: "Le domaine" });
    await line("19:00", "Dîner");
    await line("22:00", "Soirée dansante");
    return { email, eventId: event.id };
  } finally {
    await sql.end();
  }
}

test("CHR-06 — durées calculées, durée saisie, responsable proposé ; décalage des séquences suivantes proposé, fait puis annulé", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await login(page, setup.email);
  await page.goto(`/events/${setup.eventId}`);
  await openEventTab(page, "Programme");

  // Les durées et les heures de fin se calculent seules.
  const list = page.getByRole("list", { name: "Programme du jour J" });
  const row = (label: string) => list.getByRole("listitem").filter({ hasText: label });
  await expect(row("Cérémonie laïque")).toContainText("15:30 – 16:15 · 45 min");
  await expect(row("Cérémonie laïque")).toContainText("Responsable : Camille");
  await expect(row("Cocktail")).toContainText("17:00 – 19:00 · 2 h");
  await expect(row("Dîner")).toContainText("19:00 – 22:00 · 3 h");
  await expect(row("Soirée dansante")).toContainText("22:00");
  await expect(row("Soirée dansante").locator(".program-time")).toHaveText("22:00");

  // À la saisie, la durée donne l'heure de fin ; le responsable se propose.
  const form = page.locator("form").filter({ has: page.getByRole("group", { name: "Nouvelle ligne du programme" }) });
  await form.getByLabel("Heure de début").fill("12:00");
  await form.getByLabel("Intitulé de la ligne").fill("Déjeuner de l'équipe");
  await form.getByLabel("Durée en minutes (facultative)").fill("45");
  await expect(form.getByLabel("Heure de fin (facultative)")).toHaveValue("12:45");
  await expect(page.locator("#program-responsible-options option")).toHaveCount(2);
  await form.getByLabel("Responsable (facultatif)").fill("Camille");
  await form.getByRole("button", { name: "Ajouter la ligne" }).click();
  await expect(row("Déjeuner de l'équipe")).toContainText("12:00 – 12:45 · 45 min");
  await expect(row("Déjeuner de l'équipe")).toContainText("Responsable : Camille");

  // La cérémonie commence 20 min plus tard : la durée suit, puis la fiche propose de
  // décaler les trois séquences suivantes (pas le déjeuner, qui la précède).
  await row("Cérémonie laïque").locator("summary").click();
  const edit = row("Cérémonie laïque").locator("details[open] form");
  await edit.getByLabel("Heure de début").fill("15:50");
  await expect(edit.getByLabel("Heure de fin (facultative)")).toHaveValue("16:35");
  await edit.getByRole("button", { name: "Enregistrer la ligne" }).click();
  const proposal = page.getByRole("button", { name: "Décaler aussi les 3 séquences suivantes de 20 min" });
  await expect(proposal).toBeVisible();
  await expect(row("Cérémonie laïque")).toContainText("15:50 – 16:35 · 45 min");
  await expectNoAxeViolation(page);

  await proposal.click();
  await expect(page.getByRole("status").filter({ hasText: "Les 3 séquences suivantes sont décalées de 20 min." })).toBeVisible();
  await expect(row("Cocktail")).toContainText("17:20 – 19:20 · 2 h");
  await expect(row("Soirée dansante").locator(".program-time")).toHaveText("22:20");
  await expect(row("Déjeuner de l'équipe")).toContainText("12:00 – 12:45");
  expect(new URL(page.url()).searchParams.get("decalage")).toBeNull();

  // « Annuler » pendant dix secondes : les séquences reprennent leurs heures.
  await page.getByRole("button", { name: /^Annuler \(\d+ s\)$/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Décalage annulé" })).toBeVisible();
  await expect(row("Cocktail")).toContainText("17:00 – 19:00 · 2 h");
  await expect(row("Soirée dansante").locator(".program-time")).toHaveText("22:00");
  await expect(row("Cérémonie laïque")).toContainText("15:50 – 16:35");
  await expectNoAxeViolation(page);

  // Rechargée, la fiche ne repropose rien.
  await page.reload();
  await expect(page.getByRole("button", { name: /^Décaler aussi/ })).toHaveCount(0);
});

test("UX-07 — sans annulation, « Annuler » disparaît après dix secondes et le décalage reste", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await login(page, setup.email);
  await page.goto(`/events/${setup.eventId}`);
  await openEventTab(page, "Programme");
  const list = page.getByRole("list", { name: "Programme du jour J" });
  const row = (label: string) => list.getByRole("listitem").filter({ hasText: label });

  await row("Cocktail").locator("summary").click();
  const edit = row("Cocktail").locator("details[open] form");
  await edit.getByLabel("Heure de début").fill("16:45");
  await edit.getByRole("button", { name: "Enregistrer la ligne" }).click();
  await page.getByRole("button", { name: "Avancer aussi les 2 séquences suivantes de 15 min" }).click();
  await expect(row("Dîner")).toContainText("18:45 – 21:45 · 3 h");
  const undo = page.getByRole("button", { name: /^Annuler \(\d+ s\)$/ });
  await expect(undo).toBeVisible();
  await expect(undo).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: "Les 2 séquences suivantes sont avancées de 15 min." })).toBeVisible();
  await expect(row("Dîner")).toContainText("18:45");
});
