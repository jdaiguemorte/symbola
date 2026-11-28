// Lot 72e (EVT-02, EVT-03, EVT-05, UX-01, UX-09, UX-10 ; C-24, C-26, C-28, C-55, P-05, P-08 ; J13, J14 ; page 16
// des maquettes du lot 68) — la suite unique, la Synthèse et « Modifier les informations », à 1 440 px, à
// 911 × 512 (portable à 150 %) et à 375 px, sur un mariage créé et sur un mariage repris, avec axe-core. Les
// cinq formes de la suite (une demande sans devis, un signé sans tâches, un mariage en préparation, un repris,
// le lendemain du jour J) ; une seule action principale dans le premier écran ; les nombres de la suite égaux
// à ceux de l'accueil ; la fenêtre qui s'enregistre d'un coup, garde ses changements et le dit avant de fermer.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser, setUserNames } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { addEventTask, changeEventStatus, createEventLink, createProspect, createProspectSource } from "../modules/events/service";
import { saveOnboardingStep } from "../modules/hub/service";
import { enterTakeoverEvent } from "../lib/takeover/flow";
import { feedback, readyOrganization, signIn } from "./helpers";

test.describe.configure({ timeout: 90_000 });

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

type State = "request" | "signed" | "preparation" | "takeover" | "after";
type Setup = { email: string; eventId: string };

// L'atelier de Camille, planner seule : « Léa & Maxime » dans l'état demandé.
async function atelier(state: State): Promise<Setup> {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier Roussel ${randomUUID().slice(0, 6)}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    const email = `camille-72e-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, role: "owner" });
    await setUserNames(db, owner.id, { firstName: "Camille", lastName: "Roussel" });
    const clients = [
      { firstName: "Léa", lastName: "Martin", email: `lea-${randomUUID()}@symbola.test` },
      { firstName: "Maxime", lastName: "Roux" },
    ];
    if (state === "takeover") {
      const actor = { organizationId, userId: owner.id, viewer: { userId: owner.id, role: "owner" as const, allPlannersSeeAll: true } };
      const { eventId } = await enterTakeoverEvent(actor, { takeoverId: null, name: "", eventDate: parisDay(199), clients });
      return { email, eventId };
    }
    const source = await createProspectSource(organizationId, "Salon du mariage");
    const eventId = (await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients, eventDate: parisDay(state === "after" ? -1 : 199), venueName: "Manoir des Aulnes", venueCity: "Poitiers" })).id;
    if (state === "request") return { email, eventId };
    await changeEventStatus({ organizationId, eventId, changedByUserId: owner.id, toStatus: "confirmed" });
    if (state === "signed") return { email, eventId };
    await addEventTask(organizationId, eventId, { label: "Faire signer le contrat du photographe", dueDate: parisDay(-5), responsible: "planner" });
    await addEventTask(organizationId, eventId, { label: "Confirmer la voiture des mariés", dueDate: parisDay(-4), responsible: "planner" });
    for (let index = 1; index <= 4; index += 1) await addEventTask(organizationId, eventId, { label: `Tâche à venir ${index}`, dueDate: parisDay(index + 2), responsible: "planner" });
    await addEventTask(organizationId, eventId, { label: "Envoyer la feuille de route au traiteur", dueDate: parisDay(60), responsible: "planner" });
    await createEventLink({ organizationId, eventId, createdByUserId: owner.id, audience: "client", locale: "fr", link: { personName: "Léa Martin", email: `lea-lien-${randomUUID()}@symbola.test`, rights: { rubrics: ["tasks", "program"], budgetScope: "all", sharedSlotIds: [] } } });
    return { email, eventId };
  } finally {
    await sql.end();
  }
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;
const panel = (page: Page) => page.locator("#event-tab-panel");
const infoWindow = (page: Page) => page.getByRole("dialog", { name: /informations/ });

// Les boutons pleins visibles dans le premier écran (fond de la couleur primaire), hors barre du haut.
async function primaryActionsInFirstScreen(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const probe = document.createElement("a");
    probe.className = "button-link button-link-primary";
    document.body.append(probe);
    const primary = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const main = document.querySelector("main")!;
    return [...main.querySelectorAll<HTMLElement>("a, button, input[type=submit]")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.top < window.innerHeight && box.bottom > 0 && getComputedStyle(element).backgroundColor === primary && getComputedStyle(element).visibility !== "hidden";
      })
      .map((element) => element.textContent?.trim() ?? "");
  });
}

test.describe("EVT-02 — Une seule suite par mariage (lot 72e, critère 1)", () => {
  test("chaque état montre sa forme de suite, jamais « tout est à jour » quand une étape attend, et une seule action principale", async ({ page }) => {
    test.setTimeout(180_000);
    const setups = { request: await atelier("request"), signed: await atelier("signed"), preparation: await atelier("preparation"), takeover: await atelier("takeover"), after: await atelier("after") };
    const expected: Record<State, RegExp> = {
      request: /Envoyer le devis/,
      signed: /Créer la liste des tâches de Léa & Maxime/,
      preparation: /6 points d'ici 14 jours, dont 2 en retard/,
      takeover: /À compléter après la reprise/,
      after: /Le jour J est passé/,
    };
    for (const state of Object.keys(setups) as State[]) {
      await page.context().clearCookies();
      await signIn(page, setups[state].email);
      await page.goto(`/events/${setups[state].eventId}`);
      await expect(panel(page)).toContainText(expected[state]);
      await expect(panel(page)).not.toContainText("tout est à jour");
      // Plus de bandeau « Prochaine étape », plus de « Les 14 prochains jours » (C-24, E9).
      await expect(panel(page)).not.toContainText("Prochaine étape");
      await expect(panel(page).getByRole("heading", { name: "Les 14 prochains jours" })).toHaveCount(0);
      if (state === "takeover") await expect(panel(page).locator("[data-suite]")).toHaveCount(0);
      else await expect(panel(page).locator("[data-suite]")).toHaveCount(1);
      const primaries = await primaryActionsInFirstScreen(page);
      expect(primaries.length, `${state} : ${primaries.join(", ")}`).toBeLessThanOrEqual(1);
      if (state === "request") {
        expect(primaries).toEqual(["Préparer le devis"]);
        // La demande en une phrase (le lieu et la date de la fiche).
        await expect(panel(page).locator("[data-suite]")).toContainText("Manoir des Aulnes");
      }
      if (state === "after" && !isPhone(page)) expect(primaries).toEqual(["Clôturer l'évènement…"]);
      if (state === "preparation") {
        // En préparation, le bloc n'a que des lignes à action rapide : aucun bouton plein.
        expect(primaries).toEqual([]);
        await expect(panel(page).locator("[data-suite]")).toContainText("3 autres");
      }
    }
  });

  test("« 6 points d'ici 14 jours, dont 2 en retard » sur la fiche égale les lignes de ce mariage sur l'accueil (critère 2)", async ({ page }) => {
    const { email, eventId } = await atelier("preparation");
    await signIn(page, email);
    await page.goto("/");
    const home = page.locator(".today-my-events li", { hasText: "Léa & Maxime" });
    await expect(home).toContainText("6 points, dont 2 en retard");
    await page.goto(`/events/${eventId}`);
    await expect(panel(page).locator(".event-suite-count")).toHaveText("6 points d'ici 14 jours, dont 2 en retard");
    // « Tout afficher » ouvre le reste sur place ; « Replier » le referme.
    await panel(page).getByRole("link", { name: "Tout afficher" }).click();
    await expect(panel(page).locator("[data-suite] .task-line")).toHaveCount(6);
    await panel(page).getByRole("link", { name: "Replier" }).click();
    await expect(panel(page).locator("[data-suite] .task-line")).toHaveCount(3);
  });
});

test.describe("EVT-02, EVT-03 — La Synthèse (lot 72e, critères 3 et 6)", () => {
  test("cinq blocs dans les mots de la planner ; « non renseigné » mène à sa rubrique ; ni « Planner principal : Aucun » ni plage occupée en carte", async ({ page }) => {
    test.setTimeout(90_000);
    const { email, eventId } = await atelier("preparation");
    await signIn(page, email);
    await page.goto(`/events/${eventId}`);
    const headings = await panel(page).locator("h2").allTextContents();
    expect(headings).toEqual(expect.arrayContaining(["Prochaines actions", "Où en est le mariage", "Temps forts", "Informations", "Fil d'activité"]));
    for (const gone of ["Santé de l'évènement", "Fiche d'identité", "Plage occupée", "Équipe", "Les 14 prochains jours"]) expect(headings).not.toContain(gone);
    await expect(panel(page)).not.toContainText("Planner principal : Aucun");
    // Une planner seule n'a pas de ligne « Équipe » ; le type et « Venu par » sont des lignes d'« Informations ».
    const info = panel(page).locator(".overview-info");
    await expect(info.locator('[data-key="team"]')).toHaveCount(0);
    await expect(info.locator('[data-key="source"]')).toContainText("Salon du mariage");
    await expect(page.locator("#progress-title").locator("xpath=..")).toContainText("0 sur 7 · 2 en retard");
    // Une valeur absente dit « non renseigné » et ce qu'il faut faire : la fenêtre, à sa rubrique.
    const style = info.locator('[data-key="style"]');
    await expect(style).toContainText("non renseigné");
    await style.getByRole("link", { name: "Renseigner" }).click();
    await expect(infoWindow(page)).toBeVisible();
    await expect(infoWindow(page).getByRole("button", { name: "Style et notes", exact: true })).toHaveAttribute("aria-current", "step");
    await expectNoAxeViolation(page, ".info-window");
  });

  test("à 1 440 px et à 1 280 × 800, la suite et « Modifier les informations » sont dans le premier écran ; à 911 × 512, la première ligne de la suite", async ({ page }) => {
    test.skip(isPhone(page), "mesures d'ordinateur");
    const { email, eventId } = await atelier("preparation");
    await signIn(page, email);
    for (const [width, height] of [[1440, 900], [1280, 800], [911, 512]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(`/events/${eventId}`);
      const firstLine = panel(page).locator("[data-suite] .task-line").first();
      await expect(firstLine).toBeInViewport();
      if (width >= 1280) {
        await expect(panel(page).getByRole("link", { name: "Modifier les informations" })).toBeInViewport();
        // EVT-02 : trois actions sans défiler.
        await expect(panel(page).locator("[data-suite] .task-line").nth(2)).toBeInViewport();
      }
    }
    await expectNoAxeViolation(page, "#event-tab-panel");
  });
});

test.describe("EVT-03 — « Modifier les informations » (lot 72e, critères 4 et 5)", () => {
  test("toutes les rubriques s'enregistrent d'un coup ; une erreur n'enregistre rien et mène au champ", async ({ page }) => {
    const { email, eventId } = await atelier("request");
    await signIn(page, email);
    await page.goto(`/events/${eventId}`);
    await panel(page).getByRole("link", { name: "Modifier les informations" }).click();
    const window = infoWindow(page);
    await expect(window).toBeVisible();
    // Une demande : la date est un champ.
    await expect(window.getByLabel("Date de l'évènement")).toBeVisible();
    await window.getByLabel("Ville").fill("Niort");
    await window.getByRole("button", { name: "Invités et budget", exact: true }).click();
    await window.getByLabel("Invités prévus").fill("cent vingt");
    await window.getByRole("button", { name: "Style et notes", exact: true }).click();
    await window.getByRole("textbox", { name: "Style", exact: true }).fill("Champêtre, tons sauge et ivoire");
    // « Enregistrer » est toujours visible, quelle que soit la rubrique.
    await expect(window.getByRole("button", { name: "Enregistrer", exact: true })).toBeInViewport();
    await window.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(window.getByRole("alert").first()).toContainText("rien n'est enregistré");
    await expect(window.getByRole("button", { name: "Invités et budget", exact: true })).toHaveAttribute("aria-current", "step");
    await expect(window.getByLabel("Invités prévus")).toBeFocused();
    await expect(window.getByText("Un nombre entier, sans lettres ni espaces.")).toBeVisible();
    await window.getByLabel("Invités prévus").fill("120");
    await expect(window.getByLabel("Invités prévus")).toHaveValue("120");
    await window.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(feedback(page)).toContainText("Les informations de « Léa & Maxime » sont enregistrées.");
    await expect(window).toBeHidden();
    const info = panel(page).locator(".overview-info");
    await expect(info.locator('[data-key="guests"]')).toContainText("120 prévus");
    await expect(info.locator('[data-key="style"]')).toContainText("Champêtre, tons sauge et ivoire");
    await expect(info.locator('[data-key="places"]')).toContainText("Niort");
  });

  test("« Fermer » sans changement ferme ; avec des changements, « Fermer sans enregistrer ? » s'affiche dans la fenêtre", async ({ page }) => {
    const { email, eventId } = await atelier("preparation");
    await signIn(page, email);
    await page.goto(`/events/${eventId}?onglet=apercu&modifier=infos`);
    const window = infoWindow(page);
    await expect(window).toBeVisible();
    const close = async () => {
      if (isPhone(page)) await window.getByRole("button", { name: "Léa & Maxime", exact: true }).click();
      else await window.getByRole("button", { name: "Fermer", exact: true }).click();
    };
    await close();
    await expect(window).toBeHidden();
    await page.goto(`/events/${eventId}?onglet=apercu&modifier=infos&rubrique=style`);
    await window.getByRole("textbox", { name: "Style", exact: true }).fill("Bohème");
    await close();
    await expect(window.getByText("Fermer sans enregistrer ?")).toBeVisible();
    await expect(window.getByRole("alertdialog")).toContainText("Style et notes");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await window.getByRole("button", { name: "Revenir aux informations" }).click();
    await expect(window.getByRole("textbox", { name: "Style", exact: true })).toHaveValue("Bohème");
    await page.keyboard.press("Escape");
    await expect(window.getByText("Fermer sans enregistrer ?")).toBeVisible();
    await window.getByRole("button", { name: "Fermer sans enregistrer" }).click();
    await expect(window).toBeHidden();
    await expect(panel(page).locator('.overview-info [data-key="style"]')).toContainText("non renseigné");
  });

  test("la date d'un mariage signé ne s'y change pas : « Reporter l'évènement… » ouvre le report", async ({ page }) => {
    const { email, eventId } = await atelier("preparation");
    await signIn(page, email);
    await page.goto(`/events/${eventId}?onglet=apercu&modifier=infos`);
    const window = infoWindow(page);
    await expect(window).toBeVisible();
    await expect(window).toContainText("Le contrat est signé : changer la date, c'est reporter le mariage.");
    await expect(window.getByLabel("Date de l'évènement")).toHaveCount(0);
    await window.getByRole("button", { name: "Reporter l'évènement…" }).click();
    await expect(page.getByRole("dialog", { name: /Reporter/ })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("le menu « ⋯ » ouvre aussi la fenêtre ; sur téléphone, une page entière « ← Léa & Maxime »", async ({ page }) => {
    const { email, eventId } = await atelier("preparation");
    await signIn(page, email);
    await page.goto(`/events/${eventId}`);
    await page.locator("#event-header").getByRole("button", { name: "Plus d'actions pour Léa & Maxime" }).click();
    await page.getByRole("menu", { name: "Plus d'actions pour Léa & Maxime" }).getByRole("menuitem", { name: /Modifier les informations/ }).click();
    const window = infoWindow(page);
    await expect(window).toBeVisible();
    if (isPhone(page)) {
      const box = (await window.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(370);
      await expect(window.getByRole("button", { name: "Léa & Maxime", exact: true })).toBeVisible();
      await expect(window.getByRole("button", { name: "Enregistrer", exact: true })).toBeInViewport();
    }
    await expectNoAxeViolation(page, ".info-window");
  });

  test("un mariage repris : la Synthèse et la fenêtre, sans « tout est à jour » ni avis sur zéro tâche", async ({ page }) => {
    const { email, eventId } = await atelier("takeover");
    await signIn(page, email);
    await page.goto(`/events/${eventId}`);
    await expect(panel(page)).toContainText("À compléter après la reprise");
    await expect(page.locator("#progress-title").locator("xpath=..")).toContainText("Pas encore de tâches : pas d'avis");
    await expectNoAxeViolation(page, "#event-tab-panel");
    await panel(page).getByRole("link", { name: "Modifier les informations" }).click();
    await expect(infoWindow(page)).toBeVisible();
    await expectNoAxeViolation(page, ".info-window");
  });

  test("abus : la fenêtre d'un évènement d'une autre organisation répond comme un évènement inexistant", async ({ page }) => {
    const a = await atelier("preparation");
    const b = await atelier("request");
    await signIn(page, b.email);
    const response = await page.goto(`/events/${a.eventId}?onglet=apercu&modifier=infos`);
    expect(response?.status()).toBe(404);
    await expect(infoWindow(page)).toHaveCount(0);
  });
});
