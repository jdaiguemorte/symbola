// Lot 71e (HUB-14, PRE-01, PRE-02, CHR-06, CHR-08, UX-17 ; spécification du lot 71, § 5.5 ; maquettes 10 et
// 11 du lot 68) — les PDF des prestataires retenus et du programme par l'assistant commun, à 1 440 et à
// 375 px (projets « desktop » et « mobile-375 »), axe-core sur l'arrêt « autre couple », l'aperçu, le
// bilan, l'onglet et la fenêtre de diffusion. Fichiers fictifs du corpus ; le mariage s'appelle « Léa &
// Hugo », le fichier nomme « Clémence & Bastien ».
import { randomUUID } from "node:crypto";
import path from "node:path";
import AxeBuilder from "./axe";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addEventVendorSlot, createProspect } from "../modules/events/service";
import { readyOrganization, signIn } from "./helpers";

const expect = baseExpect.configure({ timeout: 20_000 });
const corpus = (name: string) => path.resolve(process.cwd(), `../../packages/testing/import-corpus/files/logiciel-tiers/${name}`);

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoSideScroll(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) >= 640) return;
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

async function wedding(page: Page): Promise<string> {
  const email = `planner-71e-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org 71e ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const event = await createProspect({ organizationId: organization.id, createdByUserId: user.id, prospectSourceId: null, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Hugo", lastName: "Bernard" }], eventDate: "2027-06-12" });
    for (const label of ["Lieu de réception", "Photographe", "DJ", "Traiteur"]) await addEventVendorSlot(organization.id, event.id, label);
    await signIn(page, email);
    return event.id;
  } finally {
    await sql.end();
  }
}

async function upload(page: Page, file: string) {
  await page.getByLabel(/Le PDF de votre logiciel de planning/).setInputFiles(corpus(file));
  await page.locator("#import-form").getByRole("button", { name: "Lire le fichier" }).click();
  await expect(page).toHaveURL(/\/import\/[0-9a-f-]+\/pdf/, { timeout: 30_000 });
}

test("HUB-14, PRE-02 — prestataires retenus : arrêt « autre couple », contrats, aperçu lisible, bilan et retrait", async ({ page }) => {
  test.setTimeout(180_000);
  const eventId = await wedding(page);
  await page.goto(`/events/${eventId}?onglet=budget`);
  await page.getByRole("link", { name: "Reprendre les prestataires retenus (PDF)" }).click();
  await upload(page, "prestataires-evenement.pdf");

  // Critère 1 : le fichier nomme un autre couple ; rien ne s'ouvre avant la réponse.
  await expect(page.getByRole("heading", { name: "Ce fichier est-il bien celui de Léa et Hugo ?" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Clémence Martin · Bastien Leroy" })).toBeVisible();
  await expectNoAxeViolation(page);
  await expectNoSideScroll(page);
  await page.getByRole("button", { name: "C'est bien ce mariage, continuer" }).click();

  // Critères 2 et 3 : la question des contrats, puis l'aperçu, sans menu à ouvrir.
  await page.getByRole("radio", { name: "Tous" }).check();
  await page.getByRole("button", { name: "Enregistrer la réponse" }).click();
  await expect(page.getByRole("heading", { name: "12 prestataires retenus" })).toBeVisible();
  await expect(page.getByText("Ligne non reprise : « Belle Journée », votre agence.")).toBeVisible();
  // Seules les lignes incertaines sont « À vérifier », avec leur raison ; leur menu est le seul de l'aperçu.
  await expect(page.locator(".pdf-row-verify").first()).toContainText("À vérifier");
  await expect(page.locator(".pdf-row-verify").first()).toContainText("Aucun poste proche");
  await expect(page.locator("tr:not(.pdf-row-verify) select")).toHaveCount(0);
  await expect(page.getByText("12 contrats signés · 0 non signés")).toBeVisible();
  await expectNoAxeViolation(page);
  await expectNoSideScroll(page);

  // Critère 4 : le bilan redit les nombres ; le retrait défait tout.
  await page.getByRole("button", { name: "Importer les 12 prestataires" }).click();
  await expect(page).toHaveURL(/\/journal/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "12 prestataires retenus sur « Léa & Hugo »" })).toBeVisible();
  await expect(page.getByText("Contrats signés : 12")).toBeVisible();
  await expect(page.getByText("Le fichier nommait un autre couple ; vous avez répondu « C'est bien ce mariage ».")).toBeVisible();
  await expectNoAxeViolation(page);
  await expectNoSideScroll(page);
});

test("CHR-08 — programme repris d'un PDF : aucune fin inventée, « À compléter », « Ponctuel », diffusion qui le dit, annuaire au carnet", async ({ page }) => {
  test.setTimeout(240_000);
  const eventId = await wedding(page);
  await page.goto(`/events/${eventId}?onglet=programme`);
  await page.getByRole("link", { name: "Reprendre un programme (PDF)" }).click();
  await upload(page, "programme-jour-j.pdf");
  await page.getByRole("button", { name: "C'est bien ce mariage, continuer" }).click();

  // Critère 5 : « Vérifier » dit les journées, les moments, les fins non renseignées ; aucune n'est déduite.
  await expect(page.getByRole("heading", { name: "Vérifier : ce qui va être écrit" })).toBeVisible();
  await expect(page.getByText("3 journées")).toBeVisible();
  await expect(page.getByText("19 h – 2 h le lendemain").first()).toBeVisible();
  await expect(page.getByText(/une fin à minuit, laissée vide/).first()).toBeVisible();
  await expect(page.getByText("Fin non renseignée").first()).toBeVisible();
  await expectNoAxeViolation(page);
  await expectNoSideScroll(page);
  await page.getByRole("button", { name: /^Importer les \d+ moments$/ }).click();
  await expect(page).toHaveURL(/\/journal/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Programme repris dans « Léa & Hugo »" })).toBeVisible();
  await expect(page.getByText(/L'annuaire du programme : 8 intervenants/)).toBeVisible();
  await expectNoAxeViolation(page);

  // Critère 6 : l'onglet compte les fins manquantes ; « Ponctuel » fait baisser le compte.
  await page.goto(`/events/${eventId}?onglet=programme`);
  // Aucune fin n'est déduite de la séquence suivante dans l'éditeur non plus.
  const keys = page.locator(".program-line").filter({ hasText: "Récupérer les clés" });
  await expect(keys).not.toContainText("12:15");
  await expect(keys).toContainText("fin non renseignée");
  const gaps = page.locator("#a-completer");
  const title = await gaps.getByRole("heading").innerText();
  const before = Number(/(\d+)/.exec(title)![1]);
  await expectNoAxeViolation(page);
  await gaps.getByRole("button", { name: /est ponctuel/ }).first().click();
  await expect(gaps.getByRole("heading")).toContainText(`${before - 1} heure`);

  // Critère 7 : « Diffuser » sur un programme incomplet ouvre la fenêtre ; « Diffuser quand même » diffuse.
  await page.getByRole("button", { name: "Diffuser le programme (version 1)" }).click();
  const dialog = page.getByRole("dialog", { name: "Le programme n'est pas complet" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("heure de fin à venir");
  await expectNoAxeViolation(page);
  await dialog.getByRole("button", { name: "Diffuser quand même" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Version 1 diffusée" })).toBeVisible();
});
