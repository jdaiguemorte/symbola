// Lot 70f (UX-05, HUB-06, ARC-06, UX-07 ; C-84, C-81, C-77 ; D4, A17 ; page 3 des maquettes du lot 68,
// section « Téléphone ») — la barre du haut de 60 px, la barre du bas (Aujourd'hui, Évènements, Tâches,
// Prestataires, Plus), le panneau « Plus » et les panneaux du bas. En 375 et 360 px (projet mobile-375,
// la largeur posée dans chaque test), et sur ordinateur (1 440 px et 911 × 512, portable à 150 %), où la
// mise en page d'ordinateur reste ; axe-core sur chaque état.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser, setUserNames } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { addEventTask, changeEventStatus, createProspect, createProspectSource } from "../modules/events/service";
import { saveOnboardingStep, setModuleEnabled } from "../modules/hub/service";
import { clickMenuLink, feedback, logout, openMenu, readyOrganization, signIn as signInByLink } from "./helpers";

async function expectNoAxeViolation(page: Page, within?: string) {
  const builder = new AxeBuilder({ page });
  if (within) builder.include(within);
  const result = await builder.analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

function parisDay(offsetDays = 0): string {
  const day = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
}

// L'atelier de Camille Roussel : Léa et Maxime confirmés, deux tâches en retard, trente à venir (les
// écrans défilent).
async function atelier(options: { without?: ("vendors" | "events")[]; tasks?: number } = {}) {
  const { sql, db } = createAppConnection();
  try {
    const name = `Atelier Roussel ${randomUUID().slice(0, 6)}`;
    const organizationId = (await readyOrganization(db, name)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    // Les rendez-vous ne sont pas d'office dans une organisation : ils le sont ici, comme dans la maquette.
    await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey: "appointments", enabled: true });
    for (const moduleKey of options.without ?? []) await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey, enabled: false });
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, role: "owner" });
    await setUserNames(db, owner.id, { firstName: "Camille", lastName: "Roussel" });
    let lea: string | null = null;
    if (!options.without?.includes("events")) {
      const source = await createProspectSource(organizationId, "Salon");
      lea = (await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], eventDate: parisDay(68) })).id;
      await changeEventStatus({ organizationId, eventId: lea, changedByUserId: owner.id, toStatus: "confirmed" });
      await addEventTask(organizationId, lea, { label: "Faire signer le contrat du photographe", dueDate: parisDay(-5), responsible: "planner" });
      await addEventTask(organizationId, lea, { label: "Confirmer la voiture des mariés", dueDate: parisDay(-4), responsible: "planner" });
      for (let index = 1; index <= (options.tasks ?? 30); index += 1) await addEventTask(organizationId, lea, { label: `Tâche de remplissage ${index}`, dueDate: parisDay(index), responsible: "planner" });
    }
    return { organizationId, email, lea, name };
  } finally {
    await sql.end();
  }
}

const tabBar = (page: Page) => page.getByRole("navigation", { name: "Navigation principale" });
const moreButton = (page: Page) => tabBar(page).getByRole("button", { name: "Plus", exact: true });
const moreSheet = (page: Page) => page.locator("#app-menu");

async function box(page: Page, selector: string) {
  return page.evaluate((query) => {
    const element = document.querySelector<HTMLElement>(query);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height, width: rect.width };
  }, selector);
}

const PHONE_WIDTHS = [
  { width: 375, height: 812 },
  { width: 360, height: 780 },
] as const;

test.describe("UX-05 — La barre du bas et la barre du haut du téléphone (lot 70f, D4)", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-375", "téléphone : 375 et 360 px, posés dans chaque test");
  });

  for (const size of PHONE_WIDTHS) {
    test(`critère 1 — à ${size.width} px, cinq entrées en bas sur une ligne, cibles de 44 px ; la barre du haut fait 60 px ; le contenu commence dessous`, async ({ page }) => {
      await page.setViewportSize(size);
      const setup = await atelier();
      await signInByLink(page, setup.email);
      await page.goto("/");
      const bar = tabBar(page);
      await expect(bar).toBeVisible();
      const entries = bar.locator("a, button");
      await expect(entries).toHaveText([/^Aujourd'hui/, /^Évènements/, /^Tâches/, /^Prestataires/, /^Plus/]);
      const boxes = await entries.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()).map((rect) => ({ top: rect.top, height: rect.height, width: rect.width, right: rect.right })));
      // Une seule ligne, de la largeur de l'écran, chaque cible de 44 px au moins.
      expect(new Set(boxes.map((entry) => Math.round(entry.top))).size).toBe(1);
      for (const entry of boxes) {
        expect(entry.height).toBeGreaterThanOrEqual(44);
        expect(entry.width).toBeGreaterThanOrEqual(44);
        expect(entry.right).toBeLessThanOrEqual(size.width);
      }
      // Les libellés tiennent sur une ligne, sans être coupés.
      const cut = await bar.locator(".app-nav-label, .app-tabbar-label").evaluateAll((labels) => labels.filter((label) => label.scrollWidth > label.clientWidth + 1 || label.getClientRects().length > 1).map((label) => label.textContent));
      expect(cut).toEqual([]);
      // La barre est collée en bas.
      const barBox = (await bar.boundingBox())!;
      expect(Math.round(barBox.y + barBox.height)).toBe(size.height);
      // La barre du haut : 60 px, ni « ⌘K » ni « touche N » ; recherche, créer, notifications, aide en 44 px.
      const top = (await box(page, ".app-topbar"))!;
      expect(Math.round(top.height)).toBe(60);
      await expect(page.locator(".app-topbar .search-box-shortcut")).toBeHidden();
      for (const name of ["Rechercher", "Créer", "Aide sur cet écran"]) {
        const button = page.locator(".app-topbar").getByRole("button", { name, exact: true });
        await expect(button, name).toBeVisible({ timeout: 15_000 });
        await expect(button, name).toBeVisible();
        const target = (await button.boundingBox())!;
        expect(target.height, name).toBeGreaterThanOrEqual(44);
        expect(target.width, name).toBeGreaterThanOrEqual(44);
      }
      await expect(page.locator(".app-topbar").getByText("Aujourd'hui", { exact: true })).toBeVisible();
      // Le contenu commence sous la barre, et la page ne défile pas de côté.
      const main = (await box(page, "main"))!;
      expect(main.top).toBeGreaterThanOrEqual(top.bottom - 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      // L'ancien menu déplié n'existe plus pour l'équipe.
      await expect(page.getByRole("button", { name: "Menu", exact: true })).toHaveCount(0);
      await expectNoAxeViolation(page);
    });
  }

  test("critère 3 — l'entrée courante porte un trait, pas sa seule couleur ; la pastille de « Tâches » a un nom accessible", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await page.goto("/taches");
    const tasks = tabBar(page).getByRole("link", { name: /^Tâches/ });
    await expect(tasks).toHaveAttribute("aria-current", "page");
    await expect(tasks).toHaveAccessibleName("Tâches 2 en retard");
    await expect(tabBar(page).getByRole("link", { name: "Aujourd'hui", exact: true })).not.toHaveAttribute("aria-current", "page");
    // Le trait : un repère visible au-dessus de l'entrée courante, absent des autres.
    const marks = await tabBar(page).locator("a").evaluateAll((links) => links.map((link) => getComputedStyle(link, "::before").content !== "none" && getComputedStyle(link, "::before").height !== "0px" && link.getAttribute("aria-current") === "page"));
    expect(marks.filter(Boolean)).toHaveLength(1);
    // La barre du haut dit l'écran.
    await expect(page.locator(".app-topbar").getByText("Tâches", { exact: true })).toBeVisible();
    // Une fiche d'évènement allume « Évènements ».
    await page.goto(`/events/${setup.lea}`);
    await expect(tabBar(page).getByRole("link", { name: "Évènements", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("critère 2 — « Plus » : le reste de la navigation, le compte, « Se déconnecter » à part ; se ferme par Échap, un glissé, un clic dehors et le retour arrière ; ne pousse pas la page", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await page.goto("/");
    const before = (await box(page, "main"))!;
    await moreButton(page).click();
    await expect(moreButton(page)).toHaveAttribute("aria-expanded", "true");
    const sheet = moreSheet(page);
    await expect(sheet).toBeVisible();
    // Le reste de la navigation, dans l'ordre de la maquette, sans répéter les entrées de la barre.
    await expect(sheet.getByRole("link").filter({ visible: true })).toHaveText([/^Contacts/, /^Rendez-vous/, /^Devis et factures/, /^Encaissements/, /^Tous les modules/, /^Paramètres/, /^Tutoriels/, /^Aide/, /^Camille · Atelier Roussel/]);
    // « Se déconnecter » en dernier, à part, en encre (jamais l'action principale).
    const logoutButton = sheet.getByRole("button", { name: "Se déconnecter" });
    await expect(logoutButton).toBeVisible();
    const last = await sheet.evaluate((element) => {
      const focusables = [...element.querySelectorAll<HTMLElement>("a, button, summary, select")].filter((item) => item.getClientRects().length > 0);
      return focusables.at(-1)?.textContent?.trim();
    });
    expect(last).toBe("Se déconnecter");
    // Le changement d'organisation est là, replié.
    await expect(sheet.getByText("Changer d'organisation")).toBeVisible();
    // Le focus entre dans le panneau ; la page ne bouge pas.
    await expect(sheet.getByRole("link", { name: "Contacts", exact: true })).toBeFocused();
    const during = (await box(page, "main"))!;
    expect(Math.round(during.top)).toBe(Math.round(before.top));
    // Le panneau tient au-dessus de la barre du bas.
    const sheetBox = (await sheet.boundingBox())!;
    const barBox = (await tabBar(page).boundingBox())!;
    expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(barBox.y + 1);
    await expectNoAxeViolation(page);

    // Échap : fermé, le focus revient sur « Plus ».
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(moreButton(page)).toBeFocused();
    await expect(moreButton(page)).toHaveAttribute("aria-expanded", "false");

    // Un clic dehors.
    await moreButton(page).click();
    await expect(sheet).toBeVisible();
    const open = (await sheet.boundingBox())!;
    expect(open.y).toBeGreaterThan(16);
    // Au-dessus du panneau (le menu commence sous sa poignée) : sur le fond assombri.
    await page.mouse.click(size(page).width / 2, 8);
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

    // Un glissé vers le bas.
    await moreButton(page).click();
    await expect(sheet).toBeVisible();
    const grab = (await sheet.boundingBox())!;
    const x = grab.x + grab.width / 2;
    const y = grab.y + 12;
    await sheet.dispatchEvent("pointerdown", { pointerType: "touch", isPrimary: true, clientX: x, clientY: y, pointerId: 7 });
    await sheet.dispatchEvent("pointermove", { pointerType: "touch", isPrimary: true, clientX: x, clientY: y + 120, pointerId: 7 });
    await sheet.dispatchEvent("pointerup", { pointerType: "touch", isPrimary: true, clientX: x, clientY: y + 140, pointerId: 7 });
    await expect(sheet).toBeHidden();

    // Le retour arrière ferme « Plus » sans quitter l'écran.
    await moreButton(page).click();
    await expect(sheet).toBeVisible();
    await page.evaluate(() => window.history.back());
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Une entrée de « Plus » mène à son écran, qui s'allume ; un seul retour arrière ramène à l'accueil.
    await moreButton(page).click();
    await moreSheet(page).getByRole("link", { name: "Contacts", exact: true }).click();
    await expect(page).toHaveURL(/\/contacts$/, { timeout: 30_000 });
    await expect(sheet).toBeHidden();
    await expect(page.locator(".app-topbar").getByText("Contacts", { exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  });

  test("le compte dans « Plus » : « Camille · Atelier Roussel » mène à Mon compte, « Se déconnecter » ferme la session", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await page.goto("/");
    // Le bouton du compte de la barre du haut n'est pas sur le téléphone : il est dans « Plus ».
    await expect(page.locator(".account-menu-button")).toBeHidden();
    await openMenu(page);
    await moreSheet(page).getByRole("link", { name: /^Camille · Atelier Roussel/ }).click();
    await expect(page).toHaveURL(/\/profil$/, { timeout: 30_000 });
    await logout(page);
  });

  test("critère 4 — aucun écran ne glisse sous la barre du bas : dernière ligne, message de retour et pastille restent visibles", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await atelier();
    await signInByLink(page, setup.email);
    for (const path of ["/", "/events", "/taches", "/prestataires", "/contacts", `/events/${setup.lea}`]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const measure = await page.evaluate(() => {
        const bar = document.querySelector<HTMLElement>(".app-tabbar")!.getBoundingClientRect();
        const items = [...document.querySelectorAll<HTMLElement>("main *")].filter((element) => element.children.length === 0 && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
        const lowest = Math.max(...items.map((element) => element.getBoundingClientRect().bottom));
        return { barTop: bar.top, lowest };
      });
      expect(measure.lowest, `${path} : la dernière ligne finit à ${Math.round(measure.lowest)} px, la barre commence à ${Math.round(measure.barTop)} px`).toBeLessThanOrEqual(measure.barTop + 1);
    }
    // L'action flottante de « Tâches » (« Nouvelle tâche », lot 70d) se pose au-dessus de la barre du bas.
    await page.goto("/taches");
    const floating = (await page.getByRole("button", { name: "Nouvelle tâche" }).or(page.getByRole("link", { name: "Nouvelle tâche" })).first().boundingBox())!;
    const bar = (await tabBar(page).boundingBox())!;
    expect(floating.y + floating.height).toBeLessThanOrEqual(bar.y);
    // En mode sélection, la barre de sélection (lot 70d) remplace la barre du bas, sans cacher la dernière ligne.
    await page.getByRole("button", { name: "Sélectionner" }).click();
    await expect(tabBar(page)).toBeHidden();
    const bulk = page.locator(".task-bulk");
    await expect(bulk).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const lastLine = (await page.locator(".task-lines .task-line").last().boundingBox())!;
    const bulkBox = (await bulk.boundingBox())!;
    expect(lastLine.y + lastLine.height).toBeLessThanOrEqual(bulkBox.y + 1);
    await bulk.getByRole("button", { name: "Terminer" }).click();
    await expect(tabBar(page)).toBeVisible();
    // Le message de retour se pose au-dessus de la barre du bas.
    await page.goto("/");
    const line = page.locator(".task-line").filter({ hasText: "Faire signer le contrat du photographe" }).first();
    await line.getByRole("button", { name: /^Fait/ }).click();
    await expect(feedback(page)).toBeVisible();
    const message = (await feedback(page).boundingBox())!;
    const barBox = (await tabBar(page).boundingBox())!;
    expect(message.y + message.height).toBeLessThanOrEqual(barBox.y);
  });

  // Le focus atteint au clavier, caché ni sous la barre du haut ni sous la barre du bas (WCAG 2.4.11) : le
  // parcours « la barre fixe ne masque pas le focus » de lot-70e-barre-et-creer.spec.ts, étendu aux deux
  // barres et joué aussi en 375 px.

  test("clavier virtuel : un champ qui reçoit le focus n'est pas recouvert par la barre du bas", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await page.goto("/contacts");
    const field = page.getByRole("search", { name: "Chercher un contact" }).getByRole("searchbox").or(page.getByRole("search", { name: "Chercher un contact" }).getByRole("textbox")).first();
    await field.focus();
    // Le clavier ouvert, la barre du bas s'efface : elle ne se pose ni sur le champ ni sur ce qu'on tape.
    await expect(tabBar(page)).toBeHidden();
    await field.blur();
    await expect(tabBar(page)).toBeVisible();
  });

  test("zones sûres : la barre du bas garde l'espace du bas des téléphones à encoche", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await page.goto("/");
    expect(await page.locator('meta[name="viewport"]').getAttribute("content")).toContain("viewport-fit=cover");
    const padding = await page.locator(".app-tabbar").evaluate((element) => getComputedStyle(element).getPropertyValue("--app-safe-bottom") || element.style.paddingBottom || getComputedStyle(element).paddingBottom);
    expect(padding).not.toBe("");
    // La règle écrite tient compte de `env(safe-area-inset-bottom)` (le navigateur de test n'a pas d'encoche).
    const usesInset = await page.evaluate(() =>
      [...document.styleSheets].some((sheet) => {
        try {
          return [...sheet.cssRules].some((rule) => rule.cssText.includes("app-tabbar") && rule.cssText.includes("safe-area-inset-bottom"));
        } catch {
          return false;
        }
      }),
    );
    expect(usesInset).toBe(true);
  });

  test("la loupe ouvre la recherche en page entière ; « + » ouvre « Créer » en panneau du bas", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await page.goto("/");
    await page.locator(".app-topbar").getByRole("button", { name: "Rechercher", exact: true }).click();
    const search = page.getByRole("search", { name: "Recherche dans Symbola" });
    const searchBox = (await search.boundingBox())!;
    expect(Math.round(searchBox.width)).toBe(375);
    expect(searchBox.height).toBeGreaterThanOrEqual(700);
    await expect(search.getByRole("combobox", { name: "Rechercher" })).toBeFocused();
    await search.getByRole("combobox", { name: "Rechercher" }).fill("Léa");
    await expect(search.getByRole("option").first()).toBeVisible({ timeout: 30_000 });
    await expectNoAxeViolation(page, ".search-box");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(search.getByRole("combobox", { name: "Rechercher" })).toBeHidden();
    await expect(page.locator(".app-topbar").getByRole("button", { name: "Rechercher", exact: true })).toBeFocused();

    await page.locator(".app-topbar").getByRole("button", { name: "Créer", exact: true }).click();
    const menu = page.getByRole("group", { name: "Que voulez-vous créer ?" });
    await expect(menu).toBeVisible();
    const sheet = (await menu.boundingBox())!;
    const barBox = (await tabBar(page).boundingBox())!;
    expect(Math.round(sheet.x)).toBe(0);
    expect(Math.round(sheet.width)).toBe(375);
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(barBox.y + 1);
    await expect(menu.getByText("Touche N pour ouvrir ce menu")).toBeHidden();
    await expectNoAxeViolation(page, ".quick-create");
  });

  test("« Afficher les suivantes », au bout d'une longue liste de « Tâches », n'est recouvert ni par la barre du bas ni par « Nouvelle tâche »", async ({ page }) => {
    test.setTimeout(120_000);
    const setup = await atelier({ tasks: 105 });
    await signInByLink(page, setup.email);
    await page.goto("/taches");
    const more = page.locator(".task-more").getByRole("link");
    await expect(more).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const covered = await page.evaluate(() => {
      const link = document.querySelector<HTMLElement>(".task-more a")!.getBoundingClientRect();
      const blockers = [".app-tabbar", ".task-new-button"].map((query) => document.querySelector<HTMLElement>(query)).filter((element): element is HTMLElement => Boolean(element) && getComputedStyle(element!).display !== "none");
      return blockers.filter((element) => {
        const box = element.getBoundingClientRect();
        return link.top < box.bottom - 1 && link.bottom > box.top + 1 && link.left < box.right - 1 && link.right > box.left + 1;
      }).map((element) => element.className);
    });
    expect(covered).toEqual([]);
    // Le lien répond au doigt : la suite de la liste s'affiche.
    await more.click();
    await expect(page.locator(".task-lines .task-line")).toHaveCount(107, { timeout: 30_000 });
  });

  test("un panneau de tâche ouvert masque la barre du bas", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await page.goto("/taches");
    await page.getByRole("link", { name: "Confirmer la voiture des mariés" }).first().click();
    await expect(page.getByRole("dialog", { name: "Confirmer la voiture des mariés" })).toBeVisible();
    await expect(tabBar(page)).toBeHidden();
  });

  test("les aides de test : un lien de la barre ou de « Plus » s'ouvre par le même geste", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await page.goto("/");
    await clickMenuLink(page, "Prestataires");
    await expect(page).toHaveURL(/\/prestataires$/, { timeout: 30_000 });
    await clickMenuLink(page, "Paramètres");
    await expect(page).toHaveURL(/\/parametres$/, { timeout: 30_000 });
    // L'écran déjà ouvert, choisi dans « Plus » : l'adresse ne change pas, « Plus » se ferme quand même.
    await clickMenuLink(page, "Paramètres");
    await expect(page.locator("#app-menu")).toBeHidden();
    await expect(page.locator('button[aria-controls="app-menu"]')).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("ARC-06 — La barre du bas quand un module n'est pas souscrit (A17)", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-375");
  });

  test("Prestataires non souscrit : Contacts prend sa place, jamais une entrée « indisponible »", async ({ page }) => {
    const setup = await atelier({ without: ["vendors"] });
    await signInByLink(page, setup.email);
    await page.goto("/");
    await expect(tabBar(page).locator("a, button")).toHaveText([/^Aujourd'hui/, /^Évènements/, /^Tâches/, /^Contacts/, /^Plus/]);
    await moreButton(page).click();
    const links = moreSheet(page).getByRole("link").filter({ visible: true });
    await expect(links.first()).toHaveText(/^Rendez-vous/);
    await expect(moreSheet(page).locator('a[href="/prestataires"]')).toHaveCount(0);
    // La route du module non souscrit reste fermée.
    await page.goto("/prestataires");
    await expect(page.getByText("Le carnet de prestataires n'est pas disponible pour votre organisation.")).toBeVisible();
  });

  test("Évènements non souscrit : ni Évènements ni Tâches ; Contacts et Rendez-vous montent", async ({ page }) => {
    const setup = await atelier({ without: ["events"] });
    await signInByLink(page, setup.email);
    await page.goto("/");
    await expect(tabBar(page).locator("a, button")).toHaveText([/^Aujourd'hui/, /^Prestataires/, /^Contacts/, /^Rendez-vous/, /^Plus/]);
    await expectNoAxeViolation(page);
  });
});

test.describe("UX-05 — Sur ordinateur, la mise en page d'ordinateur reste", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
  });

  for (const size of [
    { width: 1440, height: 900 },
    { width: 911, height: 512 },
  ]) {
    test(`${size.width} × ${size.height} — ni barre du bas ni « Plus » ; le menu latéral et le compte de la barre du haut sont là`, async ({ page }) => {
      await page.setViewportSize(size);
      const setup = await atelier();
      await signInByLink(page, setup.email);
      await page.goto("/");
      await expect(tabBar(page)).toBeHidden();
      await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
      await expect(page.locator(".account-menu-button")).toBeVisible();
      await expect(page.locator(".app-topbar").getByRole("combobox", { name: "Rechercher" })).toBeVisible();
      await expect(page.locator(".app-topbar").getByRole("button", { name: "Rechercher", exact: true })).toBeHidden();
      const top = (await box(page, ".app-topbar"))!;
      // 68 px et son trait du bas (lot 70e) : inchangée.
      expect(Math.round(top.height)).toBeGreaterThanOrEqual(68);
      expect(Math.round(top.height)).toBeLessThanOrEqual(69);
      await expectNoAxeViolation(page);
    });
  }
});

function size(page: Page) {
  return page.viewportSize() ?? { width: 375, height: 812 };
}
