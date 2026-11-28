// Lot 74f (HUB-11, HUB-12, UX-10 ; spécification du lot 74, § 6.6 ; maquettes 27 et 28 ; C-07, C-10, D6) — le
// centre d'aide en deux écrans, la recherche par phrase avec une meilleure réponse, les sujets, les deux
// parcours de tutoriels et « Pour bien démarrer » fondu dans le parcours. Ordinateur et 375 px, clavier,
// axe-core ; abus : un module non souscrit n'apparaît ni dans les réponses ni par son adresse, une recherche
// ne lit rien d'une autre organisation, le parcours choisi par l'une n'est pas celui de l'autre.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { createProspect } from "../modules/events/service";
import { answerOngoingEvents, setModuleEnabled, type ModuleKey } from "../modules/hub/service";
import { readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

type Space = { organizationId: string; userId: string; email: string };

async function space(options: { ongoing?: "yes" | "no"; role?: "owner" | "member"; without?: ModuleKey[] } = {}): Promise<Space> {
  const email = `aide-74f-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    if (options.ongoing) await answerOngoingEvents(db, organization.id, options.ongoing);
    for (const moduleKey of options.without ?? []) await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId: organization.id, moduleKey, enabled: false });
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-aide-74f", role: options.role ?? "owner" });
    return { organizationId: organization.id, userId: user.id, email };
  } finally {
    await sql.end();
  }
}

const answers = (page: Page) => page.locator(".help-answers");

test.describe("HUB-12, UX-10 — Le centre d'aide et sa recherche (lot 74f, maquette 27)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("critères 1 et 2 — la page tient en deux écrans ; une phrase rend sa meilleure réponse, au clavier", async ({ page }) => {
    const owner = await space();
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, owner.email);
    await page.goto("/aide");
    await expect(page.getByRole("heading", { level: 1, name: "Aide" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pour bien démarrer" })).toContainText("Votre parcours : je pars de zéro · 0 étape faite sur 4");
    await expect(page.getByRole("region", { name: "Pour découvrir" })).toContainText("Les tutoriels");
    await expect(page.getByRole("region", { name: "Par sujet" }).getByRole("link", { name: /Reprise et import \d+ articles/ })).toBeVisible();
    // Deux hauteurs d'écran au plus ; aucun libellé coupé ; « Chercher » est le seul bouton plein.
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(2 * 900);
    expect(await page.locator(".help-row-title, .help-row .meta").evaluateAll((nodes) => nodes.filter((node) => node.scrollWidth > node.clientWidth + 1).length)).toBe(0);
    await expect(page.locator("main .button-primary, main .button-link-primary")).toHaveText(["Chercher"]);
    await expectNoAxeViolation(page);

    // Au clavier : le champ, la phrase, Entrée.
    const field = page.getByLabel("Votre question");
    await field.focus();
    await page.keyboard.type("importer mes contacts");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/aide\?q=importer\+mes\+contacts$|\/aide\?q=importer%20mes%20contacts$/);
    await expect(answers(page).getByRole("status")).toContainText("à « importer mes contacts »");
    await expect(answers(page).getByRole("status")).toContainText("compris : importer · contacts");
    const best = page.getByRole("article", { name: "Reprendre et importer" });
    await expect(best).toContainText("La meilleure réponse · Reprise et import");
    await expect(best.getByRole("listitem")).toHaveCount(4);
    await expect(best.getByRole("link", { name: "Ouvrir l'écran" })).toHaveAttribute("href", "/import");
    await expect(best.getByRole("link", { name: "Lire l'article en entier" })).toHaveAttribute("href", "/aide/ecrans/importFile");
    expect(await page.locator(".help-others .help-row").count()).toBeLessThanOrEqual(4);
    await expectNoAxeViolation(page);

    // « Effacer la recherche » vide le champ : un nouveau mot remplace l'ancien (PC-08).
    await page.getByRole("button", { name: "Effacer la recherche" }).click();
    await expect(field).toHaveValue("");
    await expect(field).toBeFocused();
    await page.keyboard.type("import");
    await page.keyboard.press("Enter");
    // La même réponse que la phrase d'avant : attendre la nouvelle page avant d'écrire à nouveau.
    await expect(page).toHaveURL(/\/aide\?q=import$/);
    await expect(page.getByRole("article").getByRole("heading", { level: 2 })).toHaveText("Reprendre et importer");

    // La recherche part aussi à la frappe, après trois lettres.
    await field.fill("modèle de contrat");
    await expect(page.getByRole("article").getByRole("heading", { level: 2 })).toHaveText("Modèles de contrat");

    // Aucune réponse : la phrase le dit avec les mots cherchés, puis les sujets ; jamais une page vide.
    await field.fill("parrainer une consœur");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Aucun article ne répond à « parrainer une consœur »" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Par sujet" })).toBeVisible();
    await expectNoAxeViolation(page);
  });

  test("à 375 px : la recherche, la meilleure réponse et les sujets, sans débordement ; raccourcis masqués", async ({ page }) => {
    const owner = await space();
    await page.setViewportSize({ width: 375, height: 812 });
    await signIn(page, owner.email);
    await page.goto("/aide");
    await expect(page.locator(".help-shortcuts")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await expectNoAxeViolation(page);
    await page.goto(`/aide?q=${encodeURIComponent("reprendre mon tableau excel")}`);
    await expect(page.getByRole("article").getByRole("heading", { level: 2 })).toHaveText("Reprendre et importer");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await expectNoAxeViolation(page);
  });

  test("la recherche du haut répond par le même moteur, dans son groupe « Aide »", async ({ page }) => {
    const owner = await space();
    await signIn(page, owner.email);
    const response = await page.request.get(`/recherche?q=${encodeURIComponent("importer mes contacts")}`);
    expect(response.ok()).toBe(true);
    await page.goto(`/recherche?q=${encodeURIComponent("importer mes contacts")}`);
    await expect(page.getByRole("link", { name: /Reprendre et importer/ }).first()).toHaveAttribute("href", "/aide/ecrans/importFile");
  });
});

test.describe("ARC-06, SEC-13 — Rien d'un module non souscrit, rien d'une autre organisation (lot 74f)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("un article d'un module non souscrit n'est rendu ni par la recherche, ni par son sujet, ni par son adresse", async ({ page }) => {
    const owner = await space({ without: ["appointments", "guests"] });
    await signIn(page, owner.email);
    await page.goto(`/aide?q=${encodeURIComponent("mes disponibilités pour les rendez-vous")}`);
    await expect(answers(page)).not.toContainText("Mes disponibilités");
    await page.goto(`/aide?q=${encodeURIComponent("plan de table des invités")}`);
    await expect(page.getByRole("article", { name: "Plan de table" })).toHaveCount(0);
    expect((await page.goto("/aide/sujets/appointments"))?.status()).toBe(404);
    expect((await page.goto("/aide/ecrans/appointmentAvailability"))?.status()).toBe(404);
    expect((await page.goto("/aide/ecrans/seatingPlan"))?.status()).toBe(404);
    expect((await page.goto("/aide/sujets/inconnu"))?.status()).toBe(404);
  });

  test("une recherche ne lit que l'aide : le nom d'un mariage d'une autre organisation n'y répond pas", async ({ page }) => {
    const other = await space();
    const { sql } = createAppConnection();
    try {
      await createProspect({ organizationId: other.organizationId, createdByUserId: other.userId, clients: [{ firstName: "Zéphirine", lastName: "Quillard" }], prospectSourceId: null, eventDate: "2027-06-12" });
    } finally {
      await sql.end();
    }
    const owner = await space();
    await signIn(page, owner.email);
    await page.goto(`/aide?q=${encodeURIComponent("Zéphirine Quillard")}`);
    await expect(page.getByRole("heading", { name: "Aucun article ne répond à « Zéphirine Quillard »" })).toBeVisible();
  });
});

test.describe("HUB-11 — Deux parcours, une seule liste (lot 74f, maquette 28 ; D6, C-10)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("critère 3 — le parcours suit la réponse de l'assistant ; « Changer de parcours » le change et le garde, pour la personne seule", async ({ page, browser }) => {
    const owner = await space({ ongoing: "yes" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, owner.email);
    await page.goto("/tutoriels");
    await expect(page.getByRole("heading", { level: 2, name: "Votre parcours : je reprends mes mariages en cours" })).toBeVisible();
    await expect(page.getByText("Choisi d'après votre réponse au démarrage")).toBeVisible();
    const stages = page.locator(".tutorials-stages > li h3");
    await expect(stages).toHaveText([/Reprendre un mariage en cours/, /Compléter un mariage repris/, /Vos prestataires/, /Le rétroplanning et le programme/, /Devis et factures/]);
    await expect(page.locator(".tutorials-stages > li").first()).toContainText("Ensuite");
    await expect(page.getByRole("link", { name: "Compléter un mariage repris" })).toHaveAttribute("href", "/aide/tutoriels/complete-takeover");
    await expectNoAxeViolation(page);

    await page.getByRole("button", { name: "Changer de parcours" }).click();
    const dialog = page.getByRole("dialog", { name: "Votre parcours" });
    await expect(dialog.getByRole("radio", { name: /Je reprends mes mariages en cours/ })).toBeChecked();
    await expectNoAxeViolation(page);
    await dialog.getByRole("radio", { name: /Je pars de zéro/ }).check();
    await dialog.getByRole("button", { name: "Valider" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Votre parcours : je pars de zéro" })).toBeVisible();
    await expect(page.getByText("Choisi par vous")).toBeVisible();
    await page.reload();
    await expect(stages).toHaveText([/Créer votre premier mariage/, /Son rétroplanning/, /Ses prestataires/, /Devis et factures/]);
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Pour bien démarrer" })).toContainText("Créer votre premier mariage");

    // Une collègue de la même organisation garde le parcours de la réponse.
    const colleague = `aide-74f-collegue-${randomUUID()}@symbola.test`;
    const { sql, db } = createAppConnection();
    try {
      await createUser(db, { organizationId: owner.organizationId, email: colleague, password: "mot-de-passe-aide-74f", role: "member" });
    } finally {
      await sql.end();
    }
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signIn(otherPage, colleague);
    await otherPage.goto("/tutoriels");
    await expect(otherPage.getByRole("heading", { level: 2, name: "Votre parcours : je reprends mes mariages en cours" })).toBeVisible();
    await other.close();
  });

  test("critère 4 — une étape se coche par le geste fait dans l'espace ; la même liste sur l'accueil, dans « Aide » et dans « Tutoriels »", async ({ page }) => {
    const owner = await space({ ongoing: "no" });
    await signIn(page, owner.email);
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Pour bien démarrer" })).toContainText("0 étape faite sur 4");
    const { sql } = createAppConnection();
    try {
      await createProspect({ organizationId: owner.organizationId, createdByUserId: owner.userId, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], prospectSourceId: null, eventDate: "2027-06-12" });
    } finally {
      await sql.end();
    }
    await page.reload();
    const line = page.getByRole("region", { name: "Pour bien démarrer" });
    await expect(line).toContainText("1 étape faite sur 4");
    await expect(line).toContainText("Ensuite : Son rétroplanning, 6 minutes");
    await expect(line.getByRole("link", { name: "Continuer" })).toHaveAttribute("href", "/aide/tutoriels/retroplanning-template");
    await page.goto("/aide");
    await expect(page.getByRole("region", { name: "Pour bien démarrer" })).toContainText("1 étape faite sur 4");
    await expect(page.getByRole("region", { name: "Pour bien démarrer" })).toContainText("Étape 2 : Son rétroplanning");
    await page.goto("/tutoriels");
    await expect(page.locator(".tutorials-stages > li").first()).toContainText("Fait");
    await expect(page.locator(".tutorials-stages > li").nth(1)).toContainText("Ensuite");
  });

  test("critère 5 — aucune pastille sur « Tutoriels » ; « Tutoriels » s'ouvre depuis « Aide » ; à 375 px, le parcours se lit et se change", async ({ page }) => {
    const owner = await space({ ongoing: "yes" });
    await signIn(page, owner.email);
    await page.goto("/");
    await expect(page.getByRole("navigation").getByRole("link", { name: /Tutoriels/ })).toHaveCount(0);
    await expect(page.getByText(/\b\d+\/1[12]\b/)).toHaveCount(0);
    await page.goto("/aide");
    await page.getByRole("region", { name: "Pour découvrir" }).getByRole("link", { name: /Les tutoriels/ }).click();
    await expect(page).toHaveURL(/\/tutoriels$/);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await expectNoAxeViolation(page);
    await page.getByRole("button", { name: "Changer de parcours" }).click();
    await expect(page.getByRole("dialog", { name: "Votre parcours" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Votre parcours" })).toHaveCount(0);
  });
});
