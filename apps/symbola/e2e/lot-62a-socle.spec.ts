// Lot 62a — socle de l'ergonomie d'ensemble (UX-13, NFR-19). Annuler un rendez-vous est un bouton de
// danger, plus un bouton principal ; une réservation qui échoue s'affiche en erreur, plus en vert ;
// les lignes de formulaire rangent leurs champs à gauche (types de repas, programme, paramètres des
// devis, jour J, plan de table) ; la liste des évènements tient en 375 px. En taille ordinateur et
// en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { createProspect, createProspectSource } from "../modules/events/service";
import { setModuleEnabled } from "../modules/hub/service";
import { clickMenuLink, openEventTab, readyOrganization, signIn } from "./helpers";

const MAILPIT_API = "http://localhost:8025/api/v1";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

/** La couleur d'un jeton de DESIGN.md, telle que le navigateur la calcule. */
async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((variable) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--color-${variable})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}

const style = (locator: Locator, property: "backgroundColor" | "borderTopColor" | "color" | "flexDirection") =>
  locator.evaluate((element, name) => getComputedStyle(element)[name], property);

async function expectDangerButton(page: Page, button: Locator) {
  const critical = await token(page, "critical");
  expect(await style(button, "color")).toBe(critical);
  expect(await style(button, "borderTopColor")).toBe(critical);
  expect(await style(button, "backgroundColor")).toBe(await token(page, "surface"));
  expect(await style(button, "backgroundColor")).not.toBe(await token(page, "primary"));
}

async function expectErrorNotice(page: Page, notice: Locator) {
  await expect(notice).toContainText(/^Erreur :/);
  expect(await style(notice, "backgroundColor")).toBe(await token(page, "critical-soft"));
  expect(await style(notice, "color")).toBe(await token(page, "critical"));
}

/** Une ligne de formulaire : en ligne, son premier champ contre le bord gauche (et non le droit). */
async function expectRowFromTheLeft(form: Locator) {
  await expect(form).toBeVisible();
  expect(await style(form, "flexDirection")).toBe("row");
  const gap = await form.evaluate((element) => {
    const field = element.querySelector('label, input:not([type="hidden"]), select, button, p');
    return field ? field.getBoundingClientRect().left - element.getBoundingClientRect().left : Number.NaN;
  });
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(24);
}

/** Ouvre les blocs repliés (« Renommer… », « Préparer les listes ») : leurs formulaires se voient. */
async function openDetails(page: Page) {
  await page.evaluate(() => document.querySelectorAll<HTMLDetailsElement>("main details").forEach((details) => (details.open = true)));
}

async function atelier(modules: ("appointments" | "guests")[]) {
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    for (const moduleKey of modules) await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId: organization.id, moduleKey, enabled: true });
    const email = `planner-lot62a-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    const names = [
      ["Léa", "Martin-Deschamps"],
      ["Anne-Charlotte", "de La Rochefoucauld"],
      ["Inès", "Benali"],
    ] as const;
    const events = [];
    for (const [index, [firstName, lastName]] of names.entries()) {
      events.push(
        await createProspect({
          organizationId: organization.id,
          createdByUserId: owner.id,
          prospectSourceId: source.id,
          clients: [
            { firstName, lastName },
            { firstName: "Maxime", lastName: "Lefèvre-Saint-Germain" },
          ],
          eventDate: `2027-09-${18 + index}`,
        }),
      );
    }
    return { email, organizationId: organization.id, eventId: events[0]!.id, slug: `atelier-${randomUUID().slice(0, 8)}` };
  } finally {
    await sql.end();
  }
}

async function latestMail(to: string): Promise<{ Text: string }> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const { messages } = (await (await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string }[] };
    if (messages[0]) return (await (await fetch(`${MAILPIT_API}/message/${messages[0].ID}`)).json()) as { Text: string };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("e-mail attendu");
}

test("UX-13 — Une réservation qui échoue est un message d'erreur ; annuler un rendez-vous est un bouton de danger", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const { email, slug } = await atelier(["appointments"]);
  await signIn(page, email, /\/$/);
  await clickMenuLink(page, "Rendez-vous");
  await page.getByRole("link", { name: "Commencer" }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Premier rendez-vous");
  await page.getByRole("combobox", { name: "Durée" }).selectOption("60");
  await page.getByRole("button", { name: "Créer le type" }).click();
  await expect(page.getByRole("status")).toContainText("Type créé");
  await page.getByLabel("Adresse de la page").fill(slug);
  await page.getByRole("button", { name: "Enregistrer la page" }).click();
  await expect(page.getByRole("status")).toContainText("Page de réservation enregistrée.");

  // Deux personnes ouvrent la page ; la première réserve le premier créneau, la seconde le demande
  // ensuite : sa réservation échoue.
  const visitors = await browser.newContext({ viewport: page.viewportSize(), locale: "fr-FR" });
  const lea = await visitors.newPage();
  const hugo = await visitors.newPage();
  const leaEmail = `lea-${randomUUID()}@symbola.test`;
  for (const visitor of [lea, hugo]) {
    await visitor.goto(`/reserver/${slug}`);
    await expect(visitor.getByRole("heading", { level: 1, name: "Premier rendez-vous" })).toBeVisible();
  }
  // Lot 64 (M8, M9) : une heure, « Suivant », les coordonnées, le récapitulatif.
  const book = async (visitor: typeof lea, name: string, mail: string) => {
    await visitor.locator("button.booking-time").first().click();
    await visitor.getByRole("button", { name: /^Suivant, créneau du/ }).click();
    await visitor.getByLabel("Votre nom").fill(name);
    await visitor.getByLabel("Votre e-mail").fill(mail);
    await visitor.getByRole("button", { name: "Continuer" }).click();
    await visitor.getByRole("button", { name: "Réserver ce rendez-vous" }).click();
  };
  await book(lea, "Léa Martin", leaEmail);
  await expect(lea.getByRole("heading", { name: "Votre rendez-vous est confirmé" })).toBeVisible();

  await book(hugo, "Hugo Bernard", `hugo-${randomUUID()}@symbola.test`);
  const refusal = hugo.getByRole("alert").filter({ hasText: "Erreur" });
  await expect(refusal).toBeVisible();
  await expectErrorNotice(hugo, refusal);
  await expectNoHorizontalScroll(hugo);
  await expectNoAxeViolation(hugo);

  // Léa annule par son lien : « Confirmer l'annulation » est un bouton de danger.
  const confirmation = await latestMail(leaEmail);
  const link = /https?:\/\/\S+\/rdv#\S+/.exec(confirmation.Text)![0];
  await lea.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(lea).toHaveURL(/\/rdv$/);
  await lea.getByRole("button", { name: "Annuler", exact: true }).click();
  const confirmCancel = lea.getByRole("button", { name: "Confirmer l'annulation" });
  await expectDangerButton(lea, confirmCancel);
  await expectNoAxeViolation(lea);
  await visitors.close();

  // Camille annule depuis la fiche du rendez-vous : un bouton de danger, plus un bouton principal.
  await page.goto("/rendez-vous");
  await page.getByRole("link", { name: /Premier rendez-vous/ }).first().click();
  const cancel = page.getByRole("button", { name: "Annuler le rendez-vous" });
  await expectDangerButton(page, cancel);
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolation(page);
  await cancel.click();
  await expect(page.getByRole("status")).toContainText("Rendez-vous annulé");
});

test("UX-13 — Une ligne de formulaire range ses champs à gauche", async ({ page }) => {
  test.setTimeout(180_000);
  const { email, eventId } = await atelier(["guests"]);
  await signIn(page, email, /\/$/);

  // Types de repas : « Ajouter ». Lot 62b : un formulaire en ligne (« form-inline ») ; « Renommer »
  // est devenu une action de la ligne du tableau.
  await page.goto("/events/parametres/repas");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await openDetails(page);
  for (const form of await page.locator("main form.form-inline").all()) await expectRowFromTheLeft(form);
  expect(await page.locator("main form.form-inline").count()).toBeGreaterThan(0);
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolation(page);

  // Programme d'un évènement : les lieux et les contacts du jour J.
  await page.goto(`/events/${eventId}`);
  await openEventTab(page, "Programme");
  await openDetails(page);
  // Lot 62c : ces deux formulaires sont des formulaires en ligne (« form-inline »).
  for (const form of await page.locator(".places form.form-inline").all()) await expectRowFromTheLeft(form);
  expect(await page.locator(".places form.form-inline").count()).toBeGreaterThan(0);
  await expectNoHorizontalScroll(page);

  // Paramètres des devis : un nouveau moyen de paiement.
  await page.goto("/devis/parametres");
  // Lot 62b : le formulaire d'ajout est un formulaire en ligne (« form-inline »).
  await expectRowFromTheLeft(page.locator('section[aria-labelledby="payment-methods-title"] form.form-inline'));
  await expectNoHorizontalScroll(page);
});

test("NFR-19 — La liste des évènements tient dans la largeur de l'écran", async ({ page }) => {
  test.setTimeout(120_000);
  const { email } = await atelier([]);
  await signIn(page, email, /\/$/);
  await page.goto("/events");
  await expect(page.getByRole("heading", { level: 1, name: "Événements" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Anne-Charlotte/ })).toBeVisible();
  await expectNoHorizontalScroll(page);
  // La liste et la charge des douze prochains mois restent dans l'écran : un tableau plus large que
  // sa zone y défile, sans élargir la page (la charge sortait de sa carte, de 266 px en 375 px).
  const width = page.viewportSize()!.width;
  for (const name of ["Liste des événements", "Charge par mois, en tableau"]) {
    const region = page.getByRole("region", { name });
    await expect(region).toBeVisible();
    const box = (await region.boundingBox())!;
    expect(box.x + box.width, name).toBeLessThanOrEqual(width);
  }
  const loadTable = (await page.getByRole("region", { name: "Charge par mois, en tableau" }).getByRole("table").boundingBox())!;
  expect(loadTable.x + loadTable.width).toBeLessThanOrEqual(width);
  await expectNoAxeViolation(page);
});
