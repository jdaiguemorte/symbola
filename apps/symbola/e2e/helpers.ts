// Aides communes aux parcours e2e (ADR 0025).
import { expect, type Page } from "@playwright/test";

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
