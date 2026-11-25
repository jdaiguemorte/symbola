// Lot 61 — retours de la recette staging du 20/11/2026 (UX-13, L13-HUB-16, HUB-28, GC-02, FAC-02, HUB-29,
// RDV-02). Les rubriques du menu des Paramètres s'ouvrent toutes dans les Paramètres ; le mot d'accueil
// d'un modèle de proposition prend la largeur de sa carte ; les commandes du radar et des
// automatisations sont alignées avec leur réglage ; retirer l'adresse de son calendrier efface la zone
// qui la montrait ; l'écran des disponibilités tient en une ligne par jour et guide le rattachement
// d'un agenda. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { organizationModules } from "@symbola/db/schema/hub";
import { mainMenu, openMenu, openSettingsRubric, readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Atelier prêt et sa titulaire, module Rendez-vous ouvert.
async function atelier() {
  const email = `planner-lot61-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    await createUser(db, { organizationId: organization.id, email, role: "owner" });
    await db
      .insert(organizationModules)
      .values({ organizationId: organization.id, moduleKey: "appointments", enabled: true })
      .onConflictDoUpdate({ target: [organizationModules.organizationId, organizationModules.moduleKey], set: { enabled: true } });
    return { email };
  } finally {
    await sql.end();
  }
}

// Les six rubriques signalées : leur lien dans le menu des réglages, leur adresse, le titre de l'écran.
const REPORTED = [
  ["Exports comptables", "/devis/exports-comptables"],
  ["Relances de devis et de paiement", "/devis/relances"],
  ["Modèles de proposition", "/devis/modeles-proposition"],
  ["Modèles de contrat", "/devis/modeles-contrat"],
  ["Modèles de devis", "/devis/modeles"],
  ["Modèles d'évènement", "/events/modeles-evenement"],
] as const;

test("UX-13 (L13-HUB-16) — Les rubriques du menu des Paramètres s'ouvrent dans les Paramètres", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  for (const [name, path] of REPORTED) {
    await page.goto("/parametres");
    const rubrics = page.getByRole("navigation", { name: "Rubriques des paramètres" });
    await openSettingsRubric(page, name);
    await expect(page).toHaveURL(path, { timeout: 30_000 });
    // Le menu des réglages reste affiché, la rubrique y est allumée ; le menu principal allume
    // « Paramètres », plus « Devis et factures » ni « Évènements ».
    await expect(rubrics.getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
    await openMenu(page);
    await expect(mainMenu(page).getByRole("link", { name: "Paramètres", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(mainMenu(page).getByRole("link", { name: "Devis et factures", exact: true })).not.toHaveAttribute("aria-current", "page");
    await expect(mainMenu(page).getByRole("link", { name: "Évènements", exact: true })).not.toHaveAttribute("aria-current", "page");
  }
  // Les deux rubriques de relances ne se confondent plus : chacune dit son objet et renvoie à l'autre.
  await page.goto("/devis/relances");
  await expect(page.getByRole("heading", { level: 1, name: "Relances de devis et de paiement" })).toBeVisible();
  await page.getByRole("link", { name: "Évènements, Relances des prospects" }).click();
  await expect(page).toHaveURL("/parametres/relances");
  await expect(page.getByRole("heading", { level: 1, name: "Relances des prospects" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ventes, Relances de devis et de paiement" })).toBeVisible();
  await expectNoAxeViolation(page);
});

test("FAC-02 / HUB-28 / GC-02 — Modèle de proposition, radar et automatisations : champs à leur place", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);

  // Le mot d'accueil prend la largeur de sa carte (il était coincé dans une colonne sur trois).
  await page.goto("/devis/modeles-proposition");
  const template = page.getByRole("region", { name: "Pour tous les évènements" });
  const greeting = template.getByLabel("Mot d'accueil").first();
  const [card, field] = [await template.boundingBox(), await greeting.boundingBox()];
  expect(field!.width).toBeGreaterThan(card!.width * 0.8);
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  // Radar : la case, le seuil et le bouton d'une règle tiennent dans la carte, à gauche de son bord droit,
  // et le seuil est un champ court (il n'occupe plus toute une ligne décalée).
  await page.goto("/parametres/radar");
  const rule = page.getByRole("form", { name: "Prestataire retenu sans contrat" });
  const threshold = rule.getByLabel("Seuil (jours)");
  await expect(rule.getByRole("checkbox", { name: "Règle active" })).toBeChecked();
  expect((await threshold.boundingBox())!.width).toBeLessThan(140);
  await threshold.fill("45");
  await rule.getByRole("button", { name: "Enregistrer" }).click();
  await expect(rule.getByText("Règle enregistrée.")).toBeVisible();
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  // Automatisations : couper puis réactiver reste possible, le délai est un champ court.
  await page.goto("/parametres/automatisations");
  await page.getByRole("button", { name: "Couper : Échéance à J-7, puis rappel au payeur" }).click();
  await expect(page.getByRole("button", { name: "Activer : Échéance à J-7, puis rappel au payeur" })).toBeVisible();
  expect((await page.getByLabel("Jours avant l'échéance").boundingBox())!.width).toBeLessThan(140);
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);
});

test("HUB-29 / RDV-02 — Retirer l'adresse du calendrier efface sa zone ; les disponibilités en une ligne par jour", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await page.goto("/profil");
  const calendar = page.getByRole("region", { name: "Mon calendrier" });
  await calendar.getByRole("button", { name: "Créer mon adresse" }).click();
  const address = calendar.getByLabel("Adresse de votre calendrier");
  await expect(address).toHaveValue(/\/calendrier\/.+\.ics$/);
  const url = new URL(await address.inputValue()).pathname;
  // Les étapes pour l'ajouter à son agenda sont écrites sous l'adresse.
  await expect(calendar.getByText(/Google Agenda : « Autres agendas »/)).toBeVisible();
  await expect(calendar.getByText("Adresse active")).toBeVisible();
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  // Retour de recette : après « Retirer l'adresse », la zone verte restait affichée.
  await calendar.getByRole("button", { name: "Retirer l'adresse" }).click();
  await expect(calendar.getByText("Adresse retirée : elle ne répond plus.")).toBeVisible();
  await expect(address).toHaveCount(0);
  await expect(calendar).toContainText("Aucune adresse pour l'instant.");
  expect((await page.request.get(url)).status()).toBe(404);

  // Mes disponibilités : les sept jours et « Mes agendas » sans faire défiler plus de deux écrans.
  await page.goto("/rendez-vous/disponibilites");
  // Lot 64 (M6) : une ligne par jour, un interrupteur, les plages alignées.
  await expect(page.getByLabel("Lundi, début de la plage 1")).toHaveValue("09:00");
  await expect(page.getByRole("group", { name: "Dimanche" })).toBeVisible();
  await page.getByRole("navigation", { name: "Sur cet écran" }).getByRole("link", { name: "Mes agendas" }).click();
  const agendas = page.getByRole("region", { name: "Mes agendas" });
  await expect(agendas.getByRole("heading", { name: "Relier un agenda" })).toBeVisible();
  await expect(agendas.getByText(/Adresse secrète au format iCal/)).toBeVisible();
  await page.getByRole("switch", { name: "Samedi : ouvert" }).click();
  await page.getByLabel("Samedi, début de la plage 1").fill("10:00");
  await page.getByLabel("Samedi, fin de la plage 1").fill("12:00");
  await expect(page.getByText("1 jour modifié")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer ma semaine" }).click();
  await expect(page.getByLabel("Samedi, début de la plage 1")).toHaveValue("10:00");
  await expect(page.getByRole("switch", { name: "Samedi : ouvert" })).toHaveAttribute("aria-checked", "true");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);
});
