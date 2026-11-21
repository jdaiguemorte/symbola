// HUB-11 (lot 63f, ADR 0104 : la visite guidée remplace les repères du lot 13) — visite de la fiche
// d'un événement : étapes dans l'ordre, la zone de chaque étape claire, Échap ; centre d'aide (état
// des visites, préférence de lancement automatique, AIDE-07). En taille
// ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { createProspect, createProspectSource } from "../modules/events/service";
import { clickAdminMenuLink, clickMenuLink, readyOrganization, signIn as signInByLink, skipTour, tourDialog } from "./helpers";
import { recordHelpProgress } from "../modules/hub/service";

// Visite lancée d'office : sans la préférence posée par la configuration.
test.use({ storageState: { cookies: [], origins: [] } });

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("HUB-11 / AIDE-07 — visite de la fiche d'un événement, et centre d'aide", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `planner-aide-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  let eventId: string;
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-aide-lot10", role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    eventId = (await createProspect({ organizationId: organization.id, createdByUserId: user.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }] })).id;
  } finally {
    await sql.end();
  }

  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email);
  await expect(page).toHaveURL("/");
  // La visite de l'accueil se lance d'elle-même ; on la passe.
  await skipTour(page, "Aujourd'hui");

  // Fiche d'un événement : cinq étapes, la première sur les onglets, éclairés.
  await page.goto(`/events/${eventId}`);
  const tour = tourDialog(page, "Fiche de l'événement");
  await expect(tour).toContainText("1 sur 5");
  await expect(tour.getByRole("heading", { name: "Les onglets", level: 2 })).toBeFocused();
  const spotOn = async (target: string) => {
    const zone = (await page.locator(`[data-tour='${target}']`).boundingBox())!;
    const spot = (await page.locator(".tour-spot").boundingBox())!;
    return Math.abs(spot.x + 6 - zone.x) < 2 && Math.abs(spot.y + 6 - zone.y) < 2;
  };
  await expect.poll(() => spotOn("event-tabs")).toBe(true);
  await expectNoAxeViolation(page);
  await tour.getByRole("button", { name: "Suivant" }).click();
  await expect(tour.getByRole("heading", { name: "La synthèse", level: 2 })).toBeVisible();
  await expect.poll(() => spotOn("event-overview")).toBe(true);
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);
  await expect(page.locator(".tour-spot")).toHaveCount(0);

  // Rechargée, la fiche ne relance pas la visite d'elle-même.
  await page.reload();
  await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toHaveAttribute("aria-expanded", "false");
  await expect(tour).toHaveCount(0);

  // Centre d'aide : état des visites, préférence.
  await clickMenuLink(page, "Aide");
  const events = page.getByRole("region", { name: "Événements" });
  await expect(events.getByRole("link", { name: /Fiche de l'événement/ })).toContainText("Visite faite");
  await expect(events.getByRole("link", { name: /Liste des événements/ })).toContainText("À découvrir");
  await expectNoAxeViolation(page);
  await page.getByLabel("Lancer la visite guidée et proposer les tutoriels à la première ouverture d'un écran").uncheck();
  await expect
    .poll(async () => (await page.context().cookies()).find((cookie) => cookie.name === "symbola_visites_auto")?.value)
    .toBe("0");
  await page.goto("/events");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Événements");
  await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toHaveAttribute("aria-expanded", "false");
  await expect(tourDialog(page, "Liste des événements")).toHaveCount(0);
});

test("L10-HUB-11 — l'Admin voit la prise en main de chaque compte d'équipe", async ({ page }) => {
  const adminEmail = `admin-suivi-${randomUUID()}@symbola.test`;
  const ownerEmail = `titulaire-suivi-${randomUUID()}@symbola.test`;
  const organizationName = `Organisation suivi ${randomUUID().slice(0, 8)}`;
  const { sql, db } = createAppConnection();
  try {
    await createUser(db, { organizationId: null, email: adminEmail, password: "mot-de-passe-admin-suivi", role: "admin" });
    const organization = await readyOrganization(db, organizationName);
    const owner = await createUser(db, { organizationId: organization.id, email: ownerEmail, password: "mot-de-passe-titulaire", role: "owner" });
    await recordHelpProgress(db, { userId: owner.id, itemKey: "tutorial:catalog", status: "completed", step: 3 });
    await recordHelpProgress(db, { userId: owner.id, itemKey: "tutorial:retroplanning-template", status: "postponed", step: 1 });
  } finally {
    await sql.end();
  }

  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, adminEmail);
  await expect(page).toHaveURL("/exploitation");
  await clickAdminMenuLink(page, "Prise en main");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prise en main des organisations");
  // 20 organisations par page : on la retrouve par son nom.
  await page.goto(`/exploitation/prise-en-main?q=${encodeURIComponent(organizationName)}`);
  const row = page.getByRole("row", { name: new RegExp(ownerEmail) });
  await expect(row).toContainText("1 sur 11");
  await expect(row).toContainText("Saisir son catalogue de prestations");
  await expect(row).toContainText("À quoi sert un modèle de rétroplanning ? · étape 2");
  await expectNoAxeViolation(page);
});

// HUB-11, HUB-10 (lot 63f, ADR 0104 ; maquette M10) — le tutoriel s'ouvre dans un panneau latéral qui
// reste pendant la navigation dans l'exemple : ses étapes se cochent seules, « Étape suivante » mène
// au bon écran, et la fin ramène à l'écran d'où il a été lancé, qui conseille le suivant.
test("HUB-11 / AIDE-06 — tutoriel dans le panneau latéral : proposé à la première visite, coché seul, gardé, retour à l'écran de départ", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `planner-tutoriel-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-tutoriel", role: "owner" });
    // Visites déjà vues : ce parcours teste l'invitation et le tutoriel.
    for (const key of ["hub", "event"]) await recordHelpProgress(db, { userId: user.id, itemKey: `tour:${key}`, status: "completed" });
  } finally {
    await sql.end();
  }
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email);
  await expect(page).toHaveURL("/");

  // Première visite de l'écran des modèles : le tutoriel est proposé.
  await page.goto("/events/modeles");
  const invite = page.getByRole("region", { name: "À quoi sert un modèle de rétroplanning ?" });
  await expect(invite).toContainText("Découvrir en 3 minutes");
  await expectNoAxeViolation(page);
  await invite.getByRole("link", { name: "Commencer le tutoriel" }).click();
  await expect(page).toHaveURL(/\/aide\/tutoriels\/retroplanning-template\?depuis=%2Fevents%2Fmodeles$/);
  await expect(page.getByText("Étape 1 sur 6")).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Créer l'exemple" }).click();

  // L'exemple créé, le tutoriel passe dans le panneau, sur l'écran de l'étape.
  await expect(page).toHaveURL(/\/events\/modeles\/[0-9a-f-]{36}$/);
  const panel = page.getByRole("complementary", { name: "À quoi sert un modèle de rétroplanning ?" });
  await expect(panel).toContainText("Tutoriel · 3 sur 6");
  await expect(panel.getByRole("heading", { name: "Regarder le modèle", level: 3 })).toBeVisible();
  await expectNoAxeViolation(page);
  await panel.getByRole("button", { name: "Étape suivante" }).click();

  // « Étape suivante » mène au bon écran : le rétroplanning de l'exemple.
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\?onglet=retroplanning$/);
  await expect(panel.getByRole("heading", { name: "Appliquer le modèle", level: 3 })).toBeVisible();
  await expect(panel).toContainText("L'étape se coche seule quand l'action est faite.");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Modèle à appliquer").selectOption({ label: "Séminaire express (exemple)" });
  await page.getByRole("button", { name: "Appliquer le modèle" }).click();
  await expect(page.getByText("Modèle appliqué : les tâches ont été créées.")).toBeVisible();
  // L'étape se coche seule, sans « Vérifier ».
  await expect(panel.getByRole("heading", { name: "Déplacer la date", level: 3 })).toBeVisible({ timeout: 15_000 });
  await expect(panel.getByRole("listitem").filter({ hasText: "Appliquer le modèle" })).toHaveAttribute("data-state", "done");

  await panel.getByRole("link", { name: "Aller à l'écran de l'étape" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Modifier les informations" }).click();
  await page.getByLabel("Date de l'événement").fill("2029-05-19");
  await page.getByRole("button", { name: "Changer la date" }).click();
  await expect(page.getByText("Date mise à jour.")).toBeVisible();

  // Fin : le modèle est gardé, l'exemple disparaît, retour à l'écran de départ.
  await expect(panel.getByRole("heading", { name: "Garder ou supprimer", level: 3 })).toBeVisible({ timeout: 15_000 });
  await panel.getByRole("button", { name: "Garder le modèle comme base" }).click();
  await expect(page).toHaveURL(/\/events\/modeles\?tutoriel-termine=retroplanning-template&tutoriel-garde=1$/);
  const done = page.getByRole("status").filter({ has: page.getByRole("heading", { name: "Tutoriel terminé" }) });
  await expect(done).toBeVisible();
  await expect(done).toContainText("Prochain tutoriel conseillé");
  // Le modèle a été gardé : le texte de fin le dit (lot 63a).
  await expect(done).toContainText("Ce que vous avez choisi de garder reste dans vos réglages");
  await expect(panel).toHaveCount(0);
  await expectNoAxeViolation(page);
  await expect(page.getByText("Séminaire express (exemple)").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "À quoi sert un modèle de rétroplanning ?" })).toHaveCount(0);
  await page.goto("/aide");
  await expect(page.getByRole("heading", { name: "Tutoriels faits : 1 sur 11" })).toBeVisible();
});

// HUB-11 (lot 63f, ADR 0104) — « Quitter le tutoriel » supprime l'exemple et ramène à l'écran de départ.
test("HUB-11 — quitter un tutoriel depuis son panneau : l'exemple est supprimé, retour à l'écran de départ", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `planner-quitter-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-quitter", role: "owner" });
    for (const key of ["hub", "events", "event"]) await recordHelpProgress(db, { userId: user.id, itemKey: `tour:${key}`, status: "completed" });
  } finally {
    await sql.end();
  }
  await signInByLink(page, email);
  await page.goto("/aide/tutoriels/event-page?depuis=%2Fevents");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Créer l'exemple" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\?onglet=apercu$/);
  const exampleUrl = page.url();
  const panel = page.locator(".tutorial-panel");
  await expect(panel).toBeVisible();
  // « Réduire » le replie sans le fermer.
  await panel.getByRole("button", { name: "Réduire" }).click();
  await expect(panel.getByRole("button", { name: "Ouvrir" })).toHaveAttribute("aria-expanded", "false");
  await panel.getByRole("button", { name: "Ouvrir" }).click();
  await panel.getByRole("button", { name: "Quitter le tutoriel (l'exemple est supprimé)" }).click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(panel).toHaveCount(0);
  // L'exemple n'existe plus.
  const response = await page.goto(exampleUrl);
  expect(response?.status()).toBe(404);
});
