// Lot 40c (NFR-17, UX-14 ; décision D19, ADR 0078) — tout se fait au clavier, le focus se voit,
// les animations se coupent quand la personne a demandé moins de mouvement :
// - un lien d'évitement mène au contenu sans traverser le menu (WCAG 2.4.1) ;
// - chaque élément atteint au clavier montre son focus (WCAG 2.4.7) ;
// - Échap ferme la palette et le panneau d'édition, sans piège (WCAG 2.1.2) ;
// - PAR-03 au clavier : cocher une tâche, puis « Annuler » ;
// - PAR-06 au clavier : le portail des mariés se parcourt et chaque élément montre son focus ;
// - « moins de mouvement » (prefers-reduced-motion) coupe transitions et animations (WCAG 2.3.3).
// En taille ordinateur, où le menu est affiché : c'est là que le clavier sert.
import { expect, test, type Page } from "@playwright/test";
import { atelier40c, type Atelier40c } from "./atelier-40c";
import { signIn } from "./helpers";

let setup: Atelier40c;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "clavier : en taille ordinateur");
});

test.beforeAll(async ({}, testInfo) => {
  if (testInfo.project.name !== "desktop") return;
  setup = await atelier40c("clavier");
});

// Le focus se voit : contour ou ombre sur l'élément actif.
async function focusIsVisible(page: Page): Promise<{ label: string; visible: boolean }> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return { label: "(rien)", visible: false };
    const style = getComputedStyle(element);
    const outline = style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
    const shadow = style.boxShadow !== "none";
    const label = (element.getAttribute("aria-label") ?? element.textContent ?? element.tagName).trim().slice(0, 40);
    return { label, visible: outline || shadow };
  });
}

async function tabUntil(page: Page, predicate: () => boolean, max = 80): Promise<boolean> {
  for (let step = 0; step < max; step += 1) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(predicate)) return true;
  }
  return false;
}

test("NFR-17 — le lien d'évitement mène au contenu sans traverser le menu", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, setup.email, /\/$/);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".app-main")) && !document.activeElement?.closest("nav"))).toBe(true);
});

test("NFR-17 — chaque élément atteint au clavier montre son focus, dans le menu comme dans l'écran", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, setup.email, /\/$/);
  const hidden: string[] = [];
  for (let step = 0; step < 25; step += 1) {
    await page.keyboard.press("Tab");
    const focus = await focusIsVisible(page);
    if (!focus.visible) hidden.push(focus.label);
  }
  expect(hidden).toEqual([]);
});

test("NFR-17 — Échap ferme la palette et le panneau d'édition, sans piéger le focus", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, setup.email, /\/$/);
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox");
  await expect(search).toBeFocused();
  await page.keyboard.type("Inès");
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(search).toHaveAttribute("aria-expanded", "false");

  await page.goto(`/events/${setup.eventId}`);
  const edit = page.getByRole("link", { name: "Modifier les informations" });
  await edit.focus();
  await page.keyboard.press("Enter");
  const form = page.getByRole("form", { name: "Fiche d'identité" });
  await expect(form).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(form).toHaveCount(0);
});

test("NFR-17 — PAR-03 au clavier : cocher une tâche, puis « Annuler »", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, setup.email, /\/$/);
  await page.goto("/taches");
  const check = page.getByRole("button", { name: "Cocher la tâche Confirmer le lieu" });
  await expect(check).toBeVisible();
  expect(await tabUntil(page, () => document.activeElement?.getAttribute("aria-label") === "Cocher la tâche Confirmer le lieu")).toBe(true);
  expect((await focusIsVisible(page)).visible).toBe(true);
  await page.keyboard.press("Enter");
  const offer = page.getByRole("status").filter({ hasText: "Tâche « Confirmer le lieu » faite." });
  await expect(offer).toBeVisible();
  const undo = offer.getByRole("button", { name: "Annuler" });
  await undo.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Tâche « Confirmer le lieu » remise à faire." })).toBeVisible();
});

test("NFR-17 — PAR-06 au clavier : le portail des mariés se parcourt, chaque élément montre son focus", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(setup.coupleUrl);
  await expect(page).toHaveURL(/\/portail$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const reached: string[] = [];
  const hidden: string[] = [];
  for (let step = 0; step < 15; step += 1) {
    await page.keyboard.press("Tab");
    const focus = await focusIsVisible(page);
    if (focus.label === "(rien)") break;
    reached.push(focus.label);
    if (!focus.visible) hidden.push(focus.label);
  }
  expect(reached.length).toBeGreaterThan(2);
  expect(hidden).toEqual([]);
});

test("UX-14 — « moins de mouvement » coupe transitions et animations", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, setup.email, /\/$/);
  const duration = () => page.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector(".app-nav a") as Element).transitionDuration));
  expect(await duration()).toBeGreaterThan(0.05);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await duration()).toBeLessThan(0.001);
});
