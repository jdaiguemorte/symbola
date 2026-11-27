// Lot 72d (EVT-02, EVT-05, UX-05, UX-06, UX-07 ; C-22, C-23, C-27, C-80, C-82 ; E1 à E4, J9 à J12 ; P-12 ;
// page 15 des maquettes du lot 68) — l'en-tête de la fiche d'un évènement, ses onglets et sa frise, à
// 1 440 px, à 911 × 512 (portable à 150 %), à 375 et à 360 px, avec axe-core sur chaque état. Les mesures
// sont celles de la note 09, § 5 : la hauteur de l'en-tête, le haut du contenu, les zones d'action du premier
// écran, les commandes posées avant le contenu (avant ce lot : contenu à 452 px, douze commandes).
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser, setUserNames } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { addEventTask, archiveEvent, cancelEvent, changeEventStatus, createEventLink, createLossReason, createProspect, createProspectSource, postponeEvent } from "../modules/events/service";
import { saveOnboardingStep } from "../modules/hub/service";
import { feedback, readyOrganization, signIn } from "./helpers";

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

type Setup = { email: string; organizationId: string; eventId: string; ownerId: string };

// L'atelier de Camille : « Léa & Maxime », signé, deux tâches en retard et d'autres à venir, un lien des mariés.
async function atelier(options: { status?: "option" | "confirmed"; days?: number; state?: "postponed" | "cancelled" | "archived" } = {}): Promise<Setup> {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier Roussel ${randomUUID().slice(0, 6)}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    const email = `camille-72d-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, role: "owner" });
    await setUserNames(db, owner.id, { firstName: "Camille", lastName: "Roussel" });
    const source = await createProspectSource(organizationId, "Salon");
    const eventId = (
      await createProspect({
        organizationId,
        createdByUserId: owner.id,
        prospectSourceId: source.id,
        clients: [{ firstName: "Léa", lastName: "Martin", email: `lea-${randomUUID()}@symbola.test` }, { firstName: "Maxime", lastName: "Roux" }],
        eventDate: parisDay(options.days ?? 199),
        venueName: "Manoir des Aulnes",
        venueCity: "Poitiers",
      })
    ).id;
    if ((options.status ?? "confirmed") === "confirmed") await changeEventStatus({ organizationId, eventId, changedByUserId: owner.id, toStatus: "confirmed" });
    await addEventTask(organizationId, eventId, { label: "Faire signer le contrat du photographe", dueDate: parisDay(-5), responsible: "planner" });
    await addEventTask(organizationId, eventId, { label: "Confirmer la voiture des mariés", dueDate: parisDay(-4), responsible: "planner" });
    for (let index = 1; index <= 12; index += 1) await addEventTask(organizationId, eventId, { label: `Tâche à venir ${index}`, dueDate: parisDay(index + 2), responsible: "planner" });
    await createEventLink({ organizationId, eventId, createdByUserId: owner.id, audience: "client", locale: "fr", link: { personName: "Léa Martin", email: `lea-lien-${randomUUID()}@symbola.test`, rights: { rubrics: ["tasks", "program"], budgetScope: "all", sharedSlotIds: [] } } });
    if (options.state === "postponed") await postponeEvent({ organizationId, eventId, changedByUserId: owner.id, newDate: parisDay(260) });
    if (options.state === "cancelled" || options.state === "archived") {
      const reason = await createLossReason(organizationId, "Budget", false);
      await cancelEvent({ organizationId, eventId, changedByUserId: owner.id, lossReasonId: reason.id, lossReasonNote: null });
    }
    if (options.state === "archived") await archiveEvent({ organizationId, eventId, userId: owner.id });
    return { email, organizationId, eventId, ownerId: owner.id };
  } finally {
    await sql.end();
  }
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;
const header = (page: Page) => page.locator("#event-header");
const tabs = (page: Page) => page.getByRole("tablist", { name: "Sections de l'évènement" });
const menuButton = (page: Page) => header(page).getByRole("button", { name: "Plus d'actions pour Léa & Maxime" });
const menu = (page: Page) => page.getByRole("menu", { name: "Plus d'actions pour Léa & Maxime" });

// Les mesures de la note 09, § 5 : hauteurs comptées sous la barre du haut ; une zone d'action est un bloc de
// premier rang du contenu qui porte une commande dans le premier écran ; le contenu d'un onglet en est une.
async function measure(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    const topbar = document.querySelector(".app-topbar")!.getBoundingClientRect().bottom;
    const head = document.getElementById("event-header")!.getBoundingClientRect();
    const tabbar = document.querySelector(".event-tabbar")!.getBoundingClientRect();
    const panel = document.getElementById("event-tab-panel")!;
    const first = [...panel.children].find((child) => child.getBoundingClientRect().height > 0) ?? panel;
    const content = first.getBoundingClientRect().top;
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > topbar && getComputedStyle(element).visibility !== "hidden" && !element.closest("[popover], dialog");
    };
    const controls = [...main.querySelectorAll("a[href], button, select, input:not([type=hidden]), textarea")].filter(visible);
    const zones = new Set(controls.map((control) => {
      let node = control as Element;
      while (node.parentElement && node.parentElement !== main) node = node.parentElement;
      return node;
    }));
    const beforeContent = controls.filter((control) => control.getBoundingClientRect().bottom <= content + 1 && !control.closest("[role=tablist]"));
    return { header: Math.round(tabbar.bottom - topbar), headerWithoutTabs: Math.round(tabbar.top - topbar), content: Math.round(content - topbar), headerTop: Math.round(head.top), zones: zones.size, commands: beforeContent.length };
  });
}

test.describe("EVT-02 — L'en-tête de la fiche tient en 200 px, avec tous ses onglets (lot 72d)", () => {
  test("1 440 px : l'en-tête et les onglets en 200 px, un bouton et un menu, le statut dit une fois, trois zones d'action", async ({ page }) => {
    test.skip(isPhone(page), "mesure d'ordinateur");
    await page.setViewportSize({ width: 1440, height: 900 });
    const setup = await atelier();
    await signIn(page, setup.email);
    await page.goto(`/events/${setup.eventId}`);
    await expect(header(page).getByRole("heading", { level: 1, name: "Léa & Maxime" })).toBeVisible();
    const measures = await measure(page);
    // Avant le lot : onglets de 392 à 436 px, contenu à 452 px, cinq zones, douze commandes avant le contenu.
    expect(measures.header).toBeLessThanOrEqual(200);
    expect(measures.content).toBeLessThanOrEqual(200);
    expect(measures.zones).toBeLessThanOrEqual(3);
    expect(measures.commands).toBeLessThanOrEqual(3);
    // Une action, un menu ; plus de pastille de statut ni de formulaire de type dans l'en-tête.
    await expect(header(page).getByRole("link", { name: "Écrire aux mariés" })).toBeVisible();
    await expect(menuButton(page)).toBeVisible();
    await expect(header(page).getByRole("combobox")).toHaveCount(0);
    await expect(header(page).getByText("Signé, en préparation", { exact: true })).toHaveCount(1);
    await expect(header(page)).toContainText("dans 199 jours");
    await expect(header(page)).toContainText("Manoir des Aulnes, Poitiers");
    // Tous les onglets visibles, l'ouvert marqué ; « Programme » ; « 2 en retard » sur les tâches.
    for (const name of ["Synthèse", "Budget et prestataires", "Tâches", "Programme", "Devis et factures", "Mariés", "Documents"]) await expect(tabs(page).getByRole("tab", { name: new RegExp(`^${name}`) })).toBeVisible();
    await expect(tabs(page).getByRole("tab", { name: /^Synthèse/ })).toHaveAttribute("aria-selected", "true");
    await expect(tabs(page).getByRole("tab", { name: /^Tâches/ })).toContainText("2 en retard");
    await expect(page.getByRole("button", { name: "Autres sections de l'évènement" })).toHaveCount(0);
    await expectNoAxeViolation(page, "#event-header");
    await expectNoAxeViolation(page, ".event-tabbar");
  });

  test("911 × 512 : l'action et la première ligne de la Synthèse dans le premier écran ; aucun onglet coupé ; « Plus ▾ » ; la barre fine garde l'onglet", async ({ page }) => {
    test.skip(isPhone(page), "portable à 150 %");
    await page.setViewportSize({ width: 911, height: 512 });
    const setup = await atelier();
    await signIn(page, setup.email);
    await page.goto(`/events/${setup.eventId}`);
    const action = header(page).getByRole("link", { name: "Écrire aux mariés" });
    await expect(action).toBeInViewport();
    expect((await action.boundingBox())!.y + (await action.boundingBox())!.height).toBeLessThanOrEqual(512);
    const firstLine = page.locator("#event-tab-panel .task-line, #event-tab-panel li").first();
    const lineBox = (await firstLine.boundingBox())!;
    expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(512);
    // Aucun onglet coupé en plein mot : chaque onglet affiché tient dans sa largeur et dans la barre.
    const cut = await tabs(page).evaluate((list) => {
      const right = list.getBoundingClientRect().right;
      return [...list.querySelectorAll<HTMLElement>("[role=tab]")].filter((tab) => tab.offsetParent !== null && (tab.scrollWidth > tab.clientWidth + 1 || tab.getBoundingClientRect().right > right + 1)).map((tab) => tab.textContent);
    });
    expect(cut).toEqual([]);
    await expect(tabs(page).getByRole("tab", { name: /^Synthèse/ })).toBeVisible();
    const more = page.getByRole("button", { name: "Autres sections de l'évènement" });
    await expect(more).toBeVisible();
    await more.click();
    const moreMenu = page.getByRole("menu", { name: "Autres sections de l'évènement" });
    await expect(moreMenu.getByRole("menuitem", { name: /^Documents/ })).toBeVisible();
    await expectNoAxeViolation(page, ".event-tabbar");
    await moreMenu.getByRole("menuitem", { name: /^Documents/ }).click();
    await expect(page).toHaveURL(/onglet=documents/);
    // L'onglet ouvert reste visible : il a pris la place d'un autre dans la barre.
    await expect(tabs(page).getByRole("tab", { name: /^Documents/ })).toHaveAttribute("aria-selected", "true");
    await expect(tabs(page).getByRole("tab", { name: /^Documents/ })).toBeVisible();

    // En défilant, la barre fine : le nom, la date, le statut, les onglets et le menu, pas l'action.
    await tabs(page).getByRole("tab", { name: /^Synthèse/ }).click();
    await expect(page).not.toHaveURL(/onglet=documents/);
    await page.mouse.wheel(0, 700);
    const bar = page.locator(".event-tabbar");
    await expect(bar).toHaveAttribute("data-stuck", "true");
    const summary = bar.locator(".event-tabbar-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("Léa & Maxime");
    await expect(summary).toContainText("Signé, en préparation");
    await expect(summary.getByRole("button", { name: "Plus d'actions pour Léa & Maxime" })).toBeVisible();
    await expect(summary.getByRole("link", { name: "Écrire aux mariés" })).toHaveCount(0);
    // Changer d'onglet garde la barre en place (pas de retour en haut de la page).
    await tabs(page).getByRole("tab", { name: /^Tâches/ }).click();
    await expect(page).toHaveURL(/onglet=taches/);
    await expect(bar).toHaveAttribute("data-stuck", "true");
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const barTop = (await bar.boundingBox())!.y;
    const topbarBottom = await page.locator(".app-topbar").evaluate((element) => element.getBoundingClientRect().bottom);
    expect(barTop).toBeGreaterThanOrEqual(topbarBottom - 1);
    expect(barTop).toBeLessThanOrEqual(topbarBottom + 50);
  });

  test("téléphone (375 et 360 px) : les onglets à 224 px au plus, l'ouvert visible, seule la barre des onglets défile de côté, cibles de 44 px", async ({ page }) => {
    test.skip(!isPhone(page), "téléphone");
    const setup = await atelier();
    await signIn(page, setup.email);
    for (const width of [375, 360]) {
      await page.setViewportSize({ width, height: 780 });
      await page.goto(`/events/${setup.eventId}?onglet=documents`);
      const list = tabs(page);
      await expect(list.getByRole("tab", { name: /^Documents/ })).toHaveAttribute("aria-selected", "true");
      expect((await list.boundingBox())!.y).toBeLessThanOrEqual(224);
      // L'onglet ouvert est amené dans le cadre de la barre.
      await expect(list.getByRole("tab", { name: /^Documents/ })).toBeInViewport({ ratio: 1 });
      // Seule la barre des onglets défile de côté ; la page non.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      expect(await list.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      // Noms courts sur téléphone ; les nombres restent.
      await expect(list.getByRole("tab", { name: /^Budget 0\/9$/ })).toHaveCount(1);
      // Pas de bouton dans l'en-tête : l'action est en tête du menu.
      await expect(header(page).getByRole("link", { name: "Écrire aux mariés" })).toBeHidden();
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("#event-header a, #event-header button, .event-tabbar a, .event-tabbar button")]
          .filter((element) => element.offsetParent !== null)
          .filter((element) => element.getBoundingClientRect().height < 44 || element.getBoundingClientRect().width < 24)
          .map((element) => element.textContent?.trim() || element.getAttribute("aria-label")),
      );
      expect(small).toEqual([]);
    }
    await page.goto(`/events/${setup.eventId}`);
    await expectNoAxeViolation(page, "#event-header");
    await expectNoAxeViolation(page, ".event-tabbar");
    // La flèche de la barre mène aux onglets suivants.
    const scroller = page.getByRole("button", { name: "Voir les sections suivantes" });
    await expect(scroller).toBeVisible();
    const before = await tabs(page).evaluate((element) => element.scrollLeft);
    await scroller.click();
    await expect.poll(() => tabs(page).evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
    // Le menu « ⋯ » en panneau du bas, le nom du mariage en tête, « Écrire aux mariés » d'abord.
    await menuButton(page).click();
    await expect(menu(page)).toBeVisible();
    await expect(page.locator(".event-menu .event-menu-title")).toHaveText("Léa & Maxime");
    await expect(menu(page).getByRole("menuitem").first()).toHaveAccessibleName(/^Écrire aux mariés/);
    const sheet = (await page.locator(".event-menu").boundingBox())!;
    expect(Math.round(sheet.y + sheet.height)).toBeGreaterThanOrEqual(779);
    await expectNoAxeViolation(page, ".event-menu");
    await page.keyboard.press("Escape");
    // « Les étapes » : la frise complète en panneau du bas.
    await header(page).getByRole("button", { name: "Les étapes" }).click();
    const steps = page.getByRole("dialog", { name: "Les étapes de « Léa & Maxime »" });
    await expect(steps.getByRole("list")).toContainText("Signé, en préparation");
    await expect(steps.getByRole("listitem").filter({ hasText: "Signé, en préparation" })).toHaveAttribute("aria-current", "step");
    await expectNoAxeViolation(page, ".event-steps-sheet");
  });

  test("téléphone : « ← » et le nom du mariage dans la barre du haut ; le retour ramène d'où l'on vient (P-12)", async ({ page }) => {
    test.skip(!isPhone(page), "téléphone");
    const setup = await atelier();
    await signIn(page, setup.email);
    const topbar = page.locator(".app-topbar");
    // Depuis la liste des évènements.
    await page.goto("/events");
    await page.getByRole("link", { name: /Léa & Maxime/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/events/${setup.eventId}`));
    await expect(topbar).toContainText("Léa & Maxime");
    await expect(topbar).not.toContainText("Évènements");
    await topbar.getByRole("link", { name: "Retour à Évènements" }).click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(topbar).toContainText("Évènements");
    // Depuis « Tâches », en passant par un autre onglet de la fiche.
    await page.goto("/taches");
    await page.goto(`/events/${setup.eventId}`);
    await tabs(page).getByRole("tab", { name: /^Tâches/ }).click();
    await expect(page).toHaveURL(/onglet=taches/);
    await topbar.getByRole("link", { name: "Retour à Tâches" }).click();
    await expect(page).toHaveURL(/\/taches(\?|$)/);
    // Depuis « Aujourd'hui ».
    await page.goto("/");
    await page.goto(`/events/${setup.eventId}`);
    await topbar.getByRole("link", { name: "Retour à Aujourd'hui" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expectNoAxeViolation(page, ".app-topbar");
  });

  test("clavier : le menu « ⋯ », « Plus ▾ » et les flèches entre les onglets ; le focus n'est jamais caché sous la barre fine", async ({ page }) => {
    test.skip(isPhone(page), "clavier d'ordinateur");
    await page.setViewportSize({ width: 911, height: 512 });
    const setup = await atelier();
    await signIn(page, setup.email);
    await page.goto(`/events/${setup.eventId}`);
    await menuButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(menu(page)).toBeVisible();
    await expect(menu(page).getByRole("menuitem", { name: /^Messages/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu(page).getByRole("menuitem", { name: /^Voir comme Léa Martin/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu(page)).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
    // Les flèches passent d'un onglet à l'autre.
    await tabs(page).getByRole("tab", { name: /^Synthèse/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs(page).getByRole("tab", { name: /^Budget et prestataires/ })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tabs(page).getByRole("tab", { name: /^Synthèse/ })).toBeFocused();
    // « Plus ▾ » au clavier.
    const more = page.getByRole("button", { name: "Autres sections de l'évènement" });
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu", { name: "Autres sections de l'évènement" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    // WCAG 2.4.11 : en avançant au clavier dans la Synthèse, rien n'est caché sous la barre du haut ni sous
    // la barre fine et ses onglets.
    const hidden: string[] = [];
    for (let stop = 0; stop < 25; stop += 1) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        const bars = [...document.querySelectorAll<HTMLElement>(".app-topbar, .event-tabbar")];
        if (!active || active === document.body || bars.some((bar) => bar.contains(active)) || active.closest("[popover], dialog")) return null;
        const box = active.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return null;
        const covered = bars.map((bar) => bar.getBoundingClientRect()).some((bar) => box.top < bar.bottom - 1 && box.bottom > bar.top + 1 && box.left < bar.right && box.right > bar.left);
        return covered ? (active.textContent ?? active.tagName).trim().slice(0, 40) : null;
      });
      if (state) hidden.push(state);
    }
    expect(hidden).toEqual([]);
  });
});

test.describe("EVT-02 — « Ouvrir le Jour J » prend la place de l'action de J-N au lendemain (J9)", () => {
  test("à J-5 l'action est « Ouvrir le Jour J » ; à J-10, « Écrire aux mariés », jusqu'à ce que le réglage passe à 14 jours", async ({ page }) => {
    test.skip(isPhone(page), "l'action de l'en-tête est un bouton d'ordinateur");
    const near = await atelier({ days: 5 });
    await signIn(page, near.email);
    await page.goto(`/events/${near.eventId}`);
    await expect(header(page).getByRole("link", { name: "Ouvrir le Jour J" })).toBeVisible();
    await expect(header(page).getByRole("link", { name: "Écrire aux mariés" })).toHaveCount(0);
    // « Écrire aux mariés » passe au menu ; l'écran du jour J y est aussi.
    await menuButton(page).click();
    await expect(menu(page).getByRole("menuitem", { name: /^Écrire aux mariés/ })).toBeVisible();
    await expect(menu(page).getByRole("menuitem", { name: /^Ouvrir le Jour J/ })).toBeVisible();
    await page.keyboard.press("Escape");

    const far = await atelier({ days: 10 });
    await signIn(page, far.email);
    await page.goto(`/events/${far.eventId}`);
    await expect(header(page).getByRole("link", { name: "Écrire aux mariés" })).toBeVisible();
    await menuButton(page).click();
    // Le mariage est signé et daté : l'écran du jour J est au menu dès maintenant.
    await expect(menu(page).getByRole("menuitem", { name: /^Ouvrir le Jour J/ })).toBeVisible();
    await page.keyboard.press("Escape");

    // Le réglage : 0 et 31 sont refusés sous le champ ; 14 s'enregistre seul.
    await page.goto("/events/parametres/listes-jour-j");
    const field = page.getByLabel("Le bouton « Ouvrir le Jour J » apparaît dans l'en-tête de la fiche");
    await expect(field).toHaveValue("7");
    for (const refused of ["0", "31"]) {
      await field.fill(refused);
      await field.blur();
      await expect(page.locator(".field-error")).toContainText("Indiquez un nombre de jours entre 1 et 30.");
      await expect(field).toHaveAttribute("aria-invalid", "true");
    }
    await field.fill("14");
    await field.blur();
    await expect(page.getByRole("status").filter({ hasText: "✓ Enregistré" })).toBeVisible();
    await expectNoAxeViolation(page);
    await page.goto(`/events/${far.eventId}`);
    await expect(header(page).getByRole("link", { name: "Ouvrir le Jour J" })).toBeVisible();
  });
});

test.describe("EVT-05 — La frise se lit ; l'étape suivante a son bouton ; les états ont leur ligne (lot 72d)", () => {
  test("aucun rond ne réagit au clic ; « Le contrat est signé… » ouvre la question dessous et pose « Signé » à la date choisie, sans tâche", async ({ page }) => {
    const setup = await atelier({ status: "option" });
    await signIn(page, setup.email);
    await page.goto(`/events/${setup.eventId}?onglet=taches`);
    const where = isPhone(page) ? page.locator(".event-steps-sheet") : header(page);
    if (isPhone(page)) await header(page).getByRole("button", { name: "Les étapes" }).click();
    const steps = where.getByRole("list", { name: /Où en est l'évènement|Les étapes/ });
    await expect(steps.getByRole("listitem").filter({ hasText: "Une demande en cours" })).toHaveAttribute("aria-current", "step");
    await expect(steps.getByRole("button")).toHaveCount(0);
    await expect(steps.getByRole("listitem")).toHaveCount(4);
    await expect(steps).not.toContainText("En préparation");
    const tasksBefore = await page.locator(".task-line").count();
    const sign = where.getByRole("button", { name: "Le contrat est signé…" });
    await sign.click();
    const question = where.getByRole("form", { name: "Le contrat de Léa & Maxime est signé ?" });
    await expect(question).toBeVisible();
    // La question s'ouvre juste sous le bouton.
    const signBox = (await sign.boundingBox())!;
    const questionBox = (await question.boundingBox())!;
    expect(questionBox.y).toBeGreaterThanOrEqual(signBox.y + signBox.height - 1);
    expect(questionBox.y - (signBox.y + signBox.height)).toBeLessThanOrEqual(40);
    await expect(question.getByRole("button", { name: "Garder en demande" })).toBeVisible();
    await expectNoAxeViolation(page, isPhone(page) ? ".event-steps-sheet" : "#event-header");
    // Une date future est dite sous le champ.
    await question.getByLabel("Signé le").fill(parisDay(3));
    await question.getByRole("button", { name: "Passer en signé" }).click();
    await expect(question.locator(".field-error")).toContainText("ne peut pas être après aujourd'hui");
    await question.getByLabel("Signé le").fill(parisDay(-20));
    await question.getByRole("button", { name: "Passer en signé" }).click();
    await expect(feedback(page)).toContainText("Contrat signé : Léa & Maxime");
    await expect(feedback(page).getByRole("button", { name: "Annuler" })).toBeVisible();
    if (isPhone(page)) {
      await page.keyboard.press("Escape");
      await expect(header(page)).toContainText("Signé, en préparation");
    } else {
      await expect(header(page).getByRole("listitem").filter({ hasText: "Signé, en préparation" })).toHaveAttribute("aria-current", "step");
    }
    // Aucune tâche créée.
    await expect(page.locator(".task-line")).toHaveCount(tasksBefore);
  });

  test("Reporter et Annuler sont au menu, Annuler en dernier et à part ; leurs fenêtres de niveau 2 nomment l'évènement et proposent « Garder … »", async ({ page }) => {
    const setup = await atelier();
    await signIn(page, setup.email);
    await page.goto(`/events/${setup.eventId}`);
    await menuButton(page).click();
    const items = menu(page).getByRole("menuitem");
    await expect(items.last()).toHaveAccessibleName(/^Annuler l'évènement…/);
    await expect(items.last()).toHaveClass(/task-menu-danger/);
    await expect(menu(page).locator("hr")).toHaveCount(1);
    await expect(menu(page).getByRole("menuitem", { name: /^Changer le type…/ })).toBeVisible();
    await menu(page).getByRole("menuitem", { name: /^Reporter l'évènement…/ }).click();
    const postpone = page.getByRole("dialog", { name: "Reporter l'évènement « Léa & Maxime » ?" });
    await expect(postpone).toBeVisible();
    await expect(postpone).toHaveAttribute("data-danger-level", "2");
    await expectNoAxeViolation(page, "dialog[open]");
    await postpone.getByRole("button", { name: "Garder la date" }).click();
    await expect(postpone).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
    await menuButton(page).click();
    await menu(page).getByRole("menuitem", { name: /^Annuler l'évènement…/ }).click();
    const cancel = page.getByRole("dialog", { name: "Annuler l'évènement « Léa & Maxime » ?" });
    await expect(cancel).toHaveAttribute("data-danger-level", "2");
    await expect(cancel.getByRole("button", { name: "Garder l'évènement" })).toBeVisible();
    await cancel.getByLabel("Motif").selectOption({ index: 1 });
    await cancel.getByRole("button", { name: "Annuler l'évènement", exact: true }).click();
    await expect(feedback(page)).toContainText("Léa & Maxime");
    // Annulé : la ligne d'état et sa seule suite, jamais la frise.
    const line = header(page).locator(".event-status-line");
    await expect(line).toContainText("Annulé le");
    await expect(header(page).getByRole("list", { name: "Où en est l'évènement" })).toHaveCount(0);
    await line.getByRole("button", { name: "Rétablir l'évènement…" }).click();
    const restore = page.getByRole("dialog", { name: "Rétablir « Léa & Maxime » ?" });
    await expect(restore).toHaveAttribute("data-danger-level", /2|^$/);
    // J12 : le texte dit ce que fait l'app (liens rouverts, rappels et acomptes programmés qui reprennent).
    await expect(restore).toContainText("peuvent de nouveau ouvrir leur lien personnel");
    await expect(restore).toContainText("factures d'acompte programmées partent à leur date");
    await expect(restore.getByRole("button", { name: "Garder annulé" })).toBeVisible();
    await expectNoAxeViolation(page, "dialog[open]");
    await restore.getByRole("button", { name: "Rétablir l'évènement", exact: true }).click();
    await expect(feedback(page)).toContainText("Léa & Maxime");
    await expect(header(page).getByRole("button", { name: "Le contrat est signé…" }).or(header(page).getByRole("button", { name: "Les étapes" }))).toBeVisible();
  });

  test("reporté et archivé : la ligne d'état et sa seule suite (« Fixer la nouvelle date… », « Ouvrir la clôture »)", async ({ page }) => {
    const postponed = await atelier({ state: "postponed" });
    await signIn(page, postponed.email);
    await page.goto(`/events/${postponed.eventId}`);
    const line = header(page).locator(".event-status-line");
    await expect(line).toContainText("Reporté");
    await expect(line).toContainText("Nouvelle date à fixer ; les tâches attendent.");
    await expect(header(page).getByRole("list", { name: "Où en est l'évènement" })).toHaveCount(0);
    await line.getByRole("button", { name: "Fixer la nouvelle date…" }).click();
    const dialog = page.getByRole("dialog", { name: "Fixer la nouvelle date de « Léa & Maxime » ?" });
    await expect(dialog.getByRole("button", { name: "Garder reporté" })).toBeVisible();
    await expectNoAxeViolation(page, "dialog[open]");
    await dialog.getByRole("button", { name: "Garder reporté" }).click();

    const archived = await atelier({ state: "archived" });
    await signIn(page, archived.email);
    await page.goto(`/events/${archived.eventId}`);
    const archivedLine = header(page).locator(".event-status-line");
    await expect(archivedLine).toContainText("Archivé · lecture seule");
    await expect(archivedLine.getByRole("link", { name: "Ouvrir la clôture" })).toBeVisible();
    // Lecture seule : ni type, ni report, ni annulation au menu.
    await menuButton(page).click();
    await expect(menu(page).getByRole("menuitem", { name: /^(Changer le type|Reporter|Annuler)/ })).toHaveCount(0);
    await expectNoAxeViolation(page, "#event-header");
  });
});
