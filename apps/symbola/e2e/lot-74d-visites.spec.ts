// Lot 74d (D2 de l'audit, B10 à B12, B17, C-02, C-06 ; L74-D9 ; page 25 des maquettes du lot 68) — les
// visites proposées, pas imposées : seule celle de l'accueil s'ouvre d'elle-même, une fois, après
// l'assistant ; ailleurs, la ligne « Découvrir cet écran en 1 minute » aux trois premières venues sur un
// écran rempli, jusqu'à « Lancer » ou « Fermer » ; une croix à chaque bulle, Échap ; chaque bulle encadre
// un élément visible à 1 440, 911 × 512 et 375 px ; « Tâches » a sa visite ; la préférence coupée retire
// la ligne et la visite de l'accueil. En taille ordinateur et en 375 px, axe-core sur la bulle.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { withActor } from "@symbola/db/actor";
import { createAppConnection } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import { addEventTask, changeEventStatus, createProspect, createProspectSource } from "../modules/events/service";
import { recordHelpProgress } from "../modules/hub/service";
import { createVendor } from "../modules/vendors/service";
import { helpPanel, readyOrganization, signIn, tourDialog } from "./helpers";

// Les visites sont proposées dans ce parcours : sans la préférence « 0 » posée pour les autres.
test.use({ storageState: { cookies: [], origins: [] } });

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Un atelier rempli : un mariage signé avec ses tâches. La visite de l'accueil est déjà vue (sauf demande).
async function agency(options: { hubSeen?: boolean } = {}) {
  const email = `planner-74d-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const colleague = await createUser(db, { organizationId: organization.id, email: `collegue-74d-${randomUUID()}@symbola.test`, role: "member" });
    const source = await createProspectSource(organization.id, "Salon");
    const event = await createProspect({ organizationId: organization.id, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Morel" }, { firstName: "Maxime", lastName: "Petit" }], eventDate: "2027-06-12" });
    await changeEventStatus({ organizationId: organization.id, eventId: event.id, changedByUserId: owner.id, toStatus: "confirmed" });
    const today = parisToday();
    await withActor({ kind: "member", id: owner.id }, async () => {
      await addEventTask(organization.id, event.id, { label: "Confirmer la voiture des mariés", dueDate: addDays(today, -2), responsible: "planner", assigneeUserId: owner.id });
      await addEventTask(organization.id, event.id, { label: "Choisir le fleuriste", dueDate: addDays(today, 3), responsible: "planner", assigneeUserId: owner.id });
    });
    await createVendor(organization.id, { name: "Fleurs d'Élodie", typeId: null, city: "Lille" });
    if (options.hubSeen !== false) for (const userId of [owner.id, colleague.id]) await recordHelpProgress(db, { userId, itemKey: "tour:hub", status: "completed" });
    return { email, colleagueEmail: colleague.email, ownerId: owner.id, eventId: event.id };
  } finally {
    await sql.end();
  }
}

const line = (page: Page) => page.getByRole("complementary", { name: "Visite proposée" });

// La zone encadrée par la bulle affichée : présente, visible et dans la fenêtre.
async function expectSpotInView(page: Page, label: string) {
  const spot = page.locator(".tour-spot");
  await expect(spot, label).toHaveAttribute("data-hidden", "false");
  await expect
    .poll(async () => {
      const box = await spot.boundingBox();
      const viewport = page.viewportSize()!;
      return box !== null && box.width > 0 && box.height > 0 && box.y < viewport.height && box.y + box.height > 0 && box.x < viewport.width && box.x + box.width > 0;
    }, { message: `${label} : ${JSON.stringify(await spot.boundingBox())} dans ${JSON.stringify(page.viewportSize())}, défilement ${await page.evaluate(() => window.scrollY)}` })
    .toBe(true);
}

// Joue une visite de bout en bout : chaque bulle a sa croix, aucune « Passer la visite », la zone est à
// l'écran ; « Terminer » à la dernière.
async function playTour(page: Page, screen: string, label: string): Promise<number> {
  const tour = tourDialog(page, screen);
  await expect(tour, label).toBeVisible();
  const progress = (await tour.locator(".tour-progress").textContent()) ?? "";
  const total = Number(/sur (\d+)/.exec(progress)?.[1] ?? "0");
  expect(total, `${label} : ${progress}`).toBeGreaterThanOrEqual(1);
  expect(total).toBeLessThanOrEqual(4);
  for (let index = 1; index <= total; index += 1) {
    await expect(tour).toContainText(`Visite de l'écran · ${index} sur ${total}`);
    await expect(tour.getByRole("button", { name: "Fermer la visite" })).toBeVisible();
    await expect(tour.getByRole("button", { name: "Passer la visite" })).toHaveCount(0);
    await expectSpotInView(page, `${label}, bulle ${index}`);
    await tour.getByRole("button", { name: index === total ? "Terminer" : "Suivant" }).click();
  }
  await expect(tour).toHaveCount(0);
  return total;
}

test.describe("L74-74d — Les visites proposées", () => {
  test("critère 1 — seule la visite de l'accueil s'ouvre seule, une fois, après l'assistant ; les autres écrans attendent", async ({ page }) => {
    const setup = await agency({ hubSeen: false });
    await signIn(page, setup.email, "/");
    const hub = tourDialog(page, "Aujourd'hui");
    await expect(hub).toBeVisible();
    // L'accueil rempli : la visite parle de la journée et de « Fait », sur ce que l'écran montre.
    await expect(hub.getByRole("heading", { name: "Votre journée, ici", level: 2 })).toBeFocused();
    await expectNoAxeViolation(page);
    await hub.getByRole("button", { name: "Fermer la visite" }).click();
    await expect(hub).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toBeVisible();
    await expect(hub).toHaveCount(0);
    // Ailleurs, rien ne s'ouvre seul.
    for (const [path, screen] of [["/events", "Liste des évènements"], [`/events/${setup.eventId}`, "Fiche de l'évènement"], ["/taches", "Les tâches de tous vos évènements"]] as const) {
      await page.goto(path);
      await expect(line(page), path).toBeVisible();
      await expect(tourDialog(page, screen), path).toHaveCount(0);
    }
  });

  test("critère 2 — la ligne « Découvrir » : sous l'en-tête, sans bouton plein ; « Lancer » ou « Fermer » la retirent ; trois venues au plus", async ({ page }) => {
    const setup = await agency();
    await signIn(page, setup.email, "/");
    await page.goto("/events");
    const offer = line(page);
    await expect(offer).toContainText("Première fois sur cet écran ?");
    await expect(offer.getByRole("button", { name: "Découvrir cet écran en 1 minute" })).toBeVisible();
    await expect(offer.locator(".button-primary, .button-link-primary")).toHaveCount(0);
    await expectNoAxeViolation(page);
    // Revenir dans la journée ne compte pas : la ligne reste.
    await page.reload();
    await expect(offer).toBeVisible();
    // « Fermer » : plus de ligne, même rechargé ; la visite reste sous le « ? ».
    await offer.getByRole("button", { name: "Ne plus proposer cette visite" }).click();
    await expect(offer).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toBeVisible();
    await expect(offer).toHaveCount(0);
    await page.getByRole("button", { name: "Aide sur cet écran" }).click();
    await expect(helpPanel(page, "Liste des évènements")).toContainText("Revoir la visite de cet écran");
    await page.keyboard.press("Escape");

    // « Lancer » : la visite s'ouvre, la ligne ne revient plus.
    await page.goto(`/events/${setup.eventId}`);
    await line(page).getByRole("button", { name: "Découvrir cet écran en 1 minute" }).click();
    await expect(tourDialog(page, "Fiche de l'évènement")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toBeVisible();
    await expect(line(page)).toHaveCount(0);

    // Trois venues déjà, la dernière hier : la ligne ne paraît plus (L74-D9).
    const { sql, db } = createAppConnection();
    try {
      await recordHelpProgress(db, { userId: setup.ownerId, itemKey: "tour:tasks", status: "postponed", step: 3, now: new Date(Date.now() - 26 * 3600 * 1000) });
    } finally {
      await sql.end();
    }
    await page.goto("/taches");
    await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toBeVisible();
    await expect(line(page)).toHaveCount(0);
  });

  test("critère 2 (abus) — la ligne fermée par une personne reste proposée à sa collègue", async ({ page, browser }) => {
    const setup = await agency();
    await signIn(page, setup.email, "/");
    await page.goto("/events");
    await line(page).getByRole("button", { name: "Ne plus proposer cette visite" }).click();
    await expect(line(page)).toHaveCount(0);
    // La fermeture est enregistrée : rechargée, la ligne ne revient pas pour elle.
    await expect(async () => {
      await page.reload();
      await expect(page.getByRole("link", { name: "Léa & Maxime" }).first()).toBeVisible();
      await expect(line(page)).toHaveCount(0);
    }).toPass();
    // La collègue, dans son propre navigateur.
    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const colleague = await other.newPage();
      await signIn(colleague, setup.colleagueEmail, "/");
      await colleague.goto("/events");
      await expect(colleague.getByRole("link", { name: "Léa & Maxime" }).first()).toBeVisible();
      await expect(line(colleague)).toBeVisible();
    } finally {
      await other.close();
    }
  });

  test("critères 3 et 5 — « Tâches » a sa visite : la ligne et « Fait », les filtres, « Sélectionner » ; croix, Échap, focus rendu", async ({ page }) => {
    const setup = await agency();
    await signIn(page, setup.email, "/");
    await page.goto("/taches");
    const start = line(page).getByRole("button", { name: "Découvrir cet écran en 1 minute" });
    await start.click();
    const tour = tourDialog(page, "Les tâches de tous vos évènements");
    await expect(tour).toContainText("Visite de l'écran · 1 sur 3");
    await expect(tour.getByRole("heading", { name: "La ligne et « Fait »", level: 2 })).toBeFocused();
    // Les mots de l'appareil : « Touchez » sur téléphone, « Cochez » à l'ordinateur.
    const phone = page.viewportSize()!.width < 768;
    await expect(tour).toContainText(phone ? "Touchez « Fait »" : "Cochez « Fait »");
    await expectNoAxeViolation(page);
    await tour.getByRole("button", { name: "Suivant" }).click();
    await expect(tour.getByRole("heading", { name: "Les filtres", level: 2 })).toBeVisible();
    await tour.getByRole("button", { name: "Suivant" }).click();
    await expect(tour.getByRole("heading", { name: "Plusieurs tâches d'un coup", level: 2 })).toBeVisible();
    await expect(tour.getByRole("button", { name: "Terminer" })).toBeVisible();
    await expect(tour.getByRole("button", { name: "Fermer la visite" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tour).toHaveCount(0);
    // Le focus revient au « ? », d'où la visite se relance.
    const help = page.getByRole("button", { name: "Aide sur cet écran" });
    await expect(help).toBeFocused();
    await help.click();
    const panel = helpPanel(page, "Les tâches de tous vos évènements");
    await expect(panel).toContainText("Revoir la visite de cet écran");
    await expect(panel).toContainText("3 bulles, 1 minute");
    await panel.getByRole("button", { name: "Lancer" }).click();
    await expect(tour).toBeVisible();
    await tour.getByRole("button", { name: "Fermer la visite" }).click();
    await expect(tour).toHaveCount(0);
    // Un formulaire n'a pas de visite et ne la promet pas.
    await page.goto("/events/new");
    await page.getByRole("button", { name: "Aide sur cet écran" }).click();
    await expect(page.getByRole("complementary", { name: /^Aide : / })).not.toContainText("Revoir la visite");
  });

  test("critère 4 — chaque bulle encadre un élément présent et visible, à 1 440, 911 × 512 et 375 px", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const setup = await agency();
    await signIn(page, setup.email, "/");
    const sizes = testInfo.project.name === "mobile-375" ? [{ width: 375, height: 812 }] : [{ width: 1440, height: 900 }, { width: 911, height: 512 }];
    const screens = [
      ["/?visite=revoir", "Aujourd'hui"],
      ["/events?visite=revoir", "Liste des évènements"],
      [`/events/${setup.eventId}?visite=revoir`, "Fiche de l'évènement"],
      ["/taches?visite=revoir", "Les tâches de tous vos évènements"],
      ["/prestataires?visite=revoir", "Le carnet de prestataires"],
      ["/devis/catalogue?visite=revoir", "Catalogue des prestations"],
      ["/events/parametres?visite=revoir", "Budget : postes de départ et répartition"],
    ] as const;
    for (const size of sizes) {
      await page.setViewportSize(size);
      for (const [path, screen] of screens) {
        await page.goto(path);
        const label = `${path} à ${size.width} × ${size.height}`;
        const tour = tourDialog(page, screen);
        // Un écran qui n'a rien à montrer (carnet vide) ne garde que les bulles de ce qu'il montre.
        if ((await tour.count()) === 0) await expect(tour, label).toBeVisible({ timeout: 10_000 });
        await playTour(page, screen, label);
      }
    }
  });

  test("critère 6 — la préférence coupée retire la ligne et la visite de l'accueil", async ({ page }) => {
    const setup = await agency({ hubSeen: false });
    await page.context().addCookies([{ name: "symbola_visites_auto", value: "0", url: "http://localhost" }]);
    await signIn(page, setup.email, "/");
    await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toBeVisible();
    await expect(tourDialog(page, "Aujourd'hui")).toHaveCount(0);
    await page.goto("/events");
    await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toBeVisible();
    await expect(line(page)).toHaveCount(0);
    // La visite reste sous le « ? ».
    await page.getByRole("button", { name: "Aide sur cet écran" }).click();
    await helpPanel(page, "Liste des évènements").getByRole("button", { name: "Lancer" }).click();
    await expect(tourDialog(page, "Liste des évènements")).toBeVisible();
  });
});
