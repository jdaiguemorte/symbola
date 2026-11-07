// Lot 13 (AIDE-11, remplace la visite focus d'AIDE-05) — repères de la fiche
// d'un événement : non bloquants, choisis dans la liste ou parcourus dans
// l'ordre, l'élément choisi mis en avant, Échap ; centre d'aide (état des
// repères, préférence d'ouverture automatique, AIDE-07). En taille
// ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { createProspect, createProspectSource } from "../modules/events/service";
import { clickAdminMenuLink, clickMenuLink, closeLandmarks, landmarksPanel, readyOrganization } from "./helpers";
import { recordHelpProgress } from "../modules/hub/service";

// Repères ouverts d'office : sans la préférence posée par la configuration.
test.use({ storageState: { cookies: [], origins: [] } });

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("AIDE-11 / AIDE-07 — repères de la fiche d'un événement, et centre d'aide", async ({ page }) => {
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

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-aide-lot10");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
  // Les repères de l'accueil s'ouvrent d'eux-mêmes ; on les ferme.
  await closeLandmarks(page, "Accueil");

  // Fiche d'un événement : cinq repères, le premier choisi et son élément mis en avant.
  await page.goto(`/events/${eventId}`);
  const panel = landmarksPanel(page, "Fiche de l'événement");
  await expect(panel.getByRole("list").getByRole("button")).toHaveCount(5);
  await expect(panel.getByRole("heading", { name: "Fiche de l'événement", level: 2 })).toBeFocused();
  await expect(page.locator("[data-tour='event-tabs']")).toHaveClass(/landmark-active/);
  await expectNoAxeViolation(page);
  // L'écran reste utilisable pendant que les repères sont affichés.
  await expect(page.getByRole("button", { name: "Repère 1 : Les onglets" })).toHaveAttribute("aria-pressed", "true");
  await panel.getByRole("button", { name: "Repère suivant" }).click();
  await expect(panel.getByRole("heading", { name: "La vue d'ensemble", level: 3 })).toBeVisible();
  await expect(page.locator("[data-tour='event-overview']")).toHaveClass(/landmark-active/);
  await expect(page.locator("[data-tour='event-tabs']")).not.toHaveClass(/landmark-active/);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.locator(".landmark-active")).toHaveCount(0);

  // Rechargée, la fiche ne rouvre pas les repères d'elle-même.
  await page.reload();
  await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toHaveCount(0);

  // Centre d'aide : état des repères, préférence.
  await clickMenuLink(page, "Aide");
  const events = page.getByRole("region", { name: "Événements" });
  await expect(events.getByRole("link", { name: /Fiche de l'événement/ })).toContainText("Repères vus");
  await expect(events.getByRole("link", { name: /Liste des événements/ })).toContainText("À découvrir");
  await expectNoAxeViolation(page);
  await page.getByLabel("Afficher d'office les repères et proposer les tutoriels à la première ouverture d'un écran").uncheck();
  await expect
    .poll(async () => (await page.context().cookies()).find((cookie) => cookie.name === "symbola_visites_auto")?.value)
    .toBe("0");
  await page.goto("/events");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Événements");
  await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toHaveAttribute("aria-expanded", "false");
  await expect(landmarksPanel(page, "Liste des événements")).toHaveCount(0);
});

test("HUB-11 — l'Admin voit la prise en main de chaque compte d'équipe", async ({ page }) => {
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

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(adminEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-admin-suivi");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/admin");
  await clickAdminMenuLink(page, "Prise en main");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prise en main des organisations");
  const row = page.getByRole("row", { name: new RegExp(ownerEmail) });
  await expect(row).toContainText("1 sur 10");
  await expect(row).toContainText("Saisir son catalogue de prestations");
  await expect(row).toContainText("À quoi sert un modèle de rétroplanning ? · étape 2");
  await expectNoAxeViolation(page);
});

test("AIDE-06 — tutoriel en faisant : modèle de rétroplanning proposé à la première visite, vérifié, gardé", async ({ page }) => {
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
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-tutoriel");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");

  // Première visite de l'écran des modèles : le tutoriel est proposé.
  await page.goto("/events/modeles");
  const invite = page.getByRole("region", { name: "À quoi sert un modèle de rétroplanning ?" });
  await expect(invite).toContainText("Découvrir en 3 minutes");
  await expectNoAxeViolation(page);
  await invite.getByRole("link", { name: "Commencer le tutoriel" }).click();
  await expect(page).toHaveURL(/\/aide\/tutoriels\/retroplanning-template$/);
  await expect(page.getByText("Étape 1 sur 6")).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Créer l'exemple" }).click();
  await expect(page.getByRole("heading", { name: "Regarder le modèle" })).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Étape à faire : la vérification échoue tant que ce n'est pas fait.
  await expect(page.getByRole("heading", { name: "Appliquer le modèle" })).toBeVisible();
  await page.getByRole("button", { name: "J'ai fait, vérifier" }).click();
  await expect(page.getByText("Ce n'est pas encore fait sur l'exemple", { exact: false })).toBeVisible();
  const tutorialUrl = page.url();
  await page.getByRole("link", { name: "Ouvrir l'exemple" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\?onglet=retroplanning$/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Modèle à appliquer").selectOption({ label: "Séminaire express (exemple)" });
  await page.getByRole("button", { name: "Appliquer le modèle" }).click();
  await expect(page.getByText("Modèle appliqué : les tâches ont été créées.")).toBeVisible();
  await page.goto(tutorialUrl);
  await page.getByRole("button", { name: "J'ai fait, vérifier" }).click();
  await expect(page.getByRole("heading", { name: "Déplacer la date" })).toBeVisible();

  await page.getByRole("link", { name: "Ouvrir l'exemple" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Date de l'événement").fill("2029-05-19");
  await page.getByRole("button", { name: "Changer la date" }).click();
  await expect(page.getByText("Date mise à jour.")).toBeVisible();
  await page.goto(tutorialUrl);
  await page.getByRole("button", { name: "J'ai fait, vérifier" }).click();

  // Fin : le modèle est gardé, l'exemple disparaît, la progression avance.
  await expect(page.getByRole("heading", { name: "Garder ou supprimer" })).toBeVisible();
  await page.getByRole("button", { name: "Garder le modèle comme base" }).click();
  await expect(page.getByRole("heading", { name: "Bravo, tutoriel terminé" })).toBeVisible();
  await page.goto("/events/modeles");
  await expect(page.getByText("Séminaire express (exemple)").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "À quoi sert un modèle de rétroplanning ?" })).toHaveCount(0);
  await page.goto("/aide");
  await expect(page.getByRole("heading", { name: "Tutoriels faits : 1 sur 10" })).toBeVisible();
});
