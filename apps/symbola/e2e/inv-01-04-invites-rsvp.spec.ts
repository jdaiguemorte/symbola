// Lot 49 — INV-01 à INV-04, INV-07, RGP-06 (scénario SC-07, personas SU-10 et SU-11), en taille
// ordinateur et en 375 px (projets de playwright.config.ts) :
// - Jeanne répond à son invitation en moins de soixante secondes, sans compte, au clavier seul ;
//   la page passe axe-core (WCAG 2.2 AA), sans champ libre ni animation, chaque champ étiqueté ;
// - la planner ouvre le module (analyse d'impact), ajoute un foyer, règle la clôture, prépare
//   l'envoi des invitations (écran de contrôle des destinataires) et voit l'aperçu d'un import ;
// - ARC-07 : sans le module Invités (ou sans Évènements), ni onglet ni rubrique ni page de
//   réponse, jamais une erreur.
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { addKeyMoment, createProspect, createProspectSource } from "../modules/events/service";
import { setModuleEnabled } from "../modules/hub/service";
import { confirmImpactAssessment, issueGuestLink, saveGuestEventSettings, saveHousehold } from "../modules/guests/service";
import { readyOrganization, signIn } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function organization(options: { guests: boolean; confirm: boolean }) {
  const email = `owner-inv-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let ownerId: string;
  try {
    organizationId = (await readyOrganization(db, `Org INV ${randomUUID().slice(0, 6)}`)).id;
    ownerId = (await createUser(db, { organizationId, email, role: "owner" })).id;
    if (options.guests) await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey: "guests", enabled: true });
  } finally {
    await sql.end();
  }
  if (options.confirm) await confirmImpactAssessment(organizationId, ownerId);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: ownerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Hugo", lastName: "Bernard" }], eventDate: "2027-06-12" });
  return { organizationId, ownerId, email, eventId: event.id };
}

// Le mariage de référence (SC-07) : trois temps forts, la clôture un mois avant.
async function wedding() {
  const org = await organization({ guests: true, confirm: true });
  await addKeyMoment(org.organizationId, org.eventId, { name: "Cérémonie laïque", date: "2027-06-12", startTime: "15:00" });
  await addKeyMoment(org.organizationId, org.eventId, { name: "Dîner", date: "2027-06-12", startTime: "20:00" });
  await addKeyMoment(org.organizationId, org.eventId, { name: "Brunch", date: "2027-06-13", startTime: "11:00" });
  await saveGuestEventSettings(org.organizationId, org.eventId, { responsesCloseOn: "2027-05-13", askDiet: true, askAccommodation: false, askTransport: false, reminderDays: [21, 7] });
  return org;
}

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("INV-03 (SU-10, SU-11) — Jeanne répond en moins d'une minute, au clavier, sans compte ; la page est accessible", async ({ page }) => {
  const org = await wedding();
  // Le foyer de Jeanne : elle et Paul, sans adresse e-mail ; son lien lui arrive par SMS.
  const householdId = await saveHousehold(org.organizationId, org.eventId, null, {
    displayName: "Jeanne et Paul Durand",
    people: [
      { kind: "adult", firstName: "Jeanne", lastName: "Durand", phone: "06 12 34 56 78" },
      { kind: "adult", firstName: "Paul", lastName: "Durand" },
    ],
  });
  expect(householdId).toBeTruthy();
  const { listHouseholds } = await import("../modules/guests/service");
  const [household] = await listHouseholds(org.organizationId, org.eventId, { kind: "owner" });
  const { url } = await issueGuestLink(org.organizationId, org.eventId, household!.people[0]!.id);

  const started = Date.now();
  await page.goto(url.replace(/^https?:\/\/[^/]+/, ""));
  await expect(page.getByRole("heading", { level: 1, name: "Léa & Hugo vous invitent à leur mariage" })).toBeVisible();
  // Le jeton a quitté l'adresse et l'historique.
  expect(page.url()).not.toContain("#");
  await expectAccessible(page);
  // Aucun champ libre (RGP-04, D11).
  await expect(page.locator("main textarea, main input[type=text], main input:not([type])")).toHaveCount(0);

  // Présence : Jeanne et Paul, aux trois temps forts (un toucher chacun), au clavier seul.
  for (const moment of ["Cérémonie laïque", "Dîner", "Brunch"]) {
    for (const name of ["Jeanne (vous)", "Paul"]) {
      const group = page.getByRole("group", { name: `${moment} — ${name}` });
      await group.getByRole("radio", { name: "Oui, présent" }).focus();
      await page.keyboard.press("Space");
    }
  }
  // Régime : la case d'accord d'abord ; sans elle, les cases sont inactives.
  const vegetarian = page.getByRole("checkbox", { name: "Végétarien" });
  await expect(vegetarian).toBeDisabled();
  await page.getByRole("checkbox", { name: /J'accepte que mes régimes/ }).focus();
  await page.keyboard.press("Space");
  await vegetarian.focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Envoyer ma réponse" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { level: 1, name: "Merci, votre réponse est enregistrée" })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(60_000);
  await expect(page.getByRole("heading", { name: "Et après ?" })).toBeVisible();
  await expect(page.getByText("Régime de Jeanne : Végétarien")).toBeVisible();
  await expectAccessible(page);
});

test("INV-01, INV-02, INV-04, INV-07 — la planner ouvre le module, ajoute un foyer, prépare les invitations et l'import", async ({ page }) => {
  const org = await organization({ guests: true, confirm: false });
  await addKeyMoment(org.organizationId, org.eventId, { name: "Dîner", date: "2027-06-12" });
  await signIn(page, org.email);

  // Partie G : l'analyse d'impact d'abord.
  await page.goto(`/events/${org.eventId}?onglet=invites`);
  await expect(page.getByRole("heading", { name: "Ouvrir le module Invités" })).toBeVisible();
  await page.getByLabel(/Je confirme avoir complété l'analyse d'impact/).check();
  await page.getByRole("button", { name: "Ouvrir le module Invités" }).click();
  await expect(page.getByRole("heading", { name: "Réponses" })).toBeVisible();
  await expectAccessible(page);

  // Un foyer : un prénom et un moyen de contact suffisent.
  await page.getByText("Ajouter un foyer", { exact: true }).first().click();
  const form = page.locator("details[open] form").first();
  await form.getByLabel("Prénom").fill("Antoine");
  await form.getByLabel("E-mail").fill(`antoine-${randomUUID().slice(0, 6)}@example.test`);
  await form.getByRole("button", { name: "Ajouter le foyer" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Antoine" })).toBeVisible();
  // Un second foyer avec une adresse : l'envoi groupé passe par l'écran de contrôle (MSG-02).
  await saveHousehold(org.organizationId, org.eventId, null, { people: [{ kind: "adult", firstName: "Camille", email: `camille-${randomUUID().slice(0, 6)}@example.test` }] });

  // Clôture des réponses, puis l'écran de contrôle avant tout envoi (MSG-02).
  await page.getByText("Réglages des réponses (clôture, questions, relances)").click();
  await page.getByLabel(/Clôture des réponses/).fill("2027-05-13");
  await page.getByRole("button", { name: "Enregistrer les réglages" }).click();
  await expect(page.getByText("Réglages enregistrés.")).toBeVisible();
  await page.getByRole("button", { name: "Préparer l'envoi de 2 invitations" }).click();
  await expect(page.getByText(/Relances prévues/)).toBeVisible();
  await expect(page.locator("#recipients-guard-title")).toBeVisible();

  // Import : l'aperçu signale la colonne de régime, rien n'est écrit avant le choix.
  await page.getByLabel("Liste d'invités (CSV ou XLSX)").setInputFiles({
    name: "invites.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Foyer;Prénom;Nom;E-mail;Régime\nMartin;Luc;Martin;luc@example.test;végétarien\n"),
  });
  await page.getByRole("button", { name: "Voir l'aperçu" }).click();
  await expect(page.getByText(/Colonne ignorée : Régime/)).toBeVisible();
  await expect(page.getByText("Rien n'est encore enregistré : vérifiez, puis importez.")).toBeVisible();
  await expectAccessible(page);
});

test("ARC-07 (lot 49) — sans le module Invités, ni onglet, ni rubrique, ni page de réponse ; jamais d'erreur", async ({ page }) => {
  const org = await wedding();
  const householdId = await saveHousehold(org.organizationId, org.eventId, null, { people: [{ kind: "adult", firstName: "Jeanne", phone: "0612345678" }] });
  expect(householdId).toBeTruthy();
  const { listHouseholds } = await import("../modules/guests/service");
  const [household] = await listHouseholds(org.organizationId, org.eventId, { kind: "owner" });
  const { url } = await issueGuestLink(org.organizationId, org.eventId, household!.people[0]!.id);
  await signIn(page, org.email);

  for (const [events, guests] of [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ] as const) {
    const { sql, db } = createAppConnection();
    try {
      await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId: org.organizationId, moduleKey: "events", enabled: events });
      await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId: org.organizationId, moduleKey: "guests", enabled: guests });
    } finally {
      await sql.end();
    }
    const combination = `[events: ${events}, guests: ${guests}]`;
    const fiche = await page.goto(`/events/${org.eventId}?onglet=invites`);
    expect(fiche!.status(), combination).toBeLessThan(500);
    // Dans la barre d'onglets seulement : sur l'onglet Invités, le filtre « Tous » de la liste mène à la même adresse.
    const tabs = page.getByRole("navigation", { name: "Sections de l'évènement" });
    await expect(tabs.locator(`a[href="/events/${org.eventId}?onglet=invites"]`), combination).toHaveCount(events && guests ? 1 : 0);
    const settings = await page.goto("/events/parametres/regimes");
    expect(settings!.status(), combination).toBeLessThan(500);
    if (!(events && guests)) await expect(page.getByText("Le module Invités n'est pas activé pour votre organisation."), combination).toBeVisible();
    await page.goto(url.replace(/^https?:\/\/[^/]+/, ""));
    await expect(page.getByRole("heading", { level: 1 }), combination).toHaveText(events && guests ? "Léa & Hugo vous invitent à leur mariage" : "Lien inconnu");
  }
});
