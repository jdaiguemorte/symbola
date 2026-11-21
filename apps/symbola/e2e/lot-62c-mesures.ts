// Lot 62c (UX-13, UX-05, NFR-19) — les mesures communes du lot 62 (docs/lots/lot-62-ergonomie.md,
// « Mesure commune aux quatre paquets »), pour les parcours de la fiche d'évènement. Mêmes calculs
// que l'outil de relevé (zz-releve-ergonomie.spec.ts), avec le seuil de 44 px des cibles tactiles.
import type { Page } from "@playwright/test";

export type ScreenMeasures = {
  // Hauteur de la page, en écrans.
  screens: number;
  // Défilement horizontal de la page (px).
  overflowX: number;
  // Plus longue suite de champs empilés sur un même bord gauche.
  stackedRun: number;
  // Nombres, dates et heures de plus de 260 px de large.
  wideShortFields: number;
  // Boutons principaux visibles, et leurs libellés.
  primary: string[];
  // Boutons d'envoi au même libellé, répétés plus de trois fois.
  repeatedSubmits: string[];
  // Boutons, listes, sommaires et champs de moins de 44 px (cases à cocher : leur libellé).
  smallTargets: string[];
};

export async function measureScreen(page: Page): Promise<ScreenMeasures> {
  return page.evaluate(() => {
    const main = (document.querySelector("main") ?? document.body) as HTMLElement;
    const box = (element: Element) => element.getBoundingClientRect();
    const visible = (element: Element) => {
      const rect = box(element);
      const style = getComputedStyle(element);
      // Le contenu d'un <details> fermé garde une boîte (content-visibility) : checkVisibility l'écarte.
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && element.checkVisibility();
    };
    const words = (element: Element | null) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
    const all = (selector: string) => [...main.querySelectorAll(selector)].filter(visible);
    const fields = all('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea');
    let run = 0;
    let stackedRun = 0;
    let previous: DOMRect | null = null;
    for (const field of fields) {
      const rect = box(field);
      run = previous && Math.abs(rect.left - previous.left) < 3 && rect.top > previous.bottom - 2 ? run + 1 : 1;
      stackedRun = Math.max(stackedRun, run);
      previous = rect;
    }
    const primary = all('button, a, input[type="submit"]').filter((element) => getComputedStyle(element).backgroundColor === "rgb(15, 110, 92)");
    const submits: Record<string, number> = {};
    for (const button of all('button[type="submit"], button:not([type])')) {
      const label = (words(button) || button.getAttribute("aria-label") || "").slice(0, 60);
      submits[label] = (submits[label] ?? 0) + 1;
    }
    const targets = new Set<Element>();
    for (const element of all("button, select, summary, input:not([type='hidden'])")) {
      const type = element.getAttribute("type");
      targets.add(type === "checkbox" || type === "radio" ? (element.closest("label") ?? element) : element);
    }
    return {
      screens: Math.round((document.documentElement.scrollHeight / window.innerHeight) * 10) / 10,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      stackedRun,
      wideShortFields: fields.filter((field) => ["number", "date", "time"].includes(field.getAttribute("type") ?? "") && box(field).width > 260).length,
      primary: primary.map((element) => words(element).slice(0, 40)),
      repeatedSubmits: Object.entries(submits)
        .filter(([, count]) => count > 3)
        .map(([label, count]) => `${label} × ${count}`),
      smallTargets: [...targets]
        .map((element) => ({ element, rect: box(element) }))
        .filter(({ rect }) => rect.height < 44 || rect.width < 44)
        .map(({ element, rect }) => `${element.tagName} « ${(words(element) || element.getAttribute("aria-label") || element.getAttribute("name") || "").slice(0, 40)} » ${Math.round(rect.width)}×${Math.round(rect.height)}`),
    };
  });
}
