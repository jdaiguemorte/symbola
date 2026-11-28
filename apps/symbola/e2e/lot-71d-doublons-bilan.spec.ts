// Lot 71d (HUB-14, BUD-01, PRE-01, UX-07 ; spécification du lot 71, § 5.4 ; maquette 08 du lot 68) —
// « Doublons », « Vérifier », le bilan et « Retirer cet import… » d'un budget de reprise, à 1 440 et à
// 375 px (projets « desktop » et « mobile-375 »), axe-core sur chaque écran et sur la fenêtre de
// retrait, sur le fichier fictif `tableur-planner/budget.csv`. Les règles de fond (nombres, retrait
// d'ensemble, horloge, abus) sont tenues par `lib/import/doublons-bilan-71d.integration.test.ts`.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "./axe";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { appDatabase, createAppConnection } from "@symbola/db/client";
import { defaultVendorSlots } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { addDefaultVendorSlots } from "../modules/events/service";
import { settleTakeoverStep } from "../modules/hub/service";
import { createVendor } from "../modules/vendors/service";
import { enterTakeoverEvent, type TakeoverActor } from "../lib/takeover/flow";
import { readyOrganization, signIn } from "./helpers";

const expect = baseExpect.configure({ timeout: 20_000 });

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

const BUDGET_CSV = join(__dirname, "..", "..", "..", "packages", "testing", "import-corpus", "files", "tableur-planner", "budget.csv");
// Le carnet tel que l'a rempli prestataires.csv ; « Élodie Beauté » y est écrite autrement.
const CARNET = ["Domaine de la Roche Fictive", "Maison Bellerive", "Atelier Pivoine", "Studio Clair-Obscur", "Nuit Blanche Sono", "Atelier Papier Plié", "Élodie Perrot · Beauté"];

const STARTER_SLOTS = ["Lieu de réception", "Traiteur", "Photographe", "Vidéaste", "DJ / musiciens", "Fleuriste", "Décoration", "Coiffure et maquillage", "Papeterie", "Transport des invités"];

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 640;

// À 375 px : aucun défilement de côté (les tableaux défilent dans leur cadre), la barre d'action jamais
// recouverte (la barre du bas du téléphone comprise).
async function expectPhoneRules(page: Page) {
  if (!isPhone(page)) return;
  // Aucune commande sous 44 px (hors lien dans une phrase).
  const small = await page.evaluate(() => {
    const words = (element: Element | null) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
    const inSentence = (link: HTMLElement) => getComputedStyle(link).display === "inline" && words(link.parentElement).length > words(link).length;
    return [...document.querySelectorAll<HTMLElement>("main button, main summary, main a[href], main select")]
      .filter((element) => !(element.tagName === "A" && inSentence(element)))
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ element, box }) => box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden")
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ element, box }) => `${element.tagName} « ${words(element).slice(0, 40)} » ${Math.round(box.width)}×${Math.round(box.height)}`);
  });
  expect(small).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const covered = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".action-bar button, .action-bar a")].filter((element) => {
      element.scrollIntoView({ block: "center" });
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return !(hit && element.contains(hit));
    }).length,
  );
  expect(covered).toBe(0);
}

async function setup(page: Page): Promise<TakeoverActor & { takeoverId: string }> {
  const email = `planner-71d-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org 71d ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const actor: TakeoverActor = { organizationId: organization.id, userId: user.id, viewer: { userId: user.id, role: "owner", allPlannersSeeAll: true } };
    for (const name of CARNET) await createVendor(organization.id, { name });
    // Les postes de départ de l'agence (données de départ), copiés dans le mariage repris.
    await withOrganization(db, organization.id, (tx) => tx.delete(defaultVendorSlots));
    await addDefaultVendorSlots(organization.id, STARTER_SLOTS);
    const { takeoverId } = await enterTakeoverEvent(actor, { takeoverId: null, name: "Juliette & Romain", eventDate: "2027-03-20", clients: [] });
    await settleTakeoverStep(appDatabase(), { organizationId: organization.id, userId: user.id, takeoverId, kind: "vendor_book", state: "no_file" });
    await signIn(page, email);
    return { ...actor, takeoverId };
  } finally {
    await sql.end();
  }
}

const actions = (page: Page) => page.getByRole("group", { name: "Actions de l'étape" });

// budget.csv déposé depuis la page de reprise, colonnes et questions passées.
async function toDoublons(page: Page, takeoverId: string) {
  await page.goto(`/import?type=budget_lines&reprise=${takeoverId}`);
  await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles({ name: "budget.csv", mimeType: "text/csv", buffer: readFileSync(BUDGET_CSV) });
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  await expect(page).toHaveURL(/\/import\/[0-9a-f-]{36}\/(colonnes|questions)$/, { timeout: 30_000 });
  if (page.url().endsWith("/colonnes")) {
    const detail = page.getByLabel("Champ pour la colonne « Détail »");
    if ((await detail.count()) > 0) await detail.selectOption({ label: "Libellé de la ligne" });
    await actions(page).getByRole("button", { name: "Continuer" }).click();
  }
  await expect(page).toHaveURL(/\/questions$/, { timeout: 30_000 });
  await page.getByRole("group", { name: /Les montants de « Acompte versé » ont-ils été payés/ }).getByRole("radio", { name: /^Oui/ }).check();
  await page.getByRole("group", { name: "Leurs contrats sont-ils signés ?" }).getByRole("radio", { name: /Tous/ }).check();
  await actions(page).getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/rapprochements$/, { timeout: 30_000 });
}

test.describe("HUB-14 — Doublons, Vérifier, bilan et retrait d'un budget (lot 71d)", () => {
  test.describe.configure({ timeout: 180_000 });

  test("critères 1 à 4 — les postes rangés, « Photo et vidéo » à vérifier, un poste sans ligne à garder ou retirer, « Élodie Beauté » comparée ; « Continuer » nomme ce qui reste", async ({ page }) => {
    const { takeoverId } = await setup(page);
    await toDoublons(page, takeoverId);

    await expect(page.getByRole("heading", { level: 2, name: /^Postes : 8 postes du fichier/ })).toBeVisible();
    const table = page.locator("table.doublons-table");
    await expect(table.getByRole("row", { name: /^Lieu/ })).toContainText("Nom proche");
    await expect(table.getByRole("row", { name: /^Lieu/ }).getByRole("combobox")).toHaveValue(/.+/);
    const split = table.getByRole("row", { name: /^Photo et vidéo/ });
    await expect(split).toContainText("À vérifier");
    await expect(split).toContainText("« Reportage photo, journée complète » → Photographe");
    await expect(split).toContainText("« Film » → Vidéaste");
    await expect(table.getByRole("row", { name: /^Traiteur/ })).toContainText("Même nom · les 3 lignes gardent leur détail");
    await expect(page.getByRole("heading", { level: 2, name: "Prestataires : 7 noms, 6 trouvés tels quels dans votre carnet" })).toBeVisible();
    const doubt = page.getByRole("article", { name: "« Élodie Beauté » est-elle une fiche de votre carnet ?" });
    await expect(doubt.getByRole("table")).toContainText("Élodie Perrot · Beauté");
    await expect(doubt).toContainText("Ce qui les rapproche : « Élodie » et « Beauté » dans les deux noms");
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);

    // Critère 4 : « Continuer » avec des choix restants les nomme, avec un lien vers chacun.
    await actions(page).getByRole("button", { name: "Continuer" }).click();
    await expect(page).toHaveURL(/\/rapprochements\?reste=1/);
    // … et mène au premier : « Photo et vidéo » est à l'écran.
    await expect(split).toBeInViewport();
    const alert = page.getByRole("alert").filter({ hasText: "Encore" });
    await expect(alert).toContainText("Photo et vidéo");
    await expect(alert.getByRole("link", { name: "Élodie Beauté" })).toBeVisible();

    await split.getByRole("button", { name: "C'est juste" }).click();
    await expect(split).toContainText("Retenu");
    // Critère 2 : chaque poste de départ sans ligne se garde ou se retire.
    const unused = page.locator(".doublons-unused li");
    const count = await unused.count();
    for (let index = 0; index < count; index += 1) {
      const choice = index === 0 ? "Le retirer de ce mariage" : "Le garder « à trouver »";
      await unused.nth(index).getByRole("button", { name: choice }).click();
      await expect(unused.nth(index).getByRole("button", { name: choice })).toHaveAttribute("aria-pressed", "true");
    }
    // Critère 3 : « C'est la même fiche ».
    await doubt.getByRole("button", { name: "C'est la même fiche" }).click();
    await expect(doubt.getByRole("status")).toHaveText("Retenu : la fiche « Élodie Perrot · Beauté » du carnet.");
    await actions(page).getByRole("button", { name: "Continuer" }).click();
    await expect(page).toHaveURL(/\/confirmation$/, { timeout: 30_000 });
  });

  test("critères 5 et 6 — « Vérifier » et le bilan disent les mêmes nombres ; « Retirer cet import… » dit ce qui part et ce qui reste, et la ligne de la reprise repasse « à faire »", async ({ page }) => {
    const { takeoverId } = await setup(page);
    await toDoublons(page, takeoverId);
    await page.locator("table.doublons-table").getByRole("row", { name: /^Photo et vidéo/ }).getByRole("button", { name: "C'est juste" }).click();
    const unused = page.locator(".doublons-unused li");
    for (let index = 0, count = await unused.count(); index < count; index += 1) await unused.nth(index).getByRole("button", { name: "Le garder « à trouver »" }).click();
    await page.getByRole("article", { name: /Élodie Beauté/ }).getByRole("button", { name: "C'est la même fiche" }).click();
    await actions(page).getByRole("button", { name: "Continuer" }).click();
    await expect(page).toHaveURL(/\/confirmation$/, { timeout: 30_000 });

    const verify = page.getByRole("region", { name: "Ce qui va être écrit" }).first();
    const figures = page.locator(".budget-verify .import-figures");
    await expect(figures).toContainText("14 lignes dans 9 postes");
    await expect(figures).toContainText("36 450,00 € prévus");
    await expect(figures).toContainText("27 502,00 € de réel selon votre fichier (8 lignes non renseignées)");
    await expect(figures).toContainText("8 727,00 € réglés : 6 acomptes");
    await expect(figures).toContainText("18 775,00 € à payer : 5 soldes");
    await expect(figures).toContainText("7 prestataires retenus (tous dans votre carnet)");
    await expect(page.locator("main")).not.toContainText(/engag/i);
    await expect(verify).toBeVisible();
    await page.getByText(/tout afficher$/).click();
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);
    const announced = (await figures.innerText()).trim();

    await page.getByRole("button", { name: "Importer 14 lignes de budget" }).click();
    await expect(page).toHaveURL(new RegExp(`/reprise/${takeoverId}\\?importe=`), { timeout: 30_000 });
    await expect(page.locator("#ligne-budget")).toContainText("14 lignes");
    const importId = new URL(page.url()).searchParams.get("importe")!;

    await page.goto(`/import/${importId}/journal`);
    await expect(page.getByRole("heading", { level: 1, name: "Budget repris dans « Juliette & Romain »" })).toBeVisible();
    // Les mêmes nombres, mot pour mot.
    expect((await page.locator(".import-bilan .import-figures").innerText()).trim()).toBe(announced);
    await expect(page.getByText("Rien de votre fichier : les 14 lignes sont dans le budget.")).toBeVisible();
    await expect(page.getByText("« Élodie Beauté » : la fiche « Élodie Perrot · Beauté » du carnet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir le budget" })).toBeVisible();
    await expect(page.getByText(/Un import se retire jusqu'au/)).toBeVisible();
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);

    await page.getByRole("button", { name: "Retirer cet import…" }).click();
    const dialog = page.getByRole("dialog", { name: "Retirer l'import « budget.csv » ?" });
    await expect(dialog).toContainText("Le budget de « Juliette & Romain » revient à ce qu'il était avant le");
    await expect(dialog).toContainText("Partent : 14 lignes, les 6 acomptes réglés, les 5 soldes, 7 prestataires retenus.");
    await expect(dialog).toContainText("Restent : les 7 fiches du carnet (elles y étaient avant cet import).");
    // Renoncer est un bouton nommé, avant le bouton de danger.
    const buttons = dialog.getByRole("button");
    await expect(buttons.first()).toHaveText("Garder l'import");
    await expectNoAxeViolation(page);
    await dialog.getByRole("button", { name: "Retirer l'import" }).click();
    await expect(page.getByRole("status").filter({ hasText: "annulé" })).toBeVisible();

    await page.goto(`/reprise/${takeoverId}`);
    await expect(page.locator("#ligne-budget")).toContainText("À faire");
  });
});
