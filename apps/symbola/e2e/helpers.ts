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
// par `name` (« Postes prestataires 1/3 », « Rétroplanning 2 en retard »…).
export async function openEventTab(page: Page, name: string): Promise<void> {
  const tabs = page.getByRole("navigation", { name: "Sections de l'événement" });
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await tabs.getByRole("link", { name: new RegExp(`^${escaped}`) }).click();
  await expect(tabs.getByRole("link", { name: new RegExp(`^${escaped}`) })).toHaveAttribute("aria-current", "page");
}

// Réglages regroupés sous « Paramètres » (lot 8) : ouvre l'onglet du module.
export async function openSettingsTab(page: Page, name: string): Promise<void> {
  await clickMenuLink(page, "Paramètres");
  await page.getByRole("navigation", { name: "Paramètres par module" }).getByRole("link", { name, exact: true }).click();
}

// Lot 12 (ONB-03) : une organisation dont l'assistant de démarrage est déjà
// terminé, pour les parcours qui ne testent pas le démarrage lui-même.
export async function readyOrganization(db: Parameters<typeof createOrganization>[0], name: string) {
  const organization = await createOrganization(db, name);
  await completeSetup(db, organization.id);
  return organization;
}
