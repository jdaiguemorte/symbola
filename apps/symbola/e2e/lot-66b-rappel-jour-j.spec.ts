// Lot 66b (JRJ-01, HUB-28 ; D2 à D4 ; M18 ; ADR 0112) — Paramètres › Automatisations › Rappel du jour J :
// la planner cochée au départ, la veille à 18 h ; cocher les prestataires et changer leur heure ; sur un
// évènement (onglet Programme), couper le rappel pour cet évènement, puis revenir au réglage de
// l'organisation. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { createProspect, createProspectSource, listDayReminderOverrides } from "../modules/events/service";
import { listDayReminderTargets } from "../modules/hub/service";
import AxeBuilder from "./axe";
import { readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 640) return;
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    const email = `planner-66b-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-66b", role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-06-12" });
    return { organizationId, email, eventId: event.id };
  } finally {
    await sql.end();
  }
}

test("JRJ-01 — Lot 66b : le rappel du jour J, réglé pour l'organisation puis pour un évènement", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelier();
  await signIn(page, setup.email);
  await page.goto("/parametres/automatisations");
  await page.getByRole("link", { name: "Régler le rappel du jour J ›" }).click();
  await expect(page.getByRole("heading", { name: "Rappel du jour J", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Envoyer à : Vous (la planner)")).toBeChecked();
  await expect(page.getByLabel("Envoyer à : Prestataires retenus")).not.toBeChecked();
  await expect(page.getByLabel("Quand, pour : Vous (la planner)")).toHaveValue("eve");
  await expect(page.getByLabel("Heure, pour : Vous (la planner)")).toHaveValue("18:00");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  await page.getByLabel("Envoyer à : Prestataires retenus").check();
  await page.getByLabel("Heure, pour : Prestataires retenus").selectOption("17:30");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Rappel du jour J enregistré.");
  await expect.poll(async () => (await listDayReminderTargets(setup.organizationId)).find((setting) => setting.target === "vendors")).toEqual({ target: "vendors", enabled: true, moment: "eve", sendTime: "17:30" });

  // Sur l'évènement : ce qui partira, puis couper le rappel de la planner pour cet évènement.
  await page.goto(`/events/${setup.eventId}?onglet=programme`);
  const card = page.getByRole("region", { name: "Rappel du jour J" });
  await expect(card.getByRole("listitem")).toHaveText(["Vous (la planner) : la veille à 18:00", "Prestataires retenus : la veille à 17:30"]);
  await card.getByText("Changer pour cet évènement").click();
  await card.getByLabel("Envoyer à : Vous (la planner)").uncheck();
  await card.getByRole("button", { name: "Enregistrer pour cet évènement" }).click();
  await expect(card.getByRole("status")).toHaveText("Rappel enregistré pour cet évènement.");
  await expect.poll(async () => (await listDayReminderOverrides(setup.organizationId, setup.eventId)).map((setting) => [setting.target, setting.enabled])).toEqual([["planner", false]]);
  await page.reload();
  await expect(page.getByRole("region", { name: "Rappel du jour J" }).getByRole("listitem")).toHaveText(["Prestataires retenus : la veille à 17:30"]);
  await expect(page.getByRole("region", { name: "Rappel du jour J" })).toContainText("Réglé pour cet évènement.");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  await page.getByRole("region", { name: "Rappel du jour J" }).getByText("Changer pour cet évènement").click();
  await page.getByRole("button", { name: "Revenir au réglage de l'organisation" }).click();
  await expect.poll(async () => (await listDayReminderOverrides(setup.organizationId, setup.eventId)).length).toBe(0);
});
