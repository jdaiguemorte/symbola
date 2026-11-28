// Lot 20 — retours de la recette des lots 18 et 19 (Julien, 10/11/2026) :
// bouton du centre d'aide décollé de la barre (L20-HUB-26), une aide sur chaque
// écran de réglage (AIDE-14), une image pour chaque fiche du centre d'aide
// (AIDE-16), cartes du rétroplanning alignées (L20-EVT-20), archivage d'un
// prestataire depuis le carnet avec confirmation (L20-PRE-17), étiquettes par
// famille avec paliers (décision 5), vocabulaire des écrans qui mêlent les
// évènements (décision 6). En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { starterEventTypes } from "@symbola/starter-templates";
import { addEventTask, addStarterEventTypes, createProspect, createProspectSource, listEventTypes } from "../modules/events/service";
import { createVendor, createVendorFamily, createVendorTag, createVendorType } from "../modules/vendors/service";
import { feedback, helpPanel, readyOrganization, signIn as signInByLink } from "./helpers";
import { bookResults } from "./vendor-book";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function newPlanner(page: Page, vendors: string[] = []) {
  const email = `planner-lot20-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-lot20-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    for (const name of vendors) await createVendor(organization.id, { name, typeId: null, city: "Lille" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);
}

test("Lot 20 — centre d'aide, aide des écrans de réglage, rétroplanning", async ({ page }) => {
  test.setTimeout(120_000);
  await newPlanner(page);

  // L20-HUB-26 ; lot 74f (maquette 27) : « Voir tout le parcours » est sous « Pour bien démarrer », et les
  // articles ne sont plus des vignettes : ils se trouvent par sujet (AIDE-16 : l'image reste sur l'article).
  await page.goto("/aide");
  const start = page.getByRole("region", { name: "Pour bien démarrer" });
  await expect(start.getByRole("link", { name: "Voir tout le parcours" })).toHaveAttribute("href", "/tutoriels");
  await expect(page.locator("main img")).toHaveCount(0);
  await expectNoAxeViolation(page);

  // AIDE-14 : le « ? » des écrans de réglage ouvre leur aide, sans quitter l'écran.
  for (const [path, title] of [
    ["/events/parametres/sources", "Sources et motifs"],
    ["/parametres/relances", "Relances des prospects"],
    ["/prestataires/parametres", "Familles et types de prestataires"],
    ["/prestataires/parametres/etiquettes", "Étiquettes"],
    ["/prestataires/parametres/trajet", "Estimation des trajets"],
  ] as const) {
    await page.goto(path);
    await page.getByRole("button", { name: "Aide sur cet écran" }).click();
    await expect(helpPanel(page, title)).toBeVisible();
    await expect(page).toHaveURL(path);
  }

  // L20-EVT-20 (alignement de la carte « Nouveau modèle ») : remplacé au lot 21
  // par la liste des modèles puis leur détail (L21-EVT-21, L21-EVT-22).
});

test("L20-PRE-17 — archiver un prestataire depuis le carnet, après confirmation", async ({ page }) => {
  test.setTimeout(90_000);
  await newPlanner(page, ["Domaine des Saules", "Fleurs de Lys"]);
  await page.goto("/prestataires");
  const results = bookResults(page);
  await expect(results.getByRole("link", { name: "Domaine des Saules", exact: true })).toBeVisible();

  // Lot 39a (UX-07 ; D6) : archiver s'exécute tout de suite (l'autre fiche reste) et s'annule pendant
  // dix secondes ; plus de confirmation. Lot 73b : « Archiver… » est au menu « ⋯ » de la ligne, à part.
  await page.getByRole("button", { name: "Autres actions pour Domaine des Saules" }).click();
  await page.getByRole("menuitem", { name: /^Archiver…/ }).click();
  await expect(results.getByRole("link", { name: "Domaine des Saules", exact: true })).toHaveCount(0);
  await expect(results.getByRole("link", { name: "Fleurs de Lys", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/prestataires$/);
  const banner = feedback(page).filter({ hasText: "Prestataire archivé." });
  await expect(banner).toBeVisible();
  // Lot 73b : sur téléphone, le message de retour (dix secondes) est posé au-dessus de la barre du bas ; axe
  // fait lui-même défiler la page et le trouve alors sur le « ⋯ » d'une fiche. Ce recouvrement passager
  // n'est pas une taille de cible : la règle « target-size » est écartée pour cette seule vérification, le
  // temps du message (les tailles du carnet sont vérifiées par lot-73b-carnet.spec.ts).
  const axe = new AxeBuilder({ page });
  if (page.viewportSize()!.width < 640) axe.disableRules(["target-size"]);
  const result = await axe.analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
  await banner.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText("C'est rétabli.")).toBeVisible();
  await page.reload();
  await expect(results.getByRole("link", { name: "Domaine des Saules", exact: true })).toBeVisible();

  // Archivée à nouveau, la fiche quitte le carnet.
  await page.getByRole("button", { name: "Autres actions pour Domaine des Saules" }).click();
  await page.getByRole("menuitem", { name: /^Archiver…/ }).click();
  await expect(results.getByRole("link", { name: "Domaine des Saules", exact: true })).toHaveCount(0);
});

test("Décision 5 — étiquettes : paliers repérés puis rangés, choix unique sur la fiche, étiquettes de la famille seulement", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `planner-lot20-tags-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-lot20-e2e";
  const { sql, db } = createAppConnection();
  let venueId: string;
  let floristId: string;
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    const venues = await createVendorFamily(organization.id, { label: "Lieux", color: "#4f6b5a", icon: "venue" });
    const flowers = await createVendorFamily(organization.id, { label: "Fleurs", color: "#a8553a", icon: "flower" });
    const domain = await createVendorType(organization.id, "Domaine", "#4f6b5a", { familyId: venues.id });
    const florist = await createVendorType(organization.id, "Fleuriste", "#a8553a", { familyId: flowers.id });
    for (const label of ["150 à 200 personnes", "100 à 150 personnes"]) await createVendorTag(organization.id, label);
    await createVendorTag(organization.id, "Accès PMR", { familyIds: [venues.id] });
    venueId = (await createVendor(organization.id, { name: "Domaine des Saules", typeId: domain.id, city: "Lille" })).vendor.id;
    floristId = (await createVendor(organization.id, { name: "Fleurs de Lys", typeId: florist.id, city: "Lille" })).vendor.id;
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Les deux tranches de « personnes » se rangent en palier. Lot 21 (L21-PRE-19) :
  // d'un clic, « Ranger mes étiquettes importées ».
  await page.goto("/prestataires/parametres/etiquettes");
  const setup = page.getByRole("region", { name: "Vos étiquettes importées peuvent se ranger toutes seules" });
  await expect(setup).toBeVisible();
  await expectNoAxeViolation(page);
  await setup.getByRole("button", { name: "Ranger mes étiquettes importées" }).click();
  await expect(page.getByRole("status").filter({ hasText: "C'est rangé" })).toContainText("Palier « Capacité » : 2 tranches.");
  await expect(page.getByRole("heading", { name: /^Capacité/, level: 3 })).toContainText("Palier");

  // Sur la fiche d'un lieu : un seul palier à la fois, et l'étiquette des lieux.
  await page.goto(`/prestataires/${venueId}?modifier=1&rubrique=trades`);
  const capacity = page.getByRole("group", { name: "Capacité · un seul choix" });
  await capacity.getByText("100 à 150 personnes", { exact: true }).click();
  await capacity.getByText("150 à 200 personnes", { exact: true }).click();
  await expect(capacity.getByRole("radio", { name: "150 à 200 personnes" })).toBeChecked();
  await expect(capacity.getByRole("radio", { name: "100 à 150 personnes" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Accès PMR" })).toBeVisible();
  await expectNoAxeViolation(page);
  // La fiche se recharge après l'enregistrement : on attend la réponse, puis on relit.
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes(`/prestataires/${venueId}?modifier=1`)),
    page.getByRole("button", { name: "Enregistrer", exact: true }).click(),
  ]);
  await page.goto(`/prestataires/${venueId}?modifier=1&rubrique=trades`);
  await expect(page.getByRole("radio", { name: "150 à 200 personnes" })).toBeChecked();

  // Sur la fiche d'une fleuriste : pas d'étiquette réservée aux lieux.
  await page.goto(`/prestataires/${floristId}?modifier=1&rubrique=trades`);
  await expect(page.getByRole("radio", { name: "100 à 150 personnes" })).toBeAttached();
  await expect(page.getByRole("checkbox", { name: "Accès PMR" })).toHaveCount(0);
});

test("Décision 6 — Tâches : vocabulaire neutre quand les évènements sont de plusieurs types, celui de l'évènement sur chaque ligne", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `planner-lot20-vocab-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-lot20-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    await addStarterEventTypes(organization.id, starterEventTypes("fr", "wedding_planner"));
    const types = await listEventTypes(organization.id);
    const typeOf = (key: string) => types.find((type) => type.starterKey === key)!.id;
    const source = await createProspectSource(organization.id, "Salon");
    const create = async (firstName: string, eventTypeId: string) =>
      (await createProspect({ organizationId: organization.id, createdByUserId: user.id, prospectSourceId: source.id, clients: [{ firstName, lastName: null }], eventTypeId })).id;
    const wedding = await create("Camille", typeOf("wedding"));
    const seminar = await create("Arteka", typeOf("seminar"));
    await addEventTask(organization.id, wedding, { label: "Choisir les alliances", dueDate: "2027-03-01", responsible: "clients" });
    await addEventTask(organization.id, seminar, { label: "Valider le traiteur", dueDate: "2027-03-02", responsible: "clients" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);
  await page.goto("/taches");
  // Lot 70c (D3) : la ligne type — titre, évènement, échéance, « Qui s'en charge » — remplace le tableau.
  const line = (label: string) => page.locator(".task-line").filter({ has: page.getByRole("link", { name: label, exact: true }) });
  await expect(page.locator(".task-lines-head")).toContainText("Qui s'en charge");
  // Le filtre qui mêle tous les évènements emploie le mot neutre (lot 70d : une option de « Qui s'en charge »).
  await expect(page.locator('select[name="qui"]').first().locator("option", { hasText: /^Les clients$/ })).toHaveCount(1);
  // Chaque ligne, le terme de son évènement : « Les mariés » pour un mariage, « Les clients » pour un séminaire.
  await expect(line("Choisir les alliances").locator(".task-line-who")).toHaveText(/Les mariés$/);
  await expect(line("Valider le traiteur").locator(".task-line-who")).toHaveText(/Les clients$/);
  await expectNoAxeViolation(page);
});
