// Lot 62d (UX-12, UX-13) — aides des parcours du devis en rubriques : ouvrir une rubrique par son
// onglet, ouvrir un formulaire replié derrière son bouton, et mesurer un écran selon les critères
// communs du lot 62 (les mêmes mesures que l'outil de relevé, `zz-releve-ergonomie.spec.ts`, avec le
// seuil de 44 px pour les cibles tactiles).
import { expect, type Locator, type Page } from "@playwright/test";

export const QUOTE_RUBRICS = {
  lignes: "Lignes et totaux",
  proposition: "Page de proposition",
  paiement: "Paiement et acompte",
  acheteur: "Acheteur et livraison",
  honoraires: "Honoraires et commissions",
  contrat: "Contrat et signature",
  factures: "Factures et avoirs",
} as const;

export type QuoteRubric = keyof typeof QUOTE_RUBRICS;

export function quoteRubricNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Rubriques du devis" });
}

// Ouvre une rubrique du devis par son onglet, et attend qu'elle soit l'onglet affiché.
export async function openQuoteRubric(page: Page, rubric: QuoteRubric): Promise<void> {
  const tab = quoteRubricNav(page).getByRole("link", { name: QUOTE_RUBRICS[rubric], exact: true });
  if ((await tab.getAttribute("aria-current")) !== "page") await tab.click();
  await expect(tab).toHaveAttribute("aria-current", "page");
  await page.waitForLoadState("networkidle");
}

// Un formulaire replié derrière un bouton du même nom (« Ajouter une ligne libre », « Remise
// globale »…) : l'ouvre s'il ne l'est pas, et le rend.
export async function openQuoteForm(page: Page, name: string, toggle: string = name): Promise<Locator> {
  const form = page.getByRole("form", { name, exact: true });
  if (!(await form.isVisible())) await page.getByRole("button", { name: toggle, exact: true }).click();
  await expect(form).toBeVisible();
  return form;
}

export type ScreenMeasure = {
  screens: number;
  overflowX: number;
  fields: number;
  stackedRun: number;
  wideShortFields: number;
  primary: number;
  primaryLabels: string[];
  smallTargets: string[];
};

// Mesure de l'écran affiché : hauteur en écrans, débordement horizontal, plus longue suite de champs
// empilés sur un même bord, nombres et dates de plus de 260 px, boutons principaux (fond `primary`),
// cibles de moins de 44 px (boutons, listes, champs, sommaires, cases par leur libellé, liens hors
// d'une phrase).
export async function measureScreen(page: Page): Promise<ScreenMeasure> {
  return page.evaluate(() => {
    const main = (document.querySelector("main") ?? document.body) as HTMLElement;
    const box = (element: Element) => element.getBoundingClientRect();
    const visible = (element: Element) => {
      const rect = box(element);
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const all = (selector: string) => [...main.querySelectorAll(selector)].filter(visible);
    const words = (element: Element | null) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
    const fields = all('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea');
    let run = 0;
    let longestRun = 0;
    let previous: DOMRect | null = null;
    for (const field of fields) {
      const rect = box(field);
      run = previous && Math.abs(rect.left - previous.left) < 3 && rect.top > previous.bottom - 2 ? run + 1 : 1;
      longestRun = Math.max(longestRun, run);
      previous = rect;
    }
    const primary = all('button, a, input[type="submit"]').filter((element) => getComputedStyle(element).backgroundColor === "rgb(15, 110, 92)");
    const inSentence = (link: Element) => getComputedStyle(link).display === "inline" && words(link.parentElement).length > words(link).length;
    const targets = new Set<Element>();
    for (const element of all("button, summary, select, a[href], input:not([type='hidden']):not([type='checkbox']):not([type='radio'])")) {
      if (element.tagName === "A" && inSentence(element)) continue;
      targets.add(element);
    }
    for (const input of main.querySelectorAll("input[type=checkbox], input[type=radio]")) {
      const target = input.closest("label") ?? input;
      if (visible(target)) targets.add(target);
    }
    const smallTargets = [...targets]
      .map((element) => ({ element, rect: box(element) }))
      .filter(({ rect }) => rect.width < 44 || rect.height < 44)
      .map(({ element, rect }) => `${element.tagName} « ${words(element).slice(0, 40)} » ${Math.round(rect.width)}×${Math.round(rect.height)}`);
    return {
      screens: Math.round((document.documentElement.scrollHeight / window.innerHeight) * 10) / 10,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      fields: fields.length,
      stackedRun: longestRun,
      wideShortFields: fields.filter((field) => ["number", "date", "time"].includes(field.getAttribute("type") ?? "") && box(field).width > 260).length,
      primary: primary.length,
      primaryLabels: [...new Set(primary.map((element) => words(element).slice(0, 40)))],
      smallTargets,
    };
  });
}
