// Lot 71b (HUB-14, PAR-01, UX-02, UX-08 ; spécification du lot 71, § 5.2 ; maquette 06 du lot 68) — la page
// « Reprendre un mariage en cours » et ses portes, à 1 440 et à 375 px (projets « desktop » et
// « mobile-375 »), axe-core sur la page vide, en cours, terminée et sur « Reprendre et importer ». Un
// `test` par critère du paquet, plus l'abus : la reprise d'une autre organisation n'existe pas.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "./axe";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase, createAppConnection } from "@symbola/db/client";
import { imports } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { completeSetup, createTakeover, saveOnboardingStep, settleTakeoverStep } from "../modules/hub/service";
import { createProspect } from "../modules/events/service";
import { enterTakeoverEvent, type TakeoverActor } from "../lib/takeover/flow";
import { feedback, readyOrganization, signIn } from "./helpers";

// Une action serveur suivie d'une redirection : le premier passage compile l'écran en développement.
const expect = baseExpect.configure({ timeout: 20_000 });

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Le budget fictif du tableur de la planner (corpus d'import, données fictives).
const BUDGET_CSV = join(__dirname, "..", "..", "..", "packages", "testing", "import-corpus", "files", "tableur-planner", "budget.csv");

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 640;

// Critère 9 : à 375 px, aucune commande de l'écran sous 44 px (un lien dans une phrase est exclu, comme
// dans `expectTouchTargets`), aucun défilement de côté.
async function expectPhoneRules(page: Page) {
  if (!isPhone(page)) return;
  const small = await page.evaluate(() => {
    const words = (element: Element | null) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
    const inSentence = (link: HTMLElement) => getComputedStyle(link).display === "inline" && words(link.parentElement).length > words(link).length;
    return [...document.querySelectorAll<HTMLElement>("main button, main summary, main a[href]")]
      .filter((element) => !(element.tagName === "A" && inSentence(element)))
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ element, box }) => box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden")
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ element, box }) => `${element.tagName} « ${words(element).slice(0, 40)} » ${Math.round(box.width)}×${Math.round(box.height)}`);
  });
  expect(small).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

// Une agence prête, sa titulaire connectée.
async function setup(page: Page, options: { tools?: string[] } = {}): Promise<TakeoverActor> {
  const email = `planner-71b-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org 71b ${randomUUID()}`);
    if (options.tools) await saveOnboardingStep(db, organization.id, { replacedTools: options.tools });
    const user = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    await signIn(page, email);
    return { organizationId: organization.id, userId: user.id, viewer: { userId: user.id, role: "owner", allPlannersSeeAll: true } };
  } finally {
    await sql.end();
  }
}

const steps = (page: Page) => page.getByRole("list", { name: "Les fichiers à reprendre, dans l'ordre" });
const step = (page: Page, id: string) => page.locator(`#ligne-${id}`);
const primaries = (page: Page) => page.locator("main .button-primary, main .button-link-primary");

test.describe("HUB-14 — La page de reprise et ses portes (lot 71b)", () => {
  // La connexion passe par le lien et le fournisseur d'identité ; chaque parcours ouvre plusieurs écrans.
  test.describe.configure({ timeout: 120_000 });
  test("critère 1 — la page vide : six lignes dans l'ordre, une seule action principale, les lignes 3 à 6 disent pourquoi elles attendent", async ({ page }) => {
    await setup(page);
    await page.goto("/reprise");
    await expect(page.getByRole("heading", { level: 1, name: "Reprendre un mariage en cours" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "fichier sur 6" })).toHaveText("0 fichier sur 6");
    const items = steps(page).getByRole("listitem");
    await expect(items).toHaveCount(6);
    for (const [index, title] of ["Carnet de prestataires", "Le mariage", "Budget", "Prestataires retenus", "Liste « à faire »", "Programme du jour J"].entries()) {
      await expect(items.nth(index).getByRole("heading")).toContainText(title);
    }
    await expect(primaries(page)).toHaveCount(1);
    await expect(primaries(page)).toHaveAccessibleName("Déposer le fichier : Carnet de prestataires");
    for (const id of ["budget", "event_vendors", "tasks", "program"]) {
      await expect(step(page, id)).toContainText("Après le mariage");
      await expect(step(page, id).getByRole("button")).toHaveCount(0);
      await expect(step(page, id).getByRole("link")).toHaveCount(0);
    }
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);
  });

  test("critères 2 et 3 — « Je n'ai pas ce fichier » règle la ligne et se défait ; le mariage saisi est Confirmé, sans tâche, et coche la ligne 2", async ({ page }) => {
    await setup(page);
    await page.goto("/reprise");
    await page.getByRole("button", { name: "Je n'ai pas ce fichier : Carnet de prestataires" }).click();
    await expect(page).toHaveURL(/\/reprise\/[0-9a-f-]{36}$/);
    const takeoverUrl = page.url();
    await expect(step(page, "vendor_book")).toContainText("Pas de fichier");
    await expect(step(page, "vendor_book")).toContainText(/Choisi le \d+/);
    await expect(page.getByRole("status").filter({ hasText: "sur 6" })).toHaveText("1 fichier sur 6");
    await expect(primaries(page)).toHaveAccessibleName("Déposer la fiche : Le mariage");

    // « Déposer un fichier » défait le choix et ouvre l'import du carnet, qui ramène à la page.
    await page.getByRole("button", { name: "Déposer un fichier : Carnet de prestataires" }).click();
    await expect(page).toHaveURL(/\/import\?type=vendors&reprise=/);
    await expect(page.getByRole("link", { name: "‹ Reprendre un mariage en cours" })).toHaveAttribute("href", new URL(takeoverUrl).pathname);
    await page.goto(takeoverUrl);
    await expect(step(page, "vendor_book")).toContainText("À faire");
    await expect(page.getByRole("status").filter({ hasText: "sur 6" })).toHaveText("0 fichier sur 6");

    // « Saisir les noms et la date ».
    await page.getByRole("link", { name: "Saisir les noms et la date : Le mariage" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Le mariage que vous reprenez" })).toBeVisible();
    await page.getByRole("button", { name: "Continuer la reprise" }).click();
    await expect(page.getByText("Donnez un nom à l'évènement", { exact: false }).first()).toBeVisible();
    await page.getByLabel("Nom de l'évènement").fill("Juliette & Romain");
    await page.getByLabel("Date", { exact: true }).fill("2027-03-20");
    await expectPhoneRules(page);
    await page.getByRole("button", { name: "Continuer la reprise" }).click();
    await expect(page).toHaveURL(new RegExp(`${new URL(takeoverUrl).pathname}\\?saisi=1$`));
    await expect(feedback(page)).toContainText("Mariage enregistré : Juliette & Romain");
    await expect(page.getByRole("heading", { level: 1, name: "Reprendre « Juliette & Romain »" })).toBeVisible();
    await expect(page.getByText("Mariage du 20 mars 2027", { exact: false })).toBeVisible();
    await expect(step(page, "event")).toContainText("Signé, en préparation");
    await expect(step(page, "event")).toContainText("Saisi : Juliette & Romain, 20 mars 2027");

    // L'évènement est Confirmé et n'a aucune tâche (aucun modèle appliqué).
    await step(page, "event").getByRole("link", { name: "Ouvrir la fiche : Le mariage" }).click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
    await page.goto(`${page.url()}?onglet=taches`);
    await expect(page.locator(".task-line")).toHaveCount(0);
  });

  test("critères 4 et 5 — un budget qui nomme ses prestataires coche la ligne 4 ; un import laissé en plan se retrouve à sa ligne et en tête de « Reprendre et importer »", async ({ page }) => {
    const actor = await setup(page);
    const { takeoverId } = await enterTakeoverEvent(actor, { takeoverId: null, name: "Juliette & Romain", eventDate: "2027-03-20", clients: [] });
    await settleTakeoverStep(appDatabase(), { organizationId: actor.organizationId, userId: actor.userId, takeoverId, kind: "vendor_book", state: "no_file" });
    await page.goto(`/reprise/${takeoverId}`);
    await page.getByRole("button", { name: "Déposer le fichier : Budget" }).click();
    await expect(page).toHaveURL(new RegExp(`/import\\?type=budget_lines&reprise=${takeoverId}`));
    await expect(page.getByRole("link", { name: "‹ Reprendre « Juliette & Romain »" })).toBeVisible();
    await expect(page.getByText("Les lignes iront dans l'évènement « Juliette & Romain »", { exact: false })).toBeVisible();
    await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles({ name: "budget.csv", mimeType: "text/csv", buffer: readFileSync(BUDGET_CSV) });
    await page.getByRole("button", { name: "Lire le fichier" }).click();
    await expect(page).toHaveURL(/\/import\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: "‹ Reprendre « Juliette & Romain »" })).toBeVisible();

    await page.goto(`/reprise/${takeoverId}`);
    await expect(step(page, "budget")).toContainText("En cours");
    await expect(step(page, "budget")).toContainText("budget.csv");
    await expect(step(page, "budget")).toContainText("Arrêté à «");
    await expect(primaries(page)).toHaveAccessibleName("Continuer : Budget");
    await expect(step(page, "event_vendors")).toContainText("Avec le budget");
    await expect(step(page, "event_vendors")).toContainText("Votre budget nomme 7 prestataires : ils seront retenus avec lui.");
    await expect(page.getByRole("status").filter({ hasText: "sur 6" })).toHaveText("3 fichiers sur 6");
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);

    // En tête de « Reprendre et importer ».
    await page.goto("/import");
    await expect(page.getByRole("heading", { level: 1, name: "Reprendre et importer" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Import en cours" })).toContainText("Import en cours : budget.csv, pour « Juliette & Romain ». Arrêté à «");
    await expect(page.getByRole("link", { name: "Continuer l'import de budget.csv" }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Que voulez-vous importer ?" }).getByRole("link")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Reprendre un mariage en cours" })).toHaveAttribute("href", "/reprise");
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);

    // « Abandonner cet import… » demande confirmation et rend la ligne.
    await page.goto(`/reprise/${takeoverId}`);
    await page.getByRole("button", { name: "Abandonner cet import… : Budget" }).click();
    const dialog = page.getByRole("dialog", { name: "Abandonner l'import « budget.csv » ?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Abandonner l'import" }).click();
    await expect(step(page, "budget")).toContainText("À faire");
    await expect(step(page, "event_vendors")).toContainText("Avec le budget");
  });

  test("critères 6 et 7 — la page terminée compte ce qui reste et mène à « À compléter » ; au deuxième mariage, la ligne 1 est déjà faite", async ({ page }) => {
    const actor = await setup(page);
    // Un carnet déjà repris dans l'agence (journal appliqué).
    await withOrganization(appDatabase(), actor.organizationId, async (tx) => {
      await tx.insert(imports).values({ organizationId: actor.organizationId, createdByUserId: actor.userId, entityType: "vendors", status: "applied", fileName: "prestataires.csv", fileFormat: "csv", fileSizeBytes: 10, headerRowIndex: 0, headers: ["Société"], rowCount: 7, expiresAt: new Date(Date.now() + 86_400_000), appliedAt: new Date(), result: { created: 7, updated: 0, unchanged: 0, rejected: 0 } });
    });
    const { takeoverId } = await enterTakeoverEvent(actor, { takeoverId: null, name: "Léa & Hugo", eventDate: "2027-06-12", clients: [] });
    for (const kind of ["budget", "event_vendors", "tasks", "program"] as const) {
      await settleTakeoverStep(appDatabase(), { organizationId: actor.organizationId, userId: actor.userId, takeoverId, kind, state: "no_file" });
    }
    await page.goto(`/reprise/${takeoverId}`);
    await expect(page.getByRole("status").filter({ hasText: "sur 6" })).toHaveText("6 fichiers sur 6");
    const done = page.getByRole("region", { name: /Reprise terminée/ });
    await expect(done).toContainText("Reprise terminée. Il reste 3 points à compléter à la main.");
    await expect(done).toContainText("les tâches, le lien personnel des mariés et le nombre d'invités");
    await expect(done.getByRole("link", { name: "Ouvrir « À compléter »" })).toHaveAttribute("href", /\/events\/[0-9a-f-]{36}#a-completer$/);
    await expect(page.locator("main")).not.toContainText("à jour");
    await expect(primaries(page)).toHaveCount(1);
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);

    await page.getByRole("link", { name: "Reprendre un autre mariage" }).click();
    await expect(page).toHaveURL(/\/reprise$/);
    await expect(step(page, "vendor_book")).toContainText("7 fiches");
    await expect(step(page, "vendor_book").getByRole("link", { name: "Voir le bilan : Carnet de prestataires" })).toBeVisible();
    await expect(primaries(page)).toHaveAccessibleName("Déposer la fiche : Le mariage");
  });

  test("critère 8 — « Nouvel évènement », la recherche et l'état vide de « Tâches » mènent à la page de reprise", async ({ page }) => {
    const actor = await setup(page);
    await page.goto("/events/new");
    await expect(page.getByRole("link", { name: "Reprendre ses fichiers" })).toHaveAttribute("href", "/reprise");

    const search = await page.request.get(`/recherche/instantanee?q=${encodeURIComponent("Reprendre un mariage")}`);
    const groups = (await search.json()) as { groups: { items: { href: string }[] }[] };
    expect(groups.groups.flatMap((group) => group.items).some((item) => item.href === "/reprise")).toBe(true);

    // Un mariage repris, sans tâches (lot 71f : repéré par son origine, posée par la reprise) :
    // « Reprendre la liste de votre tableur » ouvre sa reprise, ligne 5.
    const { id: eventId } = await createProspect({ organizationId: actor.organizationId, createdByUserId: actor.userId, prospectSourceId: null, clients: [{ firstName: "Hugo", lastName: "Exemple" }], name: "Léa & Hugo", eventDate: "2027-06-12", takeover: true });
    await createTakeover(appDatabase(), { organizationId: actor.organizationId, userId: actor.userId, eventId });
    await page.goto("/taches");
    await expect(page.getByRole("region", { name: "À vérifier : Léa & Hugo" }).getByRole("link", { name: "Reprendre la liste de votre tableur" })).toHaveAttribute("href", `/reprise?evenement=${eventId}&ligne=tasks`);
    await page.getByRole("region", { name: "À vérifier : Léa & Hugo" }).getByRole("link", { name: "Reprendre la liste de votre tableur" }).click();
    await expect(page).toHaveURL(/\/reprise\/[0-9a-f-]{36}#ligne-tasks$/);
    await expect(page.getByRole("heading", { level: 1, name: "Reprendre « Léa & Hugo »" })).toBeVisible();
    await expect(step(page, "event")).toContainText("Signé, en préparation");
    await page.getByRole("button", { name: "Déposer le fichier : Liste « à faire »" }).click();
    await expect(page).toHaveURL(/\/import\?type=tasks&reprise=[0-9a-f-]{36}/);
  });

  test("critères 8 et 9 — la fin de l'assistant de démarrage, après « un tableur » : « Reprendre un mariage en cours » en bouton plein, collé en bas sur téléphone", async ({ page }) => {
    await setup(page, { tools: ["spreadsheet"] });
    await page.goto("/demarrage/pret");
    const card = page.getByRole("region", { name: "Reprendre un mariage en cours" });
    await expect(card).toContainText("Vous suivez aujourd'hui vos mariages dans un tableur (Excel, Google Sheets…).");
    await expect(card).toContainText("Six fichiers au plus");
    // À l'ordinateur, dans la carte ; sur téléphone, dans la barre collée en bas (un seul jeu visible).
    const start = page.getByRole("link", { name: "Reprendre un mariage en cours" });
    const create = page.getByRole("link", { name: "Créer un nouveau mariage" });
    await expect(start).toHaveCount(1);
    await expect(start).toHaveClass(/button-link-primary/);
    await expect(create).not.toHaveClass(/button-link-primary/);
    await expect(start).toHaveAttribute("href", "/reprise");
    if (isPhone(page)) {
      await expect(page.locator(".ready-takeover-bar")).toBeVisible();
      const [first, second] = [await start.boundingBox(), await create.boundingBox()];
      expect(first!.y).toBeLessThan(second!.y);
      // Collés en bas de l'écran, le principal au-dessus.
      expect(second!.y + second!.height).toBeGreaterThan(page.viewportSize()!.height - 48);
      await expectPhoneRules(page);
    }
    await expectNoAxeViolation(page);
    await start.click();
    await expect(page.getByRole("heading", { level: 1, name: "Reprendre un mariage en cours" })).toBeVisible();
  });

  test("I5 — sans tableur ni autre logiciel, créer reste le bouton plein et la reprise une ligne à part", async ({ page }) => {
    await setup(page, { tools: ["paper"] });
    await page.goto("/demarrage/pret");
    await expect(page.getByRole("region", { name: "Reprendre un mariage en cours" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Créer l'évènement" })).toHaveClass(/button-primary/);
    await expect(page.getByRole("link", { name: "Reprendre un mariage en cours" })).toHaveAttribute("href", "/reprise");
  });
});

test.describe("SEC-12, SEC-13 — La reprise d'une autre organisation n'existe pas (lot 71b)", () => {
  test.describe.configure({ timeout: 120_000 });
  test("la page, le formulaire du mariage et l'import d'une reprise de B répondent comme une page inexistante", async ({ page }) => {
    await setup(page);
    const { sql, db } = createAppConnection();
    let foreign: { takeoverId: string; eventId: string };
    try {
      const other = await createOrganization(db, `Autre ${randomUUID()}`);
      await completeSetup(db, other.id);
      const owner = await createUser(db, { organizationId: other.id, email: `b-${randomUUID()}@symbola.test`, role: "owner" });
      foreign = await enterTakeoverEvent({ organizationId: other.id, userId: owner.id, viewer: { userId: owner.id, role: "owner", allPlannersSeeAll: true } }, { takeoverId: null, name: "Mariage de B", eventDate: null, clients: [] });
    } finally {
      await sql.end();
    }
    for (const path of [`/reprise/${foreign.takeoverId}`, `/reprise/${randomUUID()}`, `/reprise/mariage?reprise=${foreign.takeoverId}`, `/reprise?evenement=${foreign.eventId}`, `/import?type=budget_lines&reprise=${foreign.takeoverId}`]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Mariage de B");
    }
  });
});
