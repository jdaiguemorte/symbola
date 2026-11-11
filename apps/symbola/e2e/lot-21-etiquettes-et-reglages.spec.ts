// Lot 21 — étiquettes prêtes à l'emploi et écrans de réglage simplifiés
// (retours de recette du lot 20, Julien, 10/11/2026). Corrections directes :
// pastilles sur toute la largeur de la fiche (L21-PRE-20), menu des réglages qui
// défile seul (L21-HUB-28). Décisions validées le 10/11/2026 : étiquettes de
// départ et rangement des importées (L21-PRE-18, L21-PRE-19), Programme du jour J en
// liste puis détail (L21-EVT-21), modes de paiement activables (DEV-13), groupes
// lisibles dans le menu (L21-HUB-29). En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { createVendor, createVendorTag, createVendorType, listVendorTypes, seedStarterVendorCatalog } from "../modules/vendors/service";
import { vendorCatalogInput } from "../lib/vendors/catalog";
import { readyOrganization } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("L21-PRE-20 — les pastilles d'étiquettes prennent toute la largeur de la fiche", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `planner-lot21-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-lot21-e2e";
  const { sql, db } = createAppConnection();
  let vendorId: string;
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    for (const label of ["Anglais", "Bougies", "Champêtre"]) await createVendorTag(organization.id, label);
    vendorId = (await createVendor(organization.id, { name: "Fleurs de Lys", typeId: null, city: "Lille" })).vendor.id;
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  for (const path of [`/prestataires/${vendorId}`, "/prestataires/nouveau"]) {
    await page.goto(path);
    const chips = page.locator(".tag-chips .tag-chip");
    await expect(chips).toHaveCount(3);
    // Des pastilles courtes se suivent sur une ligne : même hauteur à l'écran
    // (les trois en taille ordinateur, les deux premières en 375 px).
    const boxes = await Promise.all([0, 1, 2].map(async (i) => (await chips.nth(i).boundingBox())!));
    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThanOrEqual(1);
    if (page.viewportSize()!.width >= 1024) expect(Math.abs(boxes[0]!.y - boxes[2]!.y)).toBeLessThanOrEqual(1);
    // La rangée de pastilles occupe la largeur du bloc Étiquettes.
    const block = (await page.locator(".tag-fieldset").boundingBox())!;
    const row = (await page.locator(".tag-chips").first().boundingBox())!;
    expect(row.width).toBeGreaterThan(block.width * 0.8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await expectNoAxeViolation(page);
});

test("L21-HUB-28 — le menu des réglages défile seul, sans faire défiler l'écran", async ({ page }) => {
  test.setTimeout(90_000);
  // Le menu est collé à gauche de l'écran seulement en taille ordinateur ;
  // en 375 px il passe au-dessus du contenu et défile avec la page.
  test.skip(page.viewportSize()!.width < 1024, "menu latéral en taille ordinateur");
  const email = `planner-lot21-nav-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-lot21-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    // Un écran de réglage plus long que la fenêtre.
    for (let i = 1; i <= 30; i += 1) await createVendorType(organization.id, `Type de prestataire ${i}`, "#4f6b5a");
  } finally {
    await sql.end();
  }
  await page.setViewportSize({ width: 1280, height: 640 });
  await loginAndSetupMfa(page, email, password);
  await page.goto("/prestataires/parametres");

  const nav = page.getByRole("navigation", { name: "Rubriques des paramètres" });
  await expect(nav).toBeVisible();
  const sizes = await nav.evaluate((element) => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  expect(sizes.scrollHeight).toBeGreaterThan(sizes.clientHeight);

  const box = (await nav.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => nav.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // La dernière rubrique devient visible sans aller au bas de l'écran.
  await page.mouse.wheel(0, 2000);
  await expect(nav.getByRole("link").last()).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

async function newPlanner(page: Page, prepare?: (organizationId: string) => Promise<void>) {
  const email = `planner-lot21-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-lot21-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    if (prepare) await prepare(organization.id);
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);
}

test("L21-HUB-29 — chaque groupe du menu des réglages a son icône et un titre en casse normale", async ({ page }) => {
  test.setTimeout(60_000);
  await newPlanner(page);
  await page.goto("/parametres");
  const nav = page.getByRole("navigation", { name: "Rubriques des paramètres" });
  const titles = nav.locator(".settings-nav-title");
  expect(await titles.count()).toBeGreaterThanOrEqual(3);
  await expect(titles.filter({ hasText: "Événements" })).toBeVisible();
  for (const title of await titles.all()) {
    await expect(title.locator("svg")).toHaveCount(1);
    expect(await title.evaluate((element) => getComputedStyle(element).textTransform)).toBe("none");
  }
  await expectNoAxeViolation(page);
});

test("DEV-13 — un mode de paiement se désactive puis se réactive, d'un interrupteur", async ({ page }) => {
  test.setTimeout(60_000);
  await newPlanner(page);
  await page.goto("/devis/parametres");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Charger les modes de départ" }).click();
  const cheque = page.getByRole("switch", { name: "Chèque accepté" });
  await expect(cheque).toBeChecked();
  await expect(page.getByText("Désactiver un mode ne change rien aux paiements déjà enregistrés", { exact: false })).toBeVisible();

  await cheque.click();
  await expect(cheque).not.toBeChecked();
  await expect(page.locator(".pay-card", { hasText: "Chèque" })).toContainText("Non proposé à l'encaissement");
  await expectNoAxeViolation(page);
  await cheque.click();
  await expect(cheque).toBeChecked();
});

test("L21-EVT-21 — Programme du jour J : la liste des modèles, puis le détail ; une ligne se modifie dans le panneau", async ({ page }) => {
  test.setTimeout(90_000);
  await newPlanner(page);
  await page.goto("/events/modeles-programme");
  await page.getByRole("link", { name: "Nouveau modèle" }).click();
  await page.getByRole("complementary", { name: "Nouveau modèle de programme" }).getByLabel("Nom du modèle de programme").fill("Mariage en domaine");
  await page.getByRole("button", { name: "Créer le modèle de programme" }).click();
  await expect(page).toHaveURL(/\/events\/modeles-programme\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Mariage en domaine", level: 1 })).toBeVisible();

  // Deux lignes, ajoutées dans le panneau qui reste ouvert.
  await page.getByRole("link", { name: "Ajouter une ligne" }).click();
  const panel = page.getByRole("complementary", { name: "Nouvelle ligne" });
  for (const [start, label, participants] of [
    ["15:00", "Cérémonie", "Officiant de cérémonie laïque, Photographe, Vidéaste, DJ / musiciens"],
    ["16:00", "Photos de groupe", "Photographe"],
  ] as const) {
    await panel.getByLabel("Heure de début").fill(start);
    await panel.getByLabel("Intitulé de la ligne").fill(label);
    await panel.getByLabel(/Intervenants/).fill(participants);
    await panel.getByRole("button", { name: "Ajouter la ligne au modèle" }).click();
    await expect(page.getByRole("row", { name: new RegExp(label) })).toBeVisible();
  }
  await panel.getByRole("link", { name: "Fermer le panneau" }).click();

  // « Supprimer » au même endroit sur chaque ligne, quelle que soit sa longueur.
  const remove = page.getByRole("button", { name: /^Supprimer la ligne/ });
  await expect(remove).toHaveCount(2);
  const [first, second] = [(await remove.nth(0).boundingBox())!, (await remove.nth(1).boundingBox())!];
  expect(Math.abs(first.x - second.x)).toBeLessThanOrEqual(1);
  await expectNoAxeViolation(page);

  // Modifier une ligne : le panneau s'ouvre rempli ; la ligne change, à sa place.
  await page.getByRole("link", { name: "Modifier la ligne Photos de groupe" }).click();
  const edit = page.getByRole("complementary", { name: "Modifier « Photos de groupe »" });
  await expect(edit.getByLabel("Intitulé de la ligne")).toHaveValue("Photos de groupe");
  await edit.getByLabel("Intitulé de la ligne").fill("Photos de groupe et de famille");
  await edit.getByRole("button", { name: "Enregistrer la ligne" }).click();
  await expect(page.getByRole("row", { name: /Photos de groupe et de famille/ })).toBeVisible();
  // Le panneau de modification se ferme à l'enregistrement.
  await expect(page.getByRole("complementary", { name: /^Modifier « / })).toHaveCount(0);

  // Renommer, puis supprimer le modèle après confirmation.
  await page.getByRole("link", { name: "Renommer" }).click();
  await page.getByRole("complementary", { name: "Renommer le modèle" }).getByLabel("Nom du modèle de programme").fill("Mariage laïque");
  await page.getByRole("button", { name: "Enregistrer le nom" }).click();
  await expect(page.getByRole("heading", { name: "Mariage laïque", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Supprimer ce modèle…" }).click();
  await page.getByRole("dialog", { name: "Supprimer le modèle « Mariage laïque » ?" }).getByRole("button", { name: "Supprimer le modèle" }).click();
  await expect(page).toHaveURL(/\/events\/modeles-programme$/);
  await expect(page.getByText("Aucun modèle de programme pour l'instant.")).toBeVisible();
});

test("L21-PRE-18 / L21-PRE-19 — étiquettes importées rangées d'un clic, étiquettes proposées ajoutées ; la fiche ne montre que celles du type", async ({ page }) => {
  test.setTimeout(120_000);
  let venueId = "";
  let floristId = "";
  await newPlanner(page, async (organizationId) => {
    await seedStarterVendorCatalog(organizationId, vendorCatalogInput("fr"), { withTypes: true });
    const types = await listVendorTypes(organizationId);
    const typeId = (key: string) => types.find((type) => type.starterKey === key)!.id;
    // Étiquettes reprises de l'import : ni famille ni groupe.
    const tags = await Promise.all(["100 à 150 personnes", "150 à 200 personnes", "Bougies", "Accès PMR"].map((label) => createVendorTag(organizationId, label)));
    venueId = (await createVendor(organizationId, { name: "Domaine des Saules", typeId: typeId("venue"), city: "Lille", tagIds: [tags[0]!.id, tags[1]!.id, tags[3]!.id] })).vendor.id;
    floristId = (await createVendor(organizationId, { name: "Fleurs de Lys", typeId: typeId("florist"), city: "Lille", tagIds: [tags[2]!.id] })).vendor.id;
  });

  await page.goto("/prestataires/parametres/etiquettes");
  const setup = page.getByRole("region", { name: "Vos étiquettes importées peuvent se ranger toutes seules" });
  await expect(setup).toContainText("4 étiquettes n'ont ni famille ni groupe");
  await expectNoAxeViolation(page);
  await setup.getByRole("button", { name: "Ranger mes étiquettes importées" }).click();
  const recap = page.getByRole("status").filter({ hasText: "C'est rangé" });
  await expect(recap).toContainText("Palier « Capacité » : 2 tranches.");
  await expect(recap.getByRole("link", { name: "Domaine des Saules" })).toBeVisible();

  await page.getByRole("button", { name: /^Ajouter les étiquettes proposées/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "ajoutées" })).toBeVisible();

  // La fiche du lieu : un seul palier de capacité, la plus haute tranche gardée.
  await page.goto(`/prestataires/${venueId}`);
  const capacity = page.getByRole("group", { name: "Capacité · un seul choix" });
  await expect(capacity.getByRole("radio", { name: "150 à 200 personnes" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Accès PMR" })).toBeChecked();
  await expectNoAxeViolation(page);

  // La fiche de la fleuriste : ses étiquettes, pas celles des lieux.
  await page.goto(`/prestataires/${floristId}`);
  await expect(page.getByRole("checkbox", { name: "Bougies" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Bohème" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Capacité · un seul choix" })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Accès PMR" })).toHaveCount(0);
});
