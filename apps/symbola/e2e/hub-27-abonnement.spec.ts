// Lot 54 (HUB-27, ARC-06, ARC-07, NFR-26, DOC-06 ; décisions D1 à D3 ; ADR 0101) — abonnement en
// libre-service, en taille ordinateur et en 375 px, axe-core sur chaque écran :
// - l'essai se voit dans le bandeau ; « Mon abonnement » montre l'offre, le stockage et les offres ;
// - passer à la suite Solo ferme les Rendez-vous à la requête suivante : le lien quitte le menu et
//   l'écran dit « indisponible », sans erreur (ARC-07) ;
// - résilier prend trois clics depuis les Paramètres (« Mon abonnement », « Résilier », « Confirmer
//   la résiliation »), comptés ; l'accès reste jusqu'à la fin de la période ;
// - fin d'essai : lecture seule, les écrans se lisent, une écriture ramène à « Mon abonnement »,
//   l'export reste ouvert ; choisir une offre lève la lecture seule.
// Les noms d'offres viennent du catalogue de départ (plans.json), comme les voit la planner.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { starterPlanCatalog } from "@symbola/starter-templates";
import { expect, test, type Page } from "@playwright/test";
import { runSubscriptionPass, setFeatureFlagForOrganization, startTrial } from "../modules/hub/service";
import { clickMenuLink, mainMenu, openMenu, readyOrganization, signIn } from "./helpers";

const catalog = starterPlanCatalog();
const SOLO = catalog.plans.find((plan) => plan.key === "solo")!.labels.fr;
const DAY_MS = 86_400_000;

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function atelier(options: { trialEnded?: boolean } = {}) {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
    const ownerEmail = `titulaire-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId, email: ownerEmail, role: "owner" });
    const admin = await createUser(db, { organizationId: null, email: `exploitation-${randomUUID()}@symbola.test`, role: "admin" });
    // NFR-26 : la fonction est ouverte à cette organisation seulement (la pilote d'abord).
    await setFeatureFlagForOrganization(db, { adminUserId: admin.id, key: "subscription_self_service", organizationId, open: true });
    const trial = await startTrial(db, { organizationId });
    if (options.trialEnded) await runSubscriptionPass(db, { organizationIds: [organizationId], now: new Date(trial.trialEndsAt!.getTime() + DAY_MS) });
    return { organizationId, ownerEmail };
  } finally {
    await sql.end();
  }
}

test("HUB-27 — essai, passage à la suite Solo (Rendez-vous fermé à la requête suivante), résiliation en trois clics", async ({ page }) => {
  test.setTimeout(180_000);
  const { ownerEmail } = await atelier();
  await signIn(page, ownerEmail, /\/$/);
  const banner = page.getByRole("complementary", { name: "Abonnement" });
  await expect(banner).toContainText(/Essai : encore \d+ jours/);
  await expect(banner.getByRole("link", { name: "Choisir une offre" })).toBeVisible();
  await expectNoAxeViolation(page);

  // L'essai ouvre la suite complète : les Rendez-vous sont au menu.
  await openMenu(page);
  await expect(mainMenu(page).getByRole("link", { name: "Rendez-vous", exact: true })).toBeVisible();

  await banner.getByRole("link", { name: "Choisir une offre" }).click();
  await expect(page).toHaveURL(/\/parametres\/abonnement$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mon abonnement" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Votre offre" })).toContainText(/Essai jusqu'au/);
  await expect(page.getByRole("region", { name: "Stockage" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Votre offre" })).toContainText("aucune facture ne vous sera envoyée");
  await expectNoAxeViolation(page);

  // Changer d'offre : effet immédiat.
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: new RegExp(SOLO) }).check();
  await page.getByRole("button", { name: "Changer d'offre" }).click();
  await expect(page.getByRole("status")).toContainText("Votre offre est changée");
  await expect(page.getByRole("region", { name: "Votre offre" })).toContainText(SOLO);

  // ARC-06, ARC-07 : à la requête suivante, Rendez-vous quitte le menu et son écran dit « indisponible ».
  await page.goto("/");
  await openMenu(page);
  await expect(mainMenu(page).getByRole("link", { name: "Rendez-vous", exact: true })).toHaveCount(0);
  await page.goto("/rendez-vous");
  await expect(page.getByText("Le module Rendez-vous n'est pas activé pour votre organisation.")).toBeVisible();
  await expectNoAxeViolation(page);

  // Résilier : trois clics depuis les Paramètres, comptés.
  await clickMenuLink(page, "Paramètres");
  await expect(page).toHaveURL(/\/parametres$/);
  let clicks = 0;
  const click = async (name: string, role: "link" | "button") => {
    clicks += 1;
    await page.getByRole(role, { name, exact: true }).click();
  };
  await page.getByRole("navigation", { name: "Rubriques des paramètres" }).getByRole("link", { name: "Mon abonnement", exact: true }).click();
  clicks += 1;
  await expect(page.getByRole("heading", { level: 1, name: "Mon abonnement" })).toBeVisible();
  await click("Résilier", "link");
  await expect(page.getByRole("heading", { name: "Confirmer la résiliation ?" })).toBeVisible();
  await expectNoAxeViolation(page);
  await click("Confirmer la résiliation", "button");
  await expect(page.getByRole("status")).toContainText("Résiliation enregistrée. Vous gardez l'accès jusqu'au");
  expect(clicks).toBeLessThanOrEqual(3);
  // L'accès reste : la résiliation se lit dans le bandeau et se défait.
  await expect(page.getByRole("complementary", { name: "Abonnement" })).toContainText("Abonnement résilié : accès jusqu'au");
  await page.getByRole("button", { name: "Annuler la résiliation" }).click();
  await expect(page.getByRole("status")).toContainText("La résiliation est annulée");
});

test("HUB-27 — fin d'essai : lecture seule, rien d'effacé, export ouvert ; une offre choisie lève la lecture seule", async ({ page }) => {
  test.setTimeout(180_000);
  const { ownerEmail } = await atelier({ trialEnded: true });
  await signIn(page, ownerEmail, /\/$/);
  await expect(page.getByRole("complementary", { name: "Abonnement" })).toContainText("Votre essai est terminé : votre espace est en lecture seule.");
  await expectNoAxeViolation(page);

  // Lire : les écrans s'ouvrent.
  await page.goto("/contacts");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Écrire : refusé, retour à « Mon abonnement » avec le motif.
  await page.goto("/contacts?nouveau=1");
  await page.waitForLoadState("networkidle");
  const dialog = page.getByRole("dialog");
  const form = (await dialog.count()) > 0 ? dialog : page.locator("main");
  await form.getByLabel("Prénom", { exact: true }).first().fill("Léa");
  await form.getByRole("button", { name: /Créer|Enregistrer/ }).first().click();
  await expect(page).toHaveURL(/\/parametres\/abonnement\?erreur=read_only$/);
  await expect(page.getByRole("alert")).toContainText("Votre espace est en lecture seule");
  await expectNoAxeViolation(page);

  // L'export reste ouvert.
  await page.goto("/parametres/export");
  await expect(page.getByRole("heading", { level: 1, name: "Exporter mes données" })).toBeVisible();

  // Choisir une offre lève la lecture seule.
  await page.goto("/parametres/abonnement");
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: new RegExp(SOLO) }).check();
  await page.getByRole("button", { name: "Changer d'offre" }).click();
  await expect(page.getByRole("status")).toContainText("Votre offre est changée");
  await expect(page.getByRole("complementary", { name: "Abonnement" })).toHaveCount(0);
});
