// Lot 40c (NFR-19, UX-14 ; décision D18, ADR 0078) — de 360 à 1 920 px, zoom à 200 % sans perte de
// fonction. Le zoom se joue comme un navigateur zoomé : la page se recompose dans une fenêtre réduite
// d'autant (1 280 × 800 à 200 % = 640 × 400 ; principe de la méthode de WCAG pour la redistribution,
// 1.4.10). Sur chaque écran des parcours P0 et le portail : aucun défilement horizontal, le titre
// visible, le menu joignable, et axe-core (WCAG 2.2 AA) sans violation. Les parcours des scénarios
// tournent aussi à 360 et 1 920 px, et SC-10 à 150 % (projets de playwright.config.ts).
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "./axe";
import { atelier40c, type Atelier40c } from "./atelier-40c";
import { signIn } from "./helpers";

let setup: Atelier40c;

const SIZES = [
  { name: "zoom à 200 %", viewport: { width: 640, height: 400 } },
  { name: "360 px", viewport: { width: 360, height: 780 } },
] as const;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "zoom : la fenêtre est réglée par le parcours");
});

test.beforeAll(async ({}, testInfo) => {
  if (testInfo.project.name !== "desktop") return;
  setup = await atelier40c("zoom");
});

async function checkScreen(page: Page, url: string | null, problems: string[], label: string, menu: boolean): Promise<void> {
  if (url) await page.goto(url);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) problems.push(`${label} : défilement horizontal`);
  if (menu && !(await page.getByRole("button", { name: "Menu" }).isVisible()) && !(await page.getByRole("navigation", { name: "Menu principal" }).isVisible())) problems.push(`${label} : menu injoignable`);
  const result = await new AxeBuilder({ page }).analyze();
  for (const violation of result.violations) problems.push(`${label} : ${violation.id} (${violation.nodes.length})`);
}

for (const size of SIZES) {
  test(`NFR-19 — ${size.name} : chaque écran des parcours P0 se recompose sans défilement horizontal ni fonction perdue`, async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page, setup.email, /\/$/);
    await page.setViewportSize(size.viewport);
    const problems: string[] = [];
    const screens: [string, string][] = [
      ["Aujourd'hui", "/"],
      ["Tâches", "/taches"],
      ["Synthèse de l'évènement", `/events/${setup.eventId}`],
      ["Rétroplanning", `/events/${setup.eventId}?onglet=retroplanning`],
      ["Budget", `/budget/${setup.eventId}/detail`],
      ["Devis", "/devis"],
      ["Contacts", "/contacts"],
    ];
    for (const [label, url] of screens) await checkScreen(page, url, problems, label, true);
    await checkScreen(page, `/jour-j/${setup.eventId}`, problems, "Jour J", false);
    expect(problems).toEqual([]);
  });

  test(`NFR-19 — ${size.name} : le portail des mariés se recompose sans défilement horizontal`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport: size.viewport, locale: "fr-FR" });
    try {
      const page = await context.newPage();
      const problems: string[] = [];
      await page.goto(setup.coupleUrl);
      await expect(page).toHaveURL(/\/portail$/);
      await checkScreen(page, null, problems, "Portail", false);
      expect(problems).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
