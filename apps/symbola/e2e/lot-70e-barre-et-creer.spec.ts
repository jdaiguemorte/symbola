// Lot 70e (HUB-07, HUB-12, HUB-02, EVT-01, EVT-05, UX-13 ; C-12, C-13, C-03, C-25, C-51, C-82 ; M7, M9, M12,
// M13 ; page 3 des maquettes du lot 68) — la barre du haut fixe, le menu du compte, « + Créer » et ses six
// entrées, « Nouvel évènement » et « Où en est-il ? », la recherche typée (premier temps). En 1 440 px,
// 911 × 512 (la barre et le menu latéral) et 375 px ; axe-core sur les menus et sur la fenêtre.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser, setUserNames } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { addEventTask, addEventVendorSlot, changeEventStatus, createProspect, createProspectSource, listEvents } from "../modules/events/service";
import { saveOnboardingStep, setModuleEnabled } from "../modules/hub/service";
import { feedback, readyOrganization, signIn as signInByLink } from "./helpers";

// `within` : un menu ouvert se contrôle seul ; les petites cibles de la page qu'il recouvre en partie ne
// sont pas les siennes (la page se contrôle menu fermé).
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

// L'atelier de Camille Roussel : Léa et Maxime confirmés (30 tâches, pour que la fiche défile).
async function atelier(options: { without?: "vendors"[] } = {}) {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier Roussel ${randomUUID().slice(0, 6)}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    for (const moduleKey of options.without ?? []) await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey, enabled: false });
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, role: "owner" });
    await setUserNames(db, owner.id, { firstName: "Camille", lastName: "Roussel" });
    const source = await createProspectSource(organizationId, "Salon");
    const lea = (await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], eventDate: parisDay(68) })).id;
    await changeEventStatus({ organizationId, eventId: lea, changedByUserId: owner.id, toStatus: "confirmed" });
    await addEventVendorSlot(organizationId, lea, "Traiteur");
    await addEventTask(organizationId, lea, { label: "Choisir le menu", dueDate: parisDay(6), responsible: "planner" });
    for (let index = 1; index <= 30; index += 1) await addEventTask(organizationId, lea, { label: `Tâche de remplissage ${index}`, dueDate: parisDay(10 + index), responsible: "planner" });
    return { organizationId, email, lea };
  } finally {
    await sql.end();
  }
}

const createButton = (page: Page) => page.getByRole("button", { name: "Créer", exact: true });
const createMenu = (page: Page) => page.getByRole("group", { name: "Que voulez-vous créer ?" });
const accountButton = (page: Page) => page.getByRole("button", { name: /^Camille/ });
const accountMenu = (page: Page) => page.getByRole("group", { name: "Menu du compte" });

test.describe("lot 70e — la barre du haut", () => {
  // Les tailles sont posées dans chaque test : un seul projet les joue.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
  });

  test("critère 1 — la barre reste visible après 1 200 px de défilement ; « + Créer » et la recherche sont à un geste", async ({ page }) => {
    const setup = await atelier();
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInByLink(page, setup.email);
    await page.goto(`/events/${setup.lea}`);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    const bar = page.getByRole("region", { name: /Recherche, création/ });
    await expect(bar).toBeInViewport({ ratio: 1 });
    expect((await bar.boundingBox())!.y).toBe(0);
    await createButton(page).click();
    await expect(createMenu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("combobox", { name: "Rechercher" }).fill("menu");
    await expect(page.getByRole("option").first()).toBeVisible();
  });

  test("critère 2 — à 911 × 512, la barre tient sur une ligne sans rien couper et le menu latéral n'a pas de défilement", async ({ page }) => {
    const setup = await atelier();
    await page.setViewportSize({ width: 911, height: 512 });
    await signInByLink(page, setup.email);
    await page.goto(`/events/${setup.lea}`);
    const measure = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>(".app-topbar")!;
      const side = document.querySelector<HTMLElement>(".app-sidebar")!;
      const children = [...bar.children].map((child) => child.getBoundingClientRect());
      return {
        barHeight: bar.getBoundingClientRect().height,
        barOverflow: bar.scrollWidth - bar.clientWidth,
        heights: children.map((box) => Math.round(box.height)),
        sameRow: new Set(children.map((box) => Math.round(box.top + box.height / 2))).size,
        sideOverflow: side.scrollHeight - side.clientHeight,
      };
    });
    expect(measure.barHeight).toBeLessThanOrEqual(70);
    expect(measure.barOverflow).toBe(0);
    expect(measure.heights.every((height) => height === 44)).toBe(true);
    expect(measure.sameRow).toBe(1);
    expect(measure.sideOverflow).toBe(0);
    // M7 : sous 760 px de barre, le texte d'aide de la recherche devient « Rechercher… ».
    await expect(page.getByRole("combobox", { name: "Rechercher" })).toHaveAttribute("placeholder", "Rechercher…");
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole("combobox", { name: "Rechercher" })).toHaveAttribute("placeholder", /Rechercher un évènement, une tâche, un prestataire/);
  });

  test("critère 3 — le menu du compte : nom, adresse en entier, organisation, « Se déconnecter » en dernier ; Échap et un clic ailleurs ferment", async ({ page }) => {
    const setup = await atelier();
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInByLink(page, setup.email);
    // Le compte a quitté le bas du menu latéral.
    await expect(page.locator(".app-sidebar").getByText(/Connecté comme/)).toHaveCount(0);
    await expect(page.locator(".app-sidebar").getByRole("button", { name: "Se déconnecter" })).toHaveCount(0);
    await accountButton(page).click();
    const menu = accountMenu(page);
    await expect(menu).toBeVisible();
    await expect(menu.getByText("Camille Roussel")).toBeVisible();
    const email = menu.getByText(setup.email);
    await expect(email).toBeVisible();
    expect(await email.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(menu.getByText(/Atelier Roussel .* · titulaire/)).toBeVisible();
    await expect(menu.getByRole("link", { name: /Mon compte/ })).toHaveAttribute("href", "/profil");
    await expect(menu.getByText("Changer d'organisation")).toBeVisible();
    await expectNoAxeViolation(page, ".account-menu");
    // « Se déconnecter » est la dernière ligne, à part.
    const last = await menu.evaluate((element) => element.lastElementChild!.className);
    expect(last).toContain("account-menu-logout");
    const logout = menu.getByRole("button", { name: "Se déconnecter" });
    const lastBox = (await logout.boundingBox())!;
    for (const other of await menu.locator("a, select, button").all()) {
      if ((await other.textContent())?.includes("Se déconnecter")) continue;
      expect((await other.boundingBox())!.y).toBeLessThan(lastBox.y);
    }
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await accountButton(page).click();
    await page.getByRole("heading", { level: 1 }).first().click({ position: { x: 5, y: 5 } });
    await expect(menu).toBeHidden();
  });

  test("« Tous les modules » remplace « Apps » dans le menu latéral", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await expect(page.locator(".app-sidebar").getByRole("link", { name: "Tous les modules", exact: true })).toBeVisible();
    await expect(page.locator(".app-sidebar").getByRole("link", { name: "Apps", exact: true })).toHaveCount(0);
  });
});

test.describe("lot 70e — « + Créer »", () => {
  test("critère 4 — six entrées, le mariage en cours dit depuis une fiche ; Échap et un clic ailleurs ferment", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    // Hors fiche : six entrées, sans mariage nommé.
    await createButton(page).click();
    await expect(createMenu(page).locator("strong")).toHaveText(["Nouvel évènement", "Tâche", "Prestataire", "Contact", "Devis", "Dépense"]);
    await expect(createMenu(page).getByText("Touche N pour ouvrir ce menu")).toBeAttached();
    await page.keyboard.press("Escape");
    await expect(createMenu(page)).toBeHidden();
    // Depuis la fiche : le mariage est dit.
    await page.goto(`/events/${setup.lea}`);
    await createButton(page).click();
    await expect(createMenu(page).locator("strong")).toHaveText(["Nouvel évènement", "Tâche pour Léa & Maxime", "Prestataire", "Contact", "Devis pour Léa & Maxime", "Dépense pour Léa & Maxime"]);
    await expect(createMenu(page).getByText("Une demande, un mariage signé, ou un mariage que vous reprenez")).toBeVisible();
    await expectNoAxeViolation(page, ".quick-create");
    await page.mouse.click(2, 300);
    await expect(createMenu(page)).toBeHidden();
    // La touche N ouvre le menu hors d'un champ.
    await page.keyboard.press("n");
    await expect(createMenu(page)).toBeVisible();
  });

  test("une tâche se crée aussi sans évènement, depuis « + Créer »", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await createButton(page).click();
    await createMenu(page).getByRole("button", { name: /^Tâche/ }).click();
    const dialog = page.getByRole("dialog", { name: "Nouvelle tâche" });
    await expect(dialog.getByLabel("Évènement")).toBeEnabled();
    await dialog.getByLabel("Évènement").selectOption({ label: "Aucun évènement" });
    await dialog.getByLabel("Tâche", { exact: true }).fill("Déclaration de TVA");
    await dialog.getByRole("button", { name: "Ajouter la tâche" }).click();
    await expect(dialog.getByRole("status")).toContainText("Tâche « Déclaration de TVA » ajoutée, hors évènement.");
  });

  test("abus — un module non souscrit n'apparaît pas dans « + Créer » et sa route refuse", async ({ page }) => {
    const setup = await atelier({ without: ["vendors"] });
    await signInByLink(page, setup.email);
    await createButton(page).click();
    await expect(createMenu(page).locator("strong")).toHaveText(["Nouvel évènement", "Tâche", "Contact", "Devis", "Dépense"]);
    await page.goto("/prestataires/nouveau");
    await expect(page.getByText("Le carnet de prestataires n'est pas disponible pour votre organisation.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Enregistrer|Ajouter/ })).toHaveCount(0);
  });

  test("critère 5 — « Nouvel évènement » : une forme, aucune réponse choisie d'avance, le message sous la question, le statut suit la réponse", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await createButton(page).click();
    await createMenu(page).getByRole("link", { name: /^Nouvel évènement/ }).click();
    await expect(page).toHaveURL(/\/events\/new$/);
    await expect(page.getByRole("heading", { level: 1, name: "Nouvel évènement" })).toBeVisible();
    // Deux réponses, aucune cochée.
    const answers = page.getByRole("radio");
    await expect(answers).toHaveCount(2);
    await expect(page.getByRole("radio", { name: /^Une demande en cours/ })).not.toBeChecked();
    await expect(page.getByRole("radio", { name: /^Signé, en préparation/ })).not.toBeChecked();
    await expect(page.getByText("Vous en parlez, rien n'est signé.")).toBeVisible();
    await expect(page.getByText(/Le contrat est signé, même si vous aviez commencé sur papier/)).toBeVisible();
    // Le bouton est actif ; sans réponse, il le dit sous la question.
    const submit = page.getByRole("button", { name: "Créer l'évènement" });
    await expect(submit).toBeEnabled();
    await page.getByLabel(/^Nom de l'évènement/).fill("Inès & Sacha");
    await submit.click();
    await expect(page.getByText("Choisissez où en est cet évènement.")).toBeVisible();
    await expect(page).toHaveURL(/\/events\/new$/);
    await expectNoAxeViolation(page);
    // La reprise est une ligne à part, pas une réponse.
    await expect(page.getByText("Vous le suivez déjà dans un autre logiciel ou un tableur ?")).toBeVisible();
    // Une demande en cours : Option.
    await page.getByRole("radio", { name: /^Une demande en cours/ }).check();
    await submit.click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}/);
    await expect(feedback(page)).toContainText("Évènement créé");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Inès & Sacha");
    await expect(page.getByText("Option", { exact: true }).first()).toBeVisible();
    // Signé, en préparation : Confirmé.
    await page.goto("/events/new");
    await page.getByRole("radio", { name: /^Signé, en préparation/ }).check();
    await page.getByLabel(/^Nom de l'évènement/).fill("Zoé & Hugo");
    await submit.click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Zoé & Hugo");
    await expect(page.getByText("Confirmé", { exact: true }).first()).toBeVisible();
  });

  test("critère 6 — « Reprendre ses fichiers » mène à la page de reprise sans créer d'évènement", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await page.goto("/events/new");
    await page.getByRole("link", { name: "Reprendre ses fichiers" }).click();
    await expect(page).toHaveURL(/\/import/);
    const { sql } = createAppConnection();
    try {
      expect((await listEvents({ organizationId: setup.organizationId })).length).toBe(1);
    } finally {
      await sql.end();
    }
  });
});

test.describe("lot 70e — la recherche typée", () => {
  test("critère 7 — groupes comptés, premier résultat surligné, Entrée l'ouvre, « tous les résultats pour … » en bas ; limités à l'organisation", async ({ page }) => {
    const setup = await atelier();
    // Une autre organisation : ses évènements ne sont jamais trouvés.
    const { sql, db } = createAppConnection();
    try {
      const other = await readyOrganization(db, `Autre ${randomUUID().slice(0, 6)}`);
      const owner = await createUser(db, { organizationId: other.id, email: `autre-${randomUUID()}@symbola.test`, role: "owner" });
      const source = await createProspectSource(other.id, "Salon");
      await createProspect({ organizationId: other.id, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Zélie" }] });
    } finally {
      await sql.end();
    }
    await signInByLink(page, setup.email);
    const box = page.getByRole("combobox", { name: "Rechercher" });
    // Un nom de client : un groupe « Évènements · 1 », le premier résultat surligné.
    await box.fill("Léa");
    const options = page.getByRole("option");
    await expect(options.first()).toContainText("Léa & Maxime");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Évènements · 1")).toBeVisible();
    await expect(options.first()).toContainText("dans 68 jours");
    await expect(options.last()).toContainText("Tous les résultats pour « Léa »");
    await expect(page.getByText("Entrée ouvre le résultat surligné")).toBeVisible();
    await expectNoAxeViolation(page, ".search-box");
    await box.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/events/${setup.lea}$`));
    // Une tâche : son groupe passe en premier, compté ; elle dit son mariage et son échéance.
    await box.fill("menu");
    await expect(page.getByText("Tâches · 1")).toBeVisible();
    await expect(options.first()).toContainText("Choisir le menu");
    await expect(options.first()).toContainText("Léa & Maxime · Échéance dans 6 jours");
    // Aucun résultat d'une autre organisation.
    await box.fill("Zélie");
    await expect(page.getByText(/Aucun résultat pour « Zélie »/)).toBeVisible();
    // Les actions passent après les résultats, et seulement si elles répondent au texte.
    await box.fill("tâche");
    const groups = page.locator(".search-box-group");
    await expect(groups.first()).toContainText("Tâches");
    await box.fill("corbeille");
    await expect(options.first()).toContainText("Ouvrir la corbeille");
    // Résultats en moins de 500 ms (HUB-12).
    const elapsed = await page.evaluate(async () => {
      const start = performance.now();
      await fetch("/recherche/instantanee?q=L%C3%A9a");
      return performance.now() - start;
    });
    expect(elapsed).toBeLessThan(500);
  });
});

test.describe("lot 70e — téléphone", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-375");
  });

  test("375 px — la barre, « + Créer » et le menu du compte tiennent dans l'écran, sans défilement de côté", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await page.goto(`/events/${setup.lea}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await createButton(page).click();
    const menu = createMenu(page);
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    await expectNoAxeViolation(page, ".quick-create");
    await page.keyboard.press("Escape");
    await accountButton(page).click();
    const account = (await accountMenu(page).boundingBox())!;
    expect(account.x).toBeGreaterThanOrEqual(0);
    expect(account.x + account.width).toBeLessThanOrEqual(375);
    await expectNoAxeViolation(page, ".account-menu");
  });
});

// WCAG 2.4.11 (focus non masqué) : la barre fixe ne doit pas cacher ce que le clavier atteint. C'est la
// contrepartie de `e2e/axe.ts`, qui remonte en haut de page avant d'analyser (une cible que le parcours vient
// de faire défiler sous la barre était signalée « partiellement masquée » à tort) : ici, on vérifie
// directement ce que la barre peut casser.
test.describe("lot 70e — la barre fixe ne masque pas le focus", () => {
  async function tabAndMeasure(page: Page, stops: number) {
    let scrolled = 0;
    const hidden: string[] = [];
    for (let stop = 0; stop < stops; stop += 1) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const bar = document.querySelector<HTMLElement>(".app-topbar")!;
        const active = document.activeElement as HTMLElement | null;
        if (!active || active === document.body || bar.contains(active)) return null;
        const barBox = bar.getBoundingClientRect();
        const box = active.getBoundingClientRect();
        // Seul un élément visible dans la fenêtre compte (un lien d'évitement caché hors écran n'en est pas un).
        if (box.width === 0 || box.height === 0 || box.bottom <= 0 || box.top >= window.innerHeight) return null;
        // Recouvrement dans les deux sens : le menu latéral, à gauche de la barre, ne la croise pas.
        const overlaps = box.top < barBox.bottom - 1 && box.bottom > barBox.top + 1 && barBox.bottom > 0 && box.left < barBox.right - 1 && box.right > barBox.left + 1;
        return { scrollY: window.scrollY, overlaps, label: (active.getAttribute("aria-label") ?? active.textContent ?? active.tagName).trim().slice(0, 50), barBottom: barBox.bottom, top: box.top };
      });
      if (!state) continue;
      scrolled = Math.max(scrolled, state.scrollY);
      if (state.overlaps) hidden.push(`${state.label} (haut ${Math.round(state.top)} px sous une barre qui finit à ${Math.round(state.barBottom)} px)`);
    }
    return { scrolled, hidden };
  }

  for (const screen of ["fiche", "taches"] as const) {
    test(`${screen} — un élément atteint au clavier (Tab) plus bas dans la page n'est pas caché sous la barre`, async ({ page }) => {
      test.setTimeout(120_000);
      const setup = await atelier();
      await signInByLink(page, setup.email);
      await page.goto(screen === "fiche" ? `/events/${setup.lea}` : "/taches");
      await page.waitForLoadState("networkidle");
      const { scrolled, hidden } = await tabAndMeasure(page, 70);
      // Le parcours a bien fait défiler la page : sans cela, il ne prouverait rien.
      expect(scrolled).toBeGreaterThan(300);
      expect(hidden).toEqual([]);
    });
  }

  test("une ancre plus bas dans la page, comme le lien d'évitement « contenu », amène son contenu sous la barre, pas dessous", async ({ page }) => {
    const setup = await atelier();
    await signInByLink(page, setup.email);
    await page.goto(`/events/${setup.lea}`);
    await page.waitForLoadState("networkidle");
    // Une cible profonde : le 20e lien de la page reçoit une ancre, puis on y va comme par un lien interne.
    await page.evaluate(() => {
      const links = [...document.querySelectorAll<HTMLElement>("main a, main button")].filter((element) => element.getBoundingClientRect().height > 0);
      links[Math.min(20, links.length - 1)]!.id = "ancre-profonde";
      window.location.hash = "ancre-profonde";
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const measure = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>(".app-topbar")!.getBoundingClientRect();
      const target = document.getElementById("ancre-profonde")!.getBoundingClientRect();
      return { sticky: getComputedStyle(document.querySelector(".app-topbar")!).position === "sticky", below: target.top - bar.bottom };
    });
    // Sur ordinateur (barre fixe) la cible arrive sous la barre ; sur téléphone la barre défile avec la page.
    if (measure.sticky) expect(measure.below).toBeGreaterThanOrEqual(-1);
    // Le lien d'évitement mène au contenu principal, sous la barre : page défilée, on l'active au clavier.
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.locator(".skip-link").focus();
    await page.keyboard.press("Enter");
    const skip = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>(".app-topbar")!.getBoundingClientRect();
      const target = document.getElementById("contenu")!.getBoundingClientRect();
      return { sticky: getComputedStyle(document.querySelector(".app-topbar")!).position === "sticky", below: target.top - bar.bottom };
    });
    if (skip.sticky) expect(skip.below).toBeGreaterThanOrEqual(-1);
  });
});
