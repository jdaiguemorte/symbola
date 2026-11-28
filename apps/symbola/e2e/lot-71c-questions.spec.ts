// Lot 71c (HUB-14, BUD-01, EVT-01, EVT-05, CHR-01, CHR-02, UX-10 ; spécification du lot 71, § 5.3 ;
// maquette 07 du lot 68) — l'étape « Questions » de l'assistant d'import, à 1 440 et à 375 px (projets
// « desktop » et « mobile-375 »), axe-core sur chaque question, sur les fichiers fictifs du tableur de
// la planner. Un `test` par parcours ; l'abus « un mariage d'une autre organisation » est tenu par
// `lib/import/questions-71c.integration.test.ts`.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "./axe";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { defaultVendorSlots, events as eventsTable } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createProspect, createProspectSource } from "../modules/events/service";
import { enterTakeoverEvent, type TakeoverActor } from "../lib/takeover/flow";
import { feedback, readyOrganization, signIn } from "./helpers";

// Une action serveur suivie d'une redirection : le premier passage compile l'écran en développement.
const expect = baseExpect.configure({ timeout: 20_000 });

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

const CORPUS = join(__dirname, "..", "..", "..", "packages", "testing", "import-corpus", "files");
const BUDGET_CSV = join(CORPUS, "tableur-planner", "budget.csv");
const SHEET_PDF = join(CORPUS, "logiciel-tiers", "fiche-evenement-complete.pdf");

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 640;

// À 375 px : aucune commande sous 44 px (hors lien dans une phrase), aucun défilement de côté.
async function expectPhoneRules(page: Page) {
  if (!isPhone(page)) return;
  const small = await page.evaluate(() => {
    const words = (element: Element | null) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
    const inSentence = (link: HTMLElement) => getComputedStyle(link).display === "inline" && words(link.parentElement).length > words(link).length;
    return [...document.querySelectorAll<HTMLElement>("main button, main summary, main a[href], main label:has(> input[type=radio]), main label:has(> input[type=checkbox])")]
      .filter((element) => !(element.tagName === "A" && inSentence(element)))
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ element, box }) => box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden")
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ element, box }) => `${element.tagName} « ${words(element).slice(0, 40)} » ${Math.round(box.width)}×${Math.round(box.height)}`);
  });
  expect(small).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  // La barre d'action de l'étape n'est recouverte par rien, la barre du bas du téléphone comprise.
  const covered = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".action-bar button, .action-bar a")].filter((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return !(hit && element.contains(hit));
    }).length,
  );
  expect(covered).toBe(0);
}

// Une agence prête, sans postes de départ (les doublons des postes sont le paquet 71d), sa titulaire
// connectée.
async function setup(page: Page): Promise<TakeoverActor> {
  const email = `planner-71c-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org 71c ${randomUUID()}`);
    await withOrganization(db, organization.id, (tx) => tx.delete(defaultVendorSlots));
    const user = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    await signIn(page, email);
    return { organizationId: organization.id, userId: user.id, viewer: { userId: user.id, role: "owner", allPlannersSeeAll: true } };
  } finally {
    await sql.end();
  }
}

const actions = (page: Page) => page.getByRole("group", { name: "Actions de l'étape" });

// Le fichier lu, et l'étape « Colonnes » passée si elle s'affiche (rien à y choisir pour ces fichiers).
async function dropFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.getByLabel(/^Fichier/).first().setInputFiles(file);
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  await expect(page).toHaveURL(/\/import\/[0-9a-f-]{36}\/(colonnes|questions)$/, { timeout: 30_000 });
  if (page.url().endsWith("/colonnes")) {
    // « Détail » est proposé sous le seuil de confiance : la planner le confirme.
    const detail = page.getByLabel("Champ pour la colonne « Détail »");
    if ((await detail.count()) > 0) await detail.selectOption({ label: "Libellé de la ligne" });
    await actions(page).getByRole("button", { name: "Continuer" }).click();
  }
  await expect(page).toHaveURL(/\/questions$/, { timeout: 30_000 });
}

function isoDay(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}
const frDay = (iso: string) => iso.split("-").reverse().join("/");

test.describe("HUB-14 — L'assistant qui demande (lot 71c)", () => {
  test.describe.configure({ timeout: 150_000 });

  test("critères 1, 3 et 4 — un budget sans mariage, déposé dans « Reprendre et importer » : la question vient en premier, rien n'est coché, chaque réponse dit son résultat, et le mariage est créé à l'écriture", async ({ page }) => {
    const actor = await setup(page);
    const source = await createProspectSource(actor.organizationId, "Salon");
    await createProspect({ organizationId: actor.organizationId, createdByUserId: actor.userId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Exemple" }], eventDate: "2030-01-30" });

    await page.goto("/import?type=budget_lines#import-form");
    await dropFile(page, { name: "budget.csv", mimeType: "text/csv", buffer: readFileSync(BUDGET_CSV) });
    await expect(page.getByRole("navigation", { name: "Étapes de l'import" }).getByRole("listitem").filter({ hasText: "Questions" })).toHaveAttribute("aria-current", "step");
    const target = page.getByRole("group", { name: "Pour quel mariage est ce budget ?" });
    await expect(target).toContainText("les 14 lignes iront toutes dans celui que vous choisissez");
    await expect(target.getByRole("radio", { name: /Léa/ })).toBeVisible();
    // R5 : aucune réponse cochée d'avance.
    await expect(page.locator("main input[type=radio]:checked")).toHaveCount(0);
    const deposits = page.getByRole("group", { name: "Les montants de « Acompte versé » ont-ils été payés ?" });
    await expect(deposits.getByRole("radio", { name: /Oui, payés aux dates du fichier/ })).toHaveAccessibleName(/Réglé 8\s727,00\s€ · reste à payer 18\s775,00\s€ · aucune échéance en retard/);
    await expect(deposits.getByRole("radio", { name: /Non, ils restent à payer/ })).toHaveAccessibleName(/Réglé 0,00\s€ · reste à payer 27\s502,00\s€ · 6 échéances en retard/);
    await expect(page.getByRole("complementary", { name: "Ce que Symbola a compris" })).toContainText("Non renseigné (8 lignes), pas 0 €");
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);

    // « Continuer » sans réponse : ce qui manque, sous chaque question.
    await actions(page).getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("Erreur : 3 réponses à donner avant de continuer.")).toBeVisible();
    await expect(target).toContainText("Choisissez le mariage de ce budget.");
    await expect(deposits).toContainText("Choisissez si ces acomptes ont été payés.");
    await expect(page).toHaveURL(/\/questions$/);
    await expectNoAxeViolation(page);

    await target.getByRole("radio", { name: /Un mariage qui n'est pas encore dans Symbola/ }).check();
    await page.getByLabel("Nom de l'évènement").fill("Clara & Yanis");
    await page.getByLabel("Date", { exact: true }).fill("2031-06-05");
    // « Certains seulement » : cinq acomptes sur six, le total suit.
    await deposits.getByRole("radio", { name: /Certains seulement/ }).check();
    const paidRows = page.getByRole("group", { name: "Quels acomptes sont payés ?" }).getByRole("checkbox");
    await expect(paidRows).toHaveCount(6);
    for (let index = 0; index < 5; index += 1) await paidRows.nth(index).check();
    await expect(page.getByRole("status").filter({ hasText: "payés sur 6" })).toContainText("5 payés sur 6");
    await page.getByRole("group", { name: "Leurs contrats sont-ils signés ?" }).getByRole("radio", { name: /Tous/ }).check();
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);
    await actions(page).getByRole("button", { name: "Continuer" }).click();

    await expect(page).toHaveURL(/\/confirmation$/, { timeout: 30_000 });
    // Aucune ligne rejetée faute de mariage.
    // Lot 71d : « Vérifier : ce qui va être écrit » dit ce qui ne sera pas repris.
    await expect(page.getByText("Non repris : rien.")).toBeVisible();
    await page.getByRole("button", { name: "Importer 14 lignes de budget" }).click();
    // Le mariage est créé avec sa reprise : la confirmation ramène à sa page, le budget fait.
    await expect(page).toHaveURL(/\/reprise\/[0-9a-f-]{36}\?importe=/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Reprendre « Clara & Yanis »" })).toBeVisible();
    await expect(page.locator("#ligne-budget")).toContainText("budget.csv");

    const { sql, db } = createAppConnection();
    try {
      const created = await withOrganization(db, actor.organizationId, (tx) => tx.select({ id: eventsTable.id, origin: eventsTable.origin }).from(eventsTable));
      expect(created.filter((event) => event.origin === "takeover")).toHaveLength(1);
    } finally {
      await sql.end();
    }
  });

  test("critères 2 et 7 — une liste « à faire » depuis la page de reprise : le mariage est écrit en tête, « Quoi » et « Pour quand » reconnus, les deux échéances passées demandées", async ({ page }) => {
    const actor = await setup(page);
    const { takeoverId } = await enterTakeoverEvent(actor, { takeoverId: null, name: "Juliette & Romain", eventDate: "2031-03-20", clients: [] });
    const rows = [
      ["x", "Signer le contrat du domaine", frDay(isoDay(-60)), "moi"],
      ["", "Trouver un vidéaste", frDay(isoDay(-5)), "moi"],
      ["", "Relancer les trois devis de navette", frDay(isoDay(-2)), "moi"],
      ["", "Envoyer la liste des morceaux au DJ", frDay(isoDay(5)), "mariés"],
    ];
    const csv = ["Fait ?;Quoi;Pour quand;Qui", ...rows.map((row) => row.join(";"))].join("\n") + "\n";

    await page.goto(`/import?type=tasks&reprise=${takeoverId}#import-form`);
    await dropFile(page, { name: "a-faire.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf-8") });
    await expect(page.getByText(/Pour « Juliette & Romain », .* : choisi depuis la page de reprise\./)).toBeVisible();
    await expect(page.getByRole("group", { name: /Pour quel mariage/ })).toHaveCount(0);
    const pastDue = page.getByRole("group", { name: "2 tâches non faites ont une échéance déjà passée" });
    await expect(pastDue).toContainText("« Trouver un vidéaste »");
    await expect(pastDue.getByRole("radio", { name: /Les garder à leur date/ })).toHaveAccessibleName(/2 tâches en retard, comme dans votre tableur/);
    await expect(pastDue.getByRole("radio", { name: /Elles sont faites/ })).toHaveAccessibleName(/3 tâches faites au lieu de 1/);
    const understood = page.getByRole("complementary", { name: "Ce que Symbola a compris" });
    await expect(understood).toContainText("Faite (1) · date de fin non renseignée");
    await expect(understood).toContainText("Qui : « moi »");
    await expect(understood).toContainText("Aucun modèle n'est ajouté ; aucune relance n'est créée.");
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);

    // « Leur donner une nouvelle date » sans date : l'erreur sous la question.
    await pastDue.getByRole("radio", { name: /Leur donner une nouvelle date/ }).check();
    await actions(page).getByRole("button", { name: "Continuer" }).click();
    await expect(pastDue).toContainText("Choisissez la nouvelle échéance.");
    await expectNoAxeViolation(page);
    await page.getByLabel("Nouvelle échéance").fill(isoDay(10));
    await actions(page).getByRole("button", { name: "Continuer" }).click();
    await expect(page).toHaveURL(/\/confirmation$/, { timeout: 30_000 });
    await page.getByRole("button", { name: "Importer 4 tâches" }).click();
    await expect(page).toHaveURL(new RegExp(`/reprise/${takeoverId}\\?importe=`), { timeout: 30_000 });
  });

  test("critères 5 et 6 — la fiche d'un logiciel : « Où en est-il ? » sans réponse cochée, le type posé quand il n'y en a qu'un, la source laissée « non renseignée », les noms à la casse de l'app", async ({ page }) => {
    await setup(page);
    await page.goto("/import?type=event_sheets#import-form");
    await page.getByLabel("Fiches évènement (PDF, une ou plusieurs)").setInputFiles({ name: "fiche-evenement-complete.pdf", mimeType: "application/pdf", buffer: readFileSync(SHEET_PDF) });
    await page.getByRole("button", { name: "Lire le fichier" }).click();
    await expect(page).toHaveURL(/\/questions$/, { timeout: 30_000 });
    const stage = page.getByRole("group", { name: "Où en est-il ?" });
    await expect(stage.getByRole("radio")).toHaveCount(2);
    await expect(page.locator("main input[type=radio]:checked")).toHaveCount(0);
    await expect(stage.getByRole("radio", { name: /Signé, en préparation/ })).toHaveAccessibleName(/Date de signature : non renseignée/);
    await expect(page.getByLabel("Comment ce couple vous a-t-il connue ? (facultatif)")).toHaveValue("");
    const written = page.getByRole("complementary", { name: "Ce qui sera écrit" });
    await expect(written).toContainText("Léa Martin · Hugo Bernard");
    await expect(written).toContainText("Écrits ainsi dans le fichier : « Léa MARTIN », « Hugo BERNARD ».");
    await expect(written).toContainText("21 650,50 €, dont 3 200,00 € réglés");
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);

    await actions(page).getByRole("button", { name: "Continuer" }).click();
    await expect(stage).toContainText("Choisissez où en est ce mariage.");
    await stage.getByRole("radio", { name: /Signé, en préparation/ }).check();
    await actions(page).getByRole("button", { name: "Continuer" }).click();
    await expect(page).toHaveURL(/\/confirmation$/, { timeout: 30_000 });
    await page.getByRole("button", { name: "Importer 1 évènement" }).click();
    await expect(page).toHaveURL(/\/journal$/, { timeout: 30_000 });
  });

  test("C-59 — « Abandonner cet import… » est un bouton à chaque étape ; sa fenêtre nomme le fichier, et la page d'où l'on vient le dit", async ({ page }) => {
    const actor = await setup(page);
    const { takeoverId } = await enterTakeoverEvent(actor, { takeoverId: null, name: "Juliette & Romain", eventDate: "2031-03-20", clients: [] });
    await page.goto(`/import?type=budget_lines&reprise=${takeoverId}#import-form`);
    await dropFile(page, { name: "budget.csv", mimeType: "text/csv", buffer: readFileSync(BUDGET_CSV) });
    if (isPhone(page)) await expect(page.getByText(/^Étape \d sur \d · Questions$/)).toBeVisible();
    await page.getByRole("button", { name: "Abandonner cet import…" }).click();
    const dialog = page.getByRole("dialog", { name: "Abandonner l'import « budget.csv » ?" });
    await expect(dialog).toContainText("rien n'a encore été importé");
    await expectNoAxeViolation(page);
    await dialog.getByRole("button", { name: "Continuer l'import" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Abandonner cet import…" }).click();
    await dialog.getByRole("button", { name: "Abandonner l'import" }).click();
    await expect(page).toHaveURL(new RegExp(`/reprise/${takeoverId}\\?abandonne=1`), { timeout: 30_000 });
    await expect(feedback(page)).toContainText("Import abandonné : rien n'a été importé.");
  });
});
