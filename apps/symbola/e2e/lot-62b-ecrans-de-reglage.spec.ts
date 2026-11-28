// Lot 62b — écrans de réglage (UX-12, UX-13, UX-05, UX-07, UX-09 ; décisions D1 et D2 du 20/11/2026).
// Le menu des Paramètres en groupes repliables avec « Chercher un réglage » ; les formulaires en
// grille (Entreprise et TVA en trois cartes et un seul « Enregistrer la fiche ») ; le plan de comptes
// en tableau ; les listes éditables enregistrées à la sortie du champ, avec « Annuler la dernière
// modification » ; le journal d'activité lisible. Critères communs du lot mesurés sur chaque écran
// repris : un seul bouton principal, aucun nombre ni date de plus de 260 px, pas six champs empilés
// en 1440 px, aucun débordement ni cible de moins de 44 px en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { createProspect, createProspectSource } from "../modules/events/service";
import { setModuleEnabled } from "../modules/hub/service";
import { ensureEventTypes } from "../lib/events/event-types";
import { confirmImpactAssessment } from "../modules/guests/service";
import { openSettingsRubric, readyOrganization, signIn } from "./helpers";

const SAVED = "Modification enregistrée.";
const UNDO = "Annuler la dernière modification";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 600;
}

// Le relevé du lot 62 mesure les écrans en 1440 × 900.
async function desktopSize(page: Page) {
  if (!isPhone(page)) await page.setViewportSize({ width: 1440, height: 900 });
}

// Les mesures de l'outil de relevé (e2e/zz-releve-ergonomie.spec.ts), sur l'écran ouvert.
async function measure(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main") as HTMLElement;
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const all = (root: Element, selector: string) => [...root.querySelectorAll(selector)].filter(visible);
    const fields = all(main, 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea');
    let run = 0;
    let stacked = 0;
    let previous: DOMRect | null = null;
    for (const field of fields) {
      const rect = field.getBoundingClientRect();
      run = previous && Math.abs(rect.left - previous.left) < 3 && rect.top > previous.bottom - 2 ? run + 1 : 1;
      stacked = Math.max(stacked, run);
      previous = rect;
    }
    const submits: Record<string, number> = {};
    for (const button of all(main, 'button[type="submit"], button:not([type])')) {
      const label = (button.textContent ?? "").trim();
      submits[label] = (submits[label] ?? 0) + 1;
    }
    // Cibles tactiles : l'écran et le menu des réglages (cases et boutons radio à part : leur libellé porte la cible).
    const targets = [...all(main, "button, select, summary, input:not([type='hidden'])"), ...all(document.querySelector(".settings-nav") ?? main, "button, input, a")];
    return {
      primary: all(main, 'button, a, input[type="submit"]')
        .filter((element) => getComputedStyle(element).backgroundColor === "rgb(15, 110, 92)")
        .map((element) => (element.textContent ?? "").trim()),
      wideShortFields: fields.filter((field) => ["number", "date", "time"].includes(field.getAttribute("type") ?? "") && field.getBoundingClientRect().width > 260).length,
      stacked,
      repeatedSubmits: Object.entries(submits).filter(([, count]) => count > 3),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      smallTargets: targets
        .filter((element) => !["checkbox", "radio", "file"].includes(element.getAttribute("type") ?? ""))
        .filter((element) => element.getBoundingClientRect().height < 43.5)
        .map((element) => `${element.tagName} ${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40)}`),
      screens: document.documentElement.scrollHeight / window.innerHeight,
    };
  });
}

// Critères communs aux quatre paquets du lot 62, pour l'écran ouvert.
async function expectCommonCriteria(page: Page, screen: string) {
  // Un bouton survolé change de couleur : la souris quitte l'écran avant la mesure.
  await page.mouse.move(0, 0);
  // L'écran au repos, en haut : la barre d'une liste éditable reste collée en haut quand on défile.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const found = await measure(page);
  expect(found.primary.length, `${screen} : un seul bouton principal (${found.primary.join(", ")})`).toBeLessThanOrEqual(1);
  expect(found.wideShortFields, `${screen} : nombre ou date de plus de 260 px`).toBe(0);
  expect(found.repeatedSubmits, `${screen} : bouton d'envoi répété plus de trois fois`).toEqual([]);
  if (isPhone(page)) {
    expect(found.overflow, `${screen} : débordement horizontal`).toBeLessThanOrEqual(0);
    expect(found.smallTargets, `${screen} : cibles de moins de 44 px`).toEqual([]);
  } else {
    expect(found.stacked, `${screen} : champs empilés sur un même bord`).toBeLessThan(6);
  }
  await expectNoAxeViolation(page);
  return found;
}

// Atelier prêt et sa titulaire, tous les modules des écrans de réglage ouverts ; un évènement de type
// « Mariage », pour qu'un type ait un évènement.
async function atelier() {
  const email = `planner-lot62b-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let ownerId: string;
  try {
    organizationId = (await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
    ownerId = (await createUser(db, { organizationId, email, role: "owner" })).id;
    await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey: "guests", enabled: true });
  } finally {
    await sql.end();
  }
  await confirmImpactAssessment(organizationId, ownerId);
  const source = await createProspectSource(organizationId, "Salon");
  const wedding = (await ensureEventTypes(organizationId, "fr")).find((type) => type.label === "Mariage")!;
  await createProspect({ organizationId, createdByUserId: ownerId, prospectSourceId: source.id, eventTypeId: wedding.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Petit" }], eventDate: "2027-06-12" });
  return { email };
}

// Lot 74g (G1, G2, G7) : les groupes repliables laissent place à l'accueil, groupes ouverts ; « Chercher un
// réglage » y reste jusqu'au 74k ; une rubrique ouverte garde le menu de son groupe (1 100 px et plus).
test("UX-13 — Menu des Paramètres : l'accueil, « Chercher un réglage », le menu du groupe (D2, lot 74g)", async ({ page }) => {
  test.setTimeout(240_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await desktopSize(page);
  await page.goto("/parametres");
  const home = page.getByRole("main");

  // « Chercher un réglage » filtre les rubriques par leur nom, sans tenir compte des accents.
  const search = home.getByRole("searchbox", { name: "Chercher un réglage" });
  await search.fill("relance");
  await expect(home.locator(".settings-home-label")).toHaveText(["Prospects : délai avant relance", "Paiements et propositions : relances"]);
  await expect(home.getByRole("status")).toHaveText("2 réglages trouvés");
  await search.fill("evenement");
  await expect(home.locator(".settings-home-label", { hasText: "Types d'évènements et termes des clients" })).toBeVisible();
  await expect(home.locator(".settings-home-label", { hasText: "Modèles d'évènement" })).toBeVisible();
  await search.fill("zzz");
  await expect(home.locator(".settings-home-link")).toHaveCount(0);
  await expect(home.getByText("Aucun réglage ne porte ce nom.")).toBeVisible();
  await expectNoAxeViolation(page);

  // Une rubrique trouvée s'ouvre ; son titre est son libellé.
  await search.fill("catalogue");
  await home.locator(".settings-home-link", { hasText: "Catalogue des prestations" }).click();
  await expect(page).toHaveURL(/\/devis\/catalogue$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Catalogue des prestations");
  await expectNoAxeViolation(page);
  const found = await measure(page);
  if (isPhone(page)) {
    expect(found.overflow).toBeLessThanOrEqual(0);
    expect(found.smallTargets).toEqual([]);
    await expect(page.getByRole("navigation", { name: "Paramètres · Devis et factures" })).toBeVisible();
    return;
  }

  // En 1440 × 900, chaque rubrique est allumée dans le menu de son groupe, visible sans faire défiler.
  const rubrics = page.getByRole("navigation", { name: "Rubriques des paramètres" });
  await page.goto("/parametres");
  const hrefs = await home.locator(".settings-home-link").evaluateAll((links) => links.map((link) => link.getAttribute("href")!));
  expect(hrefs.length).toBeGreaterThan(30);
  for (const href of hrefs) {
    await page.goto(href);
    const current = rubrics.locator('a[aria-current="page"]');
    await expect(current, href).toHaveAttribute("href", href);
    await expect(current, href).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => window.scrollY), href).toBe(0);
  }
});

test("UX-12 — Fiche de l'entreprise (lot 74g) : trois cartes, un seul « Enregistrer la fiche », la TVA en ligne", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await desktopSize(page);
  await page.goto("/parametres/entreprise");
  await page.waitForLoadState("networkidle");

  const sheet = page.getByRole("form", { name: "Fiche entreprise" });
  for (const card of ["Identité", "Adresse", "Coordonnées imprimées"]) await expect(sheet.getByRole("region", { name: card, exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "TVA", exact: true })).toBeVisible();

  // Une coordonnée refusée n'enregistre rien de la fiche, et le dit ; la saisie reste à l'écran.
  const storedSiren = await sheet.getByLabel("SIREN").inputValue();
  await sheet.getByLabel("SIREN").fill("987654321");
  await sheet.getByLabel("SIRET (14 chiffres)").fill("1234");
  await sheet.getByRole("button", { name: "Enregistrer la fiche" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Le SIRET doit compter 14 chiffres.");
  await expect(sheet.getByLabel("SIREN")).toHaveValue("987654321");
  await expect(sheet.getByLabel("SIRET (14 chiffres)")).toHaveValue("1234");
  await page.goto("/");
  await page.goto("/parametres/entreprise");
  await expect(sheet.getByLabel("SIREN")).toHaveValue(storedSiren);

  // Identité, adresse et coordonnées partent ensemble.
  await sheet.getByLabel("SIREN").fill("123456789");
  await sheet.getByLabel("SIRET (14 chiffres)").fill("123 456 789 00012");
  await sheet.getByLabel("Forme juridique").selectOption("sasu");
  await sheet.getByRole("textbox", { name: "Adresse", exact: true }).fill("12 rue des Lilas");
  await sheet.getByLabel("Code postal").fill("59000");
  await sheet.getByLabel("Ville").fill("Lille");
  await sheet.getByLabel("E-mail de contact").fill("bonjour@atelier.example");
  await sheet.getByRole("button", { name: "Enregistrer la fiche" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Fiche entreprise enregistrée.");
  await page.goto("/parametres/entreprise");
  await expect(sheet.getByLabel("SIRET (14 chiffres)")).toHaveValue("12345678900012");
  await expect(sheet.getByLabel("Ville")).toHaveValue("Lille");
  await expect(sheet.getByLabel("E-mail de contact")).toHaveValue("bonjour@atelier.example");

  // Code postal, pays et date : des champs courts ; code postal et ville sur une même ligne en 1440 px.
  const [postalCode, city] = [await sheet.getByLabel("Code postal").boundingBox(), await sheet.getByLabel("Ville").boundingBox()];
  expect(postalCode!.width).toBeLessThan(160);
  if (!isPhone(page)) expect(Math.abs(postalCode!.y - city!.y)).toBeLessThan(4);

  // La TVA, dans sa carte, en formulaire en ligne : le régime change sans quitter l'écran.
  const vat = page.getByRole("form", { name: "Régime de TVA" });
  await vat.getByLabel("Nouveau régime").selectOption("assujetti");
  await vat.getByLabel("Date d'effet").fill("2027-01-01");
  await vat.getByRole("button", { name: "Changer de régime" }).click();
  await expect(page.getByRole("region", { name: "TVA", exact: true })).toContainText("Régime actuel : Assujetti");
  const debits = page.getByRole("form", { name: "Option pour la TVA sur les débits" });
  await debits.getByLabel("Non").check();
  await debits.getByRole("button", { name: "Enregistrer l'option" }).click();
  await expect(debits.getByRole("status")).toHaveText("Option enregistrée.");

  // L'écran au repos, pour une entreprise assujettie (le cas le plus haut).
  await page.goto("/parametres/entreprise");
  await page.waitForLoadState("networkidle");
  const found = await expectCommonCriteria(page, "/parametres/entreprise");
  expect(found.primary).toEqual(["Enregistrer la fiche"]);

  // Deuxième rubrique (lot 74g) : « Mentions et logo des documents », à sa propre adresse ; l'ancienne
  // ancre d'un de ses blocs y mène.
  await page.goto("/parametres/mentions");
  await expect(page.getByRole("form", { name: "Informations du professionnel" })).toBeVisible();
  await expectCommonCriteria(page, "/parametres/mentions");
  await page.goto("/");
  await page.goto("/parametres#informations-professionnel");
  await expect(page).toHaveURL(/\/parametres\/mentions#informations-professionnel$/);
  await expect(page.getByRole("form", { name: "Informations du professionnel" })).toBeVisible();
  // Deux écrans au plus en 1440 px (4,3 avant le lot).
  if (!isPhone(page)) expect(found.screens).toBeLessThanOrEqual(2);
});

test("UX-12 — Formulaires en grille des réglages : champs courts, un seul bouton principal, plan de comptes en tableau", async ({ page }) => {
  test.setTimeout(240_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await desktopSize(page);

  // Paramètres des devis : délais et préfixes en champs courts, un seul « Enregistrer les paramètres ».
  await page.goto("/devis/parametres");
  await page.waitForLoadState("networkidle");
  expect((await page.getByLabel("Validité d'un devis (jours)").boundingBox())!.width).toBeLessThan(140);
  expect((await page.getByLabel("Préfixe des devis").boundingBox())!.width).toBeLessThan(160);
  await page.getByLabel("Validité d'un devis (jours)").fill("45");
  await page.getByLabel("Préfixe des factures").fill("FA");
  await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
  await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Validité d'un devis (jours)")).toHaveValue("45");
  await expect(page.getByLabel("Préfixe des factures")).toHaveValue("FA");
  expect((await expectCommonCriteria(page, "/devis/parametres")).primary).toEqual(["Enregistrer les paramètres"]);

  // Réglages RGPD : neuf durées en champs courts.
  await page.goto("/rgpd/reglages");
  await page.waitForLoadState("networkidle");
  const alertDays = page.getByLabel("Alerte au tableau de bord quand l'échéance d'une demande est à moins de (jours)");
  expect((await alertDays.boundingBox())!.width).toBeLessThan(140);
  await alertDays.fill("9");
  await page.getByRole("button", { name: "Enregistrer les réglages" }).click();
  await expect(page.getByText("Réglages enregistrés.")).toBeVisible();
  expect((await expectCommonCriteria(page, "/rgpd/reglages")).primary).toEqual(["Enregistrer les réglages"]);

  // Prestataires par lien : une ligne par tâche (intitulé, échéance en champ court).
  await page.goto("/events/parametres/prestataires-par-lien");
  await page.waitForLoadState("networkidle");
  const [taskLabel, taskDays] = [await page.getByLabel("Tâche 1", { exact: true }).boundingBox(), await page.getByLabel("Échéance de la tâche 1 (jours)").boundingBox()];
  expect(Math.abs(taskLabel!.y - taskDays!.y)).toBeLessThan(4);
  expect(taskDays!.width).toBeLessThan(140);
  await page.getByLabel("Date limite par défaut d'un brief (jours)").fill("12");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Réglages enregistrés.")).toBeVisible();
  await expectCommonCriteria(page, "/events/parametres/prestataires-par-lien");

  // Relances des prospects : délais et jours en champs courts.
  await page.goto("/parametres/relances");
  await page.waitForLoadState("networkidle");
  expect((await page.getByLabel("Relancer un devis envoyé après (jours)").boundingBox())!.width).toBeLessThan(140);
  await page.getByLabel("Relancer un devis envoyé après (jours)").fill("5");
  await page.getByRole("button", { name: "Enregistrer les délais" }).click();
  await expect(page.getByText("✓ Délais enregistrés.")).toBeVisible();
  await expectCommonCriteria(page, "/parametres/relances");

  // Modèles de budget : un pourcentage par ligne, en champs courts ; le modèle créé est une ligne.
  await page.goto("/events/parametres");
  await page.goto("/budget/parametres");
  await page.waitForLoadState("networkidle");
  expect((await page.getByLabel("Seuil d'alerte, en % de l'enveloppe").boundingBox())!.width).toBeLessThan(140);
  await expectCommonCriteria(page, "/budget/parametres");

  // Listes du jour J : un tableau ; « Modifier » ouvre le modèle dans sa ligne, enregistré à la sortie du champ.
  await page.goto("/events/parametres/listes-jour-j");
  await page.waitForLoadState("networkidle");
  const checklists = page.getByRole("table", { name: "Listes du jour J" });
  const firstRow = checklists.getByRole("row").nth(1);
  const name = (await firstRow.getByRole("rowheader").innerText()).trim();
  await firstRow.getByRole("button", { name: `Modifier « ${name} »` }).click();
  const editor = checklists.getByRole("group", { name: `Modifier « ${name} »` });
  await editor.getByLabel("Nom").fill(`${name} (salle)`);
  await editor.getByLabel("Nom").blur();
  await expect(page.getByText(SAVED)).toBeVisible();
  await expect(checklists.getByRole("rowheader", { name: `${name} (salle)` })).toBeVisible();
  await expectCommonCriteria(page, "/events/parametres/listes-jour-j");

  // Exports comptables : le plan de comptes est un tableau (compte, libellé), une ligne par compte.
  await page.goto("/devis/exports-comptables");
  await page.waitForLoadState("networkidle");
  const accounts = page.getByRole("region", { name: "Comptes du plan" });
  await expect(accounts.getByRole("columnheader")).toHaveText(["Poste", "Compte", "Libellé"]);
  await expect(accounts.getByRole("row")).toHaveCount(6);
  const sales = accounts.getByRole("row", { name: /^Ventes/ });
  const [number, label] = [await sales.getByLabel("Compte Ventes").boundingBox(), await sales.getByLabel("Libellé Ventes").boundingBox()];
  expect(Math.abs(number!.y - label!.y)).toBeLessThan(4);
  await sales.getByLabel("Compte Ventes").fill("706100");
  await page.getByRole("button", { name: "Enregistrer le plan" }).click();
  await expect(page.getByText("Plan enregistré.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Compte Ventes")).toHaveValue("706100");
  expect((await expectCommonCriteria(page, "/devis/exports-comptables")).primary).toEqual(["Enregistrer le plan"]);
});

test("UX-13 / UX-09 / UX-07 — Listes éditables : enregistrement à la sortie du champ, « Annuler la dernière modification » (D1)", async ({ page }) => {
  test.setTimeout(300_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await desktopSize(page);
  const status = page.getByRole("main").getByRole("status");

  // Termes des clients : un tableau, une ligne par type et par langue, plus aucun « Enregistrer ». Lot 74g :
  // le second bloc de « Types d'évènements et termes des clients » (#termes).
  await page.goto("/events/parametres/termes");
  await expect(page).toHaveURL(/\/events\/parametres\/types#termes$/);
  const termsBlock = page.locator("#termes");
  await page.waitForLoadState("networkidle");
  const terms = page.getByRole("table", { name: "Tableau des termes, par type et par langue" });
  await expect(termsBlock.getByRole("button", { name: /^Enregistrer/ })).toHaveCount(0);
  const term = terms.getByLabel("Terme pour Mariage (FR)", { exact: true });
  const before = await term.inputValue();
  await term.fill("les fiancés");
  await term.blur();
  await expect(status.filter({ hasText: SAVED }).first()).toBeVisible();
  await page.reload();
  await expect(term).toHaveValue("les fiancés");
  // « Annuler la dernière modification » rend la valeur d'avant.
  await term.fill("les amoureux");
  await terms.getByLabel("Genre du terme pour Mariage (FR)").focus();
  await expect(status.filter({ hasText: SAVED }).first()).toBeVisible();
  await termsBlock.getByRole("button", { name: UNDO }).click();
  await expect(status.filter({ hasText: "Modification annulée." }).first()).toBeVisible();
  await expect(term).toHaveValue("les fiancés");
  // « Rétablir » revient au terme du type.
  await terms.getByRole("button", { name: "Rétablir le terme par défaut pour Mariage (FR)" }).click();
  await expect(term).toHaveValue(before);
  await expect(terms.getByRole("button", { name: "Rétablir le terme par défaut pour Mariage (FR)" })).toHaveCount(0);
  await expectCommonCriteria(page, "/events/parametres/types#termes");

  // Types d'évènements : le nom et « vos clients sont » s'enregistrent en quittant le champ.
  await page.goto("/events/parametres/types");
  await page.waitForLoadState("networkidle");
  const types = page.getByRole("region", { name: "Tableau des types d'évènements" });
  await types.getByRole("textbox", { name: "Nom du type Séminaire" }).fill("Séminaire d'entreprise");
  await types.getByRole("textbox", { name: "Nom du type Séminaire" }).blur();
  await expect(status.filter({ hasText: SAVED })).toBeVisible();
  await expect(types.getByRole("textbox", { name: "Nom du type Séminaire d'entreprise" })).toBeVisible();
  await types.getByRole("combobox", { name: "Vos clients pour le type Séminaire d'entreprise" }).selectOption("couple");
  await expect(status.filter({ hasText: SAVED })).toBeVisible();
  await page.reload();
  await expect(types.getByRole("combobox", { name: "Vos clients pour le type Séminaire d'entreprise" })).toHaveValue("couple");
  // Un type qui a des évènements ouvre sa ligne : il ne part qu'en confiant ses évènements à un autre.
  await types.getByRole("button", { name: "Supprimer le type Mariage" }).click();
  await expect(types.getByLabel("Les évènements du type Mariage passent au type")).toBeVisible();
  await expect(types.getByRole("button", { name: "Supprimer le type", exact: true })).toBeDisabled();
  await types.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(types.getByLabel("Les évènements du type Mariage passent au type")).toHaveCount(0);
  // Un type sans évènement part d'un geste.
  await types.getByRole("button", { name: "Supprimer le type Séminaire d'entreprise" }).click();
  await expect(types.getByRole("textbox", { name: "Nom du type Séminaire d'entreprise" })).toHaveCount(0);
  await expectCommonCriteria(page, "/events/parametres/types");

  // Étapes du pipeline : monter, descendre (annulable), renommer dans la ligne, retirer.
  await page.goto("/events/parametres/etapes");
  await page.waitForLoadState("networkidle");
  const stages = page.getByRole("table", { name: "Tableau des étapes du pipeline" });
  const [firstStage, secondStage] = await stages.getByRole("rowheader").allInnerTexts();
  await stages.getByRole("button", { name: `Descendre l'étape ${firstStage}` }).click();
  await expect(stages.getByRole("rowheader").first()).toHaveText(secondStage!);
  await page.getByRole("button", { name: UNDO }).click();
  await expect(stages.getByRole("rowheader").first()).toHaveText(firstStage!);
  // « Renommer » ouvre le nom dans sa ligne ; il s'enregistre à la sortie du champ, et la ligne se referme.
  await stages.getByRole("button", { name: `Renommer l'étape ${firstStage}` }).click();
  await expect(stages.getByLabel("Étape 1", { exact: true })).toBeFocused();
  await stages.getByLabel("Étape 1", { exact: true }).fill("Prise de contact");
  await stages.getByLabel("Étape 1", { exact: true }).blur();
  await expect(status.filter({ hasText: SAVED })).toBeVisible();
  await expect(stages.getByRole("rowheader").first()).toHaveText("Prise de contact");
  await expect(stages.getByRole("textbox")).toHaveCount(0);
  await expect(stages.getByRole("button", { name: "Monter l'étape Prise de contact" })).toBeDisabled();
  // Un nom vide est refusé : la barre le dit, rien ne part.
  await stages.getByRole("button", { name: `Renommer l'étape ${secondStage}` }).click();
  await stages.getByLabel("Étape 2", { exact: true }).fill("");
  await stages.getByLabel("Étape 2", { exact: true }).blur();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Étape 2");
  await expect(stages.getByRole("rowheader").nth(1)).toHaveText(secondStage!);
  const stageCount = await stages.getByRole("rowheader").count();
  await stages.getByRole("button", { name: `Retirer l'étape ${secondStage}` }).click();
  await expect(stages.getByRole("rowheader")).toHaveCount(stageCount - 1);
  await page.getByLabel("Nom de l'étape").fill("Visite du lieu");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(stages.getByRole("rowheader")).toHaveCount(stageCount);
  await expectCommonCriteria(page, "/events/parametres/etapes");

  // Types de repas : « Renommer », « Masquer » et « Afficher » en actions de ligne. Lot 74g : le second bloc
  // de « Invités : régimes et repas » (#repas).
  await page.goto("/events/parametres/repas");
  await expect(page).toHaveURL(/\/events\/parametres\/regimes#repas$/);
  const mealsBlock = page.locator("#repas");
  await page.waitForLoadState("networkidle");
  const meals = page.getByRole("table", { name: "Types de repas" });
  await meals.getByRole("button", { name: "Renommer Adulte" }).click();
  await meals.getByLabel("Libellé du type Adulte").fill("Adulte (menu complet)");
  await meals.getByLabel("Libellé du type Adulte").blur();
  await expect(status.filter({ hasText: SAVED })).toBeVisible();
  await expect(meals.getByRole("rowheader", { name: "Adulte (menu complet)" })).toBeVisible();
  await meals.getByRole("button", { name: "Masquer Enfant" }).click();
  await expect(meals.getByRole("button", { name: "Afficher Enfant" })).toBeVisible();
  await expect(meals.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Enfant" }) })).toContainText("Masqué");
  await mealsBlock.getByRole("button", { name: UNDO }).click();
  await expect(meals.getByRole("button", { name: "Masquer Enfant" })).toBeVisible();
  await meals.getByRole("button", { name: "Rétablir le libellé de départ de Adulte (menu complet)" }).click();
  await expect(meals.getByRole("rowheader", { name: "Adulte", exact: true })).toBeVisible();
  await mealsBlock.getByRole("region", { name: "Ajouter un type" }).getByLabel("Libellé").fill("Végétarien");
  await mealsBlock.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(meals.getByRole("rowheader", { name: "Végétarien" })).toBeVisible();
  await expectCommonCriteria(page, "/events/parametres/regimes#repas");

  // Catalogue : un tableau ; « Modifier » ouvre l'article dans sa ligne, une seule à la fois.
  await page.goto("/devis/catalogue");
  await page.waitForLoadState("networkidle");
  const newItem = page.getByRole("form", { name: "Nouvel article" });
  for (const [label, price] of [["Coordination du jour J", "1500"], ["Repérage du lieu", "300"]] as const) {
    await newItem.getByLabel("Intitulé").fill(label);
    await newItem.getByLabel("Unité").fill("forfait");
    await newItem.getByLabel("Prix unitaire HT (€)").fill(price);
    await newItem.getByRole("button", { name: "Ajouter l'article" }).click();
    await expect(page.getByRole("table", { name: "Articles du catalogue" }).getByRole("rowheader", { name: label })).toBeVisible();
  }
  const catalog = page.getByRole("table", { name: "Articles du catalogue" });
  // Le nom de l'article est dans le nom accessible de l'action, pas dans son libellé visible.
  await expect(catalog.getByRole("button", { name: "Modifier « Coordination du jour J »" })).toHaveText("Modifier");
  await expect(catalog.getByRole("button", { name: "Archiver « Coordination du jour J »" })).toHaveText("Archiver");
  await catalog.getByRole("button", { name: "Modifier « Coordination du jour J »" }).click();
  const item = catalog.getByRole("group", { name: "Modifier « Coordination du jour J »" });
  await item.getByLabel("Prix unitaire HT (€)").fill("1800");
  await item.getByLabel("Prix unitaire HT (€)").blur();
  await expect(status.filter({ hasText: SAVED })).toBeVisible();
  await expect(catalog.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Coordination du jour J" }) })).toContainText("1 800,00 €");
  await page.getByRole("button", { name: UNDO }).click();
  await expect(catalog.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Coordination du jour J" }) })).toContainText("1 500,00 €");
  await catalog.getByRole("button", { name: "Modifier « Repérage du lieu »" }).click();
  await expect(catalog.getByRole("group")).toHaveCount(1);
  await expect(catalog.getByRole("group", { name: "Modifier « Repérage du lieu »" })).toBeVisible();
  await catalog.getByRole("button", { name: "Archiver « Repérage du lieu »" }).click();
  await expect(catalog.getByRole("rowheader", { name: "Repérage du lieu" })).toHaveCount(0);
  expect((await expectCommonCriteria(page, "/devis/catalogue")).primary).toEqual(["Ajouter l'article"]);
});

test("UX-13 — Journal d'activité : la colonne « Quoi » à la largeur de son texte", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await desktopSize(page);
  // Quelques gestes journalisés (un réglage enregistré, une rubrique ouverte par la recherche).
  await page.goto("/parametres");
  await openSettingsRubric(page, "Historique des actions");
  await expect(page.getByRole("heading", { level: 1, name: "Journal d'activité" })).toBeVisible();
  const log = page.getByRole("region", { name: "Activité de l'organisation" });
  await expect(log.getByRole("row").nth(1)).toBeVisible();
  if (!isPhone(page)) {
    // Aucun libellé de « Quoi » sur plus de deux lignes en 1440 px (cinq avant le lot).
    const heights = await log.locator("tbody td:nth-child(3)").evaluateAll((cells) =>
      cells.map((cell) => {
        const lineHeight = parseFloat(getComputedStyle(cell).lineHeight);
        const range = document.createRange();
        range.selectNodeContents(cell);
        return Math.round(range.getBoundingClientRect().height / lineHeight);
      }),
    );
    expect(Math.max(...heights)).toBeLessThanOrEqual(2);
  }
  const found = await measure(page);
  expect(found.overflow).toBeLessThanOrEqual(0);
  if (isPhone(page)) expect(found.smallTargets).toEqual([]);
  await expectNoAxeViolation(page);
});
