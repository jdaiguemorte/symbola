// Lot 73b (PRE-01, PRE-11, UX-05 ; spécification du lot 73, § 5.2) — gestes communs des parcours du carnet :
// la liste des fiches (« N fiches sur M, par … »), la barre de filtres (sur téléphone, derrière
// « Filtres », en panneau du bas qui finit par « Voir les N fiches »).
import { expect, type Locator, type Page } from "@playwright/test";

export function bookResults(page: Page): Locator {
  return page.getByRole("region", { name: /^(\d+|Aucune) fiches?\b.*, par / });
}

export function isPhone(page: Page): boolean {
  return page.viewportSize()!.width < 640;
}

// La barre de filtres, ouverte sur téléphone.
export async function bookFilters(page: Page): Promise<Locator> {
  if (isPhone(page)) {
    const toggle = page.getByRole("button", { name: /^Filtres/ });
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  }
  const filters = page.getByRole("search", { name: "Filtres du carnet" });
  await expect(filters).toBeVisible();
  return filters;
}

// Sur téléphone, « Voir les N fiches » referme le panneau.
export async function closeBookFilters(page: Page): Promise<void> {
  if (!isPhone(page)) return;
  const done = page.getByRole("button", { name: /^Voir (les|la) / });
  if (await done.isVisible()) await done.click();
}
