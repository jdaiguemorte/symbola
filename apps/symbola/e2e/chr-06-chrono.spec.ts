// Lot 30b (CHR-06 ; décisions D6 à D8, UX-07) — le chrono à la minute sur la fiche : les
// durées et les heures de fin se calculent seules (une fin absente vaut la suivante) ; la
// durée saisie donne la fin ; le responsable se propose parmi ceux déjà saisis ; changer
// l'heure de début d'une séquence propose de décaler les suivantes, en un clic, annulable
// dix secondes. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
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
  // Lot 62c (UX-13) : une ligne par séquence ; « début fin durée » se lit dans ses trois premières cases.
  const list = page.getByRole("table", { name: "Programme du jour J" });
  const row = (label: string) => list.getByRole("row").filter({ has: page.locator("strong", { hasText: new RegExp(`^${label}$`) }) });
  const times = async (label: string) => (await row(label).locator(".program-start, .program-end, .program-duration").allTextContents()).filter(Boolean).join(" ");
  await expect.poll(() => times("Cérémonie laïque")).toBe("15:30 16:15 45 min");
  await expect(row("Cérémonie laïque")).toContainText("Responsable : Camille");
  await expect.poll(() => times("Cocktail")).toBe("17:00 19:00 2 h");
  await expect.poll(() => times("Dîner")).toBe("19:00 22:00 3 h");
  await expect.poll(() => times("Soirée dansante")).toBe("22:00");

  // À la saisie, la durée donne l'heure de fin ; le responsable se propose.
  await page.getByRole("button", { name: "Ajouter une séquence" }).click();
  const form = page.getByRole("group", { name: "Modifier la ligne Nouvelle séquence" });
  await form.getByLabel("Début", { exact: true }).fill("12:00");
  await form.getByLabel("Séquence", { exact: true }).fill("Déjeuner de l'équipe");
  await form.getByLabel("Durée (min)").fill("45");
  await expect(form.getByLabel("Fin", { exact: true })).toHaveValue("12:45");
  await expect(page.locator("#program-responsible-options option")).toHaveCount(2);
  await form.getByLabel("Responsable (facultatif)").fill("Camille");
  await page.getByRole("button", { name: "Enregistrer le programme" }).click();
  await expect(page.getByText("Programme enregistré : 1 ligne.")).toBeVisible();
  await expect.poll(() => times("Déjeuner de l'équipe")).toBe("12:00 12:45 45 min");
  await expect(row("Déjeuner de l'équipe")).toContainText("Responsable : Camille");

  // La cérémonie commence 20 min plus tard : la durée suit, puis la fiche propose de
  // décaler les trois séquences suivantes (pas le déjeuner, qui la précède).
  await page.getByRole("button", { name: "Modifier la ligne Cérémonie laïque" }).click();
  const edit = page.getByRole("group", { name: "Modifier la ligne Cérémonie laïque" });
  await edit.getByLabel("Début", { exact: true }).fill("15:50");
  await expect(edit.getByLabel("Fin", { exact: true })).toHaveValue("16:35");
  await page.getByRole("button", { name: "Enregistrer le programme" }).click();
  const proposal = page.getByRole("button", { name: "Décaler aussi les 3 séquences suivantes de 20 min" });
  await expect(proposal).toBeVisible();
  await expect.poll(() => times("Cérémonie laïque")).toBe("15:50 16:35 45 min");
  await expectNoAxeViolation(page);

  await proposal.click();
  await expect(page.getByRole("status").filter({ hasText: "Les 3 séquences suivantes sont décalées de 20 min." })).toBeVisible();
  await expect.poll(() => times("Cocktail")).toBe("17:20 19:20 2 h");
  await expect.poll(() => times("Soirée dansante")).toBe("22:20");
  await expect.poll(() => times("Déjeuner de l'équipe")).toBe("12:00 12:45 45 min");
  expect(new URL(page.url()).searchParams.get("decalage")).toBeNull();

  // « Annuler » pendant dix secondes : les séquences reprennent leurs heures.
  await page.getByRole("button", { name: /^Annuler \(\d+ s\)$/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Décalage annulé" })).toBeVisible();
  await expect.poll(() => times("Cocktail")).toBe("17:00 19:00 2 h");
  await expect.poll(() => times("Soirée dansante")).toBe("22:00");
  await expect.poll(() => times("Cérémonie laïque")).toBe("15:50 16:35 45 min");
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
  const list = page.getByRole("table", { name: "Programme du jour J" });
  const row = (label: string) => list.getByRole("row").filter({ has: page.locator("strong", { hasText: new RegExp(`^${label}$`) }) });
  const times = async (label: string) => (await row(label).locator(".program-start, .program-end, .program-duration").allTextContents()).filter(Boolean).join(" ");

  await page.getByRole("button", { name: "Modifier la ligne Cocktail" }).click();
  const edit = page.getByRole("group", { name: "Modifier la ligne Cocktail" });
  await edit.getByLabel("Début", { exact: true }).fill("16:45");
  await page.getByRole("button", { name: "Enregistrer le programme" }).click();
  await page.getByRole("button", { name: "Avancer aussi les 2 séquences suivantes de 15 min" }).click();
  await expect.poll(() => times("Dîner")).toBe("18:45 21:45 3 h");
  const undo = page.getByRole("button", { name: /^Annuler \(\d+ s\)$/ });
  await expect(undo).toBeVisible();
  await expect(undo).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: "Les 2 séquences suivantes sont avancées de 15 min." })).toBeVisible();
  await expect.poll(() => times("Dîner")).toBe("18:45 21:45 3 h");
});
