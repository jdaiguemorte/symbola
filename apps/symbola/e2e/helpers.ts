// Aides communes aux parcours e2e (ADR 0025).
import { expect, type Page } from "@playwright/test";
import { createOrganization } from "@symbola/auth";
import { completeSetup } from "../modules/hub/service";

// Sur téléphone, le menu latéral est replié derrière le bouton « Menu » :
// l'ouvrir avant de cliquer un lien du menu ou « Se déconnecter ». Sur
// ordinateur, le bouton est masqué et le menu toujours visible : rien à faire.
export async function openMenu(page: Page): Promise<void> {
  // Le libellé change (« Menu » / « Fermer le menu ») : cibler le bouton par
  // ce qu'il commande.
  const toggle = page.locator('button[aria-controls="app-menu"]');
  if ((await toggle.count()) === 0 || !(await toggle.isVisible())) return;
  if ((await toggle.getAttribute("aria-expanded")) === "true") return;
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

// Le menu latéral (navigation et compte), pour cibler ses liens sans
// confusion avec un lien de même nom dans la page.
export function mainMenu(page: Page) {
  return page.locator("#app-menu");
}

// Ouvre le menu si besoin puis clique le lien du menu portant exactement ce nom.
export async function clickMenuLink(page: Page, name: string): Promise<void> {
  await openMenu(page);
  await mainMenu(page).getByRole("link", { name, exact: true }).click();
}

// Ouvre le menu si besoin puis se déconnecte.
export async function logout(page: Page): Promise<void> {
  await openMenu(page);
  await page.getByRole("button", { name: "Se déconnecter" }).click();
}

// Fiche événement en onglets (lot 8) : ouvre l'onglet dont le nom commence
// par `name` (« Budget 1/3 », « Rétroplanning 2 en retard »…).
export async function openEventTab(page: Page, name: string): Promise<void> {
  const tabs = page.getByRole("navigation", { name: "Sections de l'événement" });
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await tabs.getByRole("link", { name: new RegExp(`^${escaped}`) }).click();
  await expect(tabs.getByRole("link", { name: new RegExp(`^${escaped}`) })).toHaveAttribute("aria-current", "page");
}

// Réglages regroupés sous « Paramètres » (lot 13 : menu latéral par rubrique).
export async function openSettingsTab(page: Page, name: string): Promise<void> {
  await clickMenuLink(page, "Paramètres");
  await page.getByRole("navigation", { name: "Rubriques des paramètres" }).getByRole("link", { name, exact: true }).click();
}

// Lot 12 (ONB-03) : une organisation dont l'assistant de démarrage est déjà
// terminé, pour les parcours qui ne testent pas le démarrage lui-même.
export async function readyOrganization(db: Parameters<typeof createOrganization>[0], name: string) {
  const organization = await createOrganization(db, name);
  await completeSetup(db, organization.id);
  return organization;
}

// Lot 13 (EVT-19) : frise du statut ; un clic sur l'étape, puis « Confirmer ».
export async function changeEventStatus(page: Page, status: string): Promise<void> {
  await page.getByRole("button", { name: `Passer en ${status}` }).click();
  await page.getByRole("form", { name: "Confirmer le changement de statut" }).getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByRole("list", { name: "Statut de l'événement" }).getByRole("listitem").filter({ hasText: status })).toHaveAttribute("aria-current", "step");
}

// Lot 13 (AIDE-11) — panneau des repères d'un écran (« Aide : <écran> »).
export function landmarksPanel(page: Page, screen: string) {
  return page.getByRole("complementary", { name: `Aide : ${screen}` });
}

// Ferme le panneau des repères s'il est ouvert (affiché d'office une fois).
export async function closeLandmarks(page: Page, screen: string): Promise<void> {
  const panel = landmarksPanel(page, screen);
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Fermer l'aide" }).click();
  await expect(panel).toHaveCount(0);
}

// Lot 13 (HUB-17) — lien du menu de la console d'Administration (replié sur téléphone).
export async function clickAdminMenuLink(page: Page, name: string): Promise<void> {
  await openMenu(page);
  await page.getByRole("navigation", { name: "Menu de l'Administration" }).getByRole("link", { name, exact: true }).click();
}
