// Lot 73b (PRE-01, PRE-05, PRE-11, UX-05, UX-07, UX-08, UX-12, UX-15, HUB-14, NFR-02 ; spécification du lot
// 73, § 5.2, critères 1 à 11 ; P3, P13, V1 à V6 ; maquette 18) — le carnet de prestataires, à l'ordinateur
// et en 375 px (projets Playwright), axe-core sur la ligne, la barre de filtres, la barre de sélection et
// l'écran « Classer » ; états vide, rempli et « à classer » ; tests d'abus (paramètres inconnus, export
// d'une fiche d'une autre organisation) ; un carnet de 500 fiches sans menu fermé dans la page.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { vendorDocuments } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "./axe";
import { vendorCatalogInput } from "../lib/vendors/catalog";
import { createVendor, createVendorTag, getVendor, listVendorDocumentKinds, listVendorTypes, requestVendorDocument, seedStarterVendorCatalog } from "../modules/vendors/service";
import { feedback, readyOrganization, signIn } from "./helpers";
import { bookFilters, bookResults, closeBookFilters, isPhone } from "./vendor-book";
import { reportMeasure } from "./mesure";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Critère 11 : aucune commande de l'écran sous 44 px (le lien d'évitement et le bouton « Filtrer » réservé
// aux lecteurs d'écran, communs à l'app, ne sont pas de l'écran).
async function expectMainTouchTargets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main button, main a[href], main select, main input:not([type=hidden])")]
      .filter((element) => !element.closest(".sr-only") && !element.classList.contains("sr-only"))
      .filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.height === 0 || style.visibility === "hidden") return false;
        // Un lien dans une phrase n'est pas une commande isolée.
        if (element.tagName === "A" && style.display === "inline" && (element.parentElement?.textContent ?? "").trim().length > (element.textContent ?? "").trim().length) return false;
        return box.height < 44;
      })
      .map((element) => `${element.tagName} « ${(element.textContent ?? "").trim().slice(0, 30)} » ${Math.round(element.getBoundingClientRect().height)}`),
  );
  expect(small).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Un atelier prêt, ses métiers de départ, sa titulaire.
async function atelier(options: { catalog?: boolean } = {}) {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    const email = `camille-73b-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId, email, password: "mot-de-passe-lot73b-e2e", role: "owner" });
    if (options.catalog !== false) await seedStarterVendorCatalog(organizationId, vendorCatalogInput("fr"), { withTypes: true });
    return { organizationId, email };
  } finally {
    await sql.end();
  }
}

async function typeId(organizationId: string, label: string): Promise<string> {
  const type = (await listVendorTypes(organizationId)).find((candidate) => candidate.label === label);
  if (!type) throw new Error(`métier de départ introuvable : ${label}`);
  return type.id;
}

// Une pièce vérifiée (fichier fictif, jamais lu), posée en base.
async function verified(organizationId: string, vendorId: string, kindId: string, validUntil: string) {
  const { sql, db } = createAppConnection();
  try {
    await withOrganization(db, organizationId, (tx) =>
      tx.insert(vendorDocuments).values({ organizationId, vendorId, kindId, status: "verified", fileName: "piece.pdf", fileKey: `test/${randomUUID()}.pdf`, mime: "application/pdf", sizeBytes: 10, validUntil, uploadedAt: new Date(), verifiedAt: new Date() }),
    );
  } finally {
    await sql.end();
  }
}

// Le carnet rempli : quatre fiches, quatre états de pièces.
async function filledBook() {
  const setup = await atelier();
  const { organizationId } = setup;
  const kinds = await listVendorDocumentKinds(organizationId);
  const insurance = kinds.find((kind) => kind.starterKey === "insurance")!;
  const registration = kinds.find((kind) => kind.starterKey === "registration")!;
  const caterer = await typeId(organizationId, "Traiteur");
  const photographer = await typeId(organizationId, "Photographe");
  const haddad = (await createVendor(organizationId, { name: "Maison Haddad", typeIds: [caterer], contactName: "Karim Haddad", phone: "06 00 00 41 27", email: "karim@maison-haddad.example.org", city: "Lille", rating: 5 })).vendor;
  const studio = (await createVendor(organizationId, { name: "Studio Lumière", typeIds: [photographer], contactName: "Léa Marchand", phone: "06 00 00 27 93", city: "Roubaix", rating: 4 })).vendor;
  const iris = (await createVendor(organizationId, { name: "Iris Beauté", typeIds: [photographer], contactName: "Iris Morel", city: "Lens", rating: 3 })).vendor;
  const papier = (await createVendor(organizationId, { name: "Atelier Papier", typeIds: [caterer], city: "Arras" })).vendor;
  await verified(organizationId, haddad.id, insurance.id, "2026-01-31");
  await requestVendorDocument({ organizationId, vendorId: studio.id, kindId: registration.id });
  await verified(organizationId, iris.id, insurance.id, "2099-12-31");
  await verified(organizationId, iris.id, registration.id, "2099-12-31");
  return { ...setup, haddad, studio, iris, papier };
}

test.describe("PRE-01, PRE-05 — La ligne du carnet (lot 73b, critères 1, 2 et 11)", () => {
  test("une seule cible, le nom, qui ouvre la fiche ; « Ajouter à un mariage… » et le menu ; « Archiver… » seulement au menu, à part", async ({ page }) => {
    const book = await filledBook();
    await signIn(page, book.email, /\/$/);
    await page.goto("/prestataires");
    const row = page.locator(`tr[data-vendor-id="${book.haddad.id}"]`);
    await expect(row.getByRole("link", { name: "Maison Haddad", exact: true })).toBeVisible();
    // Contact, téléphone, métier, ville, mariages faits ensemble, évaluation, pièces.
    await expect(row).toContainText("Traiteur");
    await expect(row).toContainText("Lille");
    if (!isPhone(page)) {
      await expect(row).toContainText("Karim Haddad · 06 00 00 41 27");
      await expect(row).toContainText("Jamais");
      await expect(row).toContainText("5 sur 5");
      // Une seule cible : le nom ; aucun autre lien sur la ligne.
      await expect(row.locator("a:visible")).toHaveCount(1);
      await expect(row.getByRole("button", { name: "Ajouter à un mariage… (Maison Haddad)" })).toBeVisible();
      await expect(row.getByRole("button", { name: /^Archiver/ })).toHaveCount(0);
    } else {
      // Sur téléphone : une carte, le téléphone en lien de 44 px qui appelle.
      const call = row.getByRole("link", { name: "Appeler Maison Haddad au 06 00 00 41 27" });
      await expect(call).toHaveAttribute("href", "tel:06 00 00 41 27");
      expect((await call.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expectNoAxeViolation(page);

    // Le menu « ⋯ » : ouvrir, appeler, écrire, modifier, puis « Archiver… », à part, en dernier.
    await row.getByRole("button", { name: "Autres actions pour Maison Haddad" }).click();
    const menu = page.getByRole("menu", { name: "Autres actions pour Maison Haddad" });
    await expect(menu).toBeVisible();
    const items = menu.getByRole("menuitem");
    const names = (await items.allInnerTexts()).map((text) => text.split("\n")[0]!.trim()).filter(Boolean);
    expect(names.slice(-5)).toEqual(["Ouvrir la fiche", "Appeler", "Écrire", "Modifier", "Archiver…"]);
    await expect(menu.getByRole("menuitem", { name: /^Appeler/ })).toHaveAttribute("href", "tel:06 00 00 41 27");
    await expect(menu.getByRole("menuitem", { name: /^Écrire/ })).toHaveAttribute("href", "mailto:karim@maison-haddad.example.org");
    await expectNoAxeViolation(page);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    // Le nom ouvre la fiche, en un clic (V3 : plus d'aperçu latéral).
    await row.getByRole("link", { name: "Maison Haddad", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/prestataires/${book.haddad.id}$`));
  });

  test("les pièces en mots (P3), lisibles sans la couleur ; le rouge seulement pour l'expiré ; 375 px sans défilement de côté", async ({ page }) => {
    const book = await filledBook();
    await signIn(page, book.email, /\/$/);
    await page.goto("/prestataires");
    const state = (id: string) => page.locator(`tr[data-vendor-id="${id}"] .book-documents`);
    await expect(state(book.haddad.id)).toHaveText(/^!\s*Assurance · à renouveler$/);
    await expect(state(book.studio.id)).toHaveText("Kbis · à recevoir");
    await expect(state(book.iris.id)).toHaveText(/^✓\s*À jour$/);
    await expect(state(book.papier.id)).toHaveText("Aucune pièce demandée");
    const red = await state(book.haddad.id).evaluate((element) => getComputedStyle(element).color);
    for (const other of [book.studio.id, book.iris.id, book.papier.id]) {
      expect(await state(other).evaluate((element) => getComputedStyle(element).color)).not.toBe(red);
    }
    await expectNoHorizontalScroll(page);
    if (isPhone(page)) await expectMainTouchTargets(page);
  });
});

test.describe("UX-12 — Trier par colonne (lot 73b, critère 3)", () => {
  test("chaque en-tête trie, dans les deux sens ; le tri est dit au-dessus ; il est dans l'adresse et revient en arrière", async ({ page }) => {
    test.skip(isPhone(page), "sur téléphone, une carte par fiche, sans en-têtes");
    const book = await filledBook();
    await signIn(page, book.email, /\/$/);
    await page.goto("/prestataires");
    const results = bookResults(page);
    await expect(results.getByRole("heading", { level: 2 })).toHaveText("4 fiches, par nom");
    await expect(page.getByText("Trier par : Nom")).toBeVisible();
    const names = page.locator("tbody .vendor-name-link");
    await expect(names).toHaveText(["Atelier Papier", "Iris Beauté", "Maison Haddad", "Studio Lumière"]);

    await page.getByRole("columnheader", { name: "Évaluation" }).getByRole("link").click();
    await expect(page).toHaveURL(/tri=evaluation/);
    await expect(results.getByRole("heading", { level: 2 })).toHaveText("4 fiches, par évaluation");
    await expect(page.getByRole("columnheader", { name: /Évaluation/ })).toHaveAttribute("aria-sort", "descending");
    await expect(names).toHaveText(["Maison Haddad", "Studio Lumière", "Iris Beauté", "Atelier Papier"]);
    await page.getByRole("columnheader", { name: /Évaluation/ }).getByRole("link").click();
    await expect(page).toHaveURL(/sens=asc/);
    await expect(page.getByText("ordre inverse")).toBeVisible();
    await expect(names).toHaveText(["Iris Beauté", "Studio Lumière", "Maison Haddad", "Atelier Papier"]);

    await page.getByRole("columnheader", { name: "Pièces" }).getByRole("link").click();
    await expect(names.first()).toHaveText("Maison Haddad");
    await page.goBack();
    await expect(page).toHaveURL(/tri=evaluation&sens=asc|sens=asc&tri=evaluation/);
    await expect(names.first()).toHaveText("Iris Beauté");
    await expectNoAxeViolation(page);
  });

  test("abus : un tri, un sens ou un filtre « Pièces » inconnus sont ignorés, sans erreur", async ({ page }) => {
    const book = await filledBook();
    await signIn(page, book.email, /\/$/);
    const response = await page.goto("/prestataires?tri=salaire&sens=sideways&pieces=%3Cscript%3E");
    expect(response!.status()).toBe(200);
    await expect(bookResults(page).getByRole("heading", { level: 2 })).toHaveText("4 fiches, par nom");
  });
});

test.describe("PRE-11, PRE-05 — Les filtres (lot 73b, critères 4, 5 et 6)", () => {
  test("familles puis métiers ; « Pièces à régler » et sa raison ; chaque filtre en pastille qui s'enlève ; « Effacer les filtres » ; N fiches sur M", async ({ page }) => {
    const book = await filledBook();
    await signIn(page, book.email, /\/$/);
    await page.goto("/prestataires");
    const families = page.getByRole("navigation", { name: "Familles de prestataires" });
    await families.getByRole("link", { name: /^Photo et vidéo · 2/ }).click();
    const trades = page.getByRole("navigation", { name: "Types de la famille Photo et vidéo" });
    await expect(trades.getByRole("link", { name: "Tous les métiers · 2" })).toHaveAttribute("aria-current", "true");
    await expect(trades.getByRole("link", { name: "Photographe · 2" })).toBeVisible();
    const results = bookResults(page);
    await expect(results.getByRole("heading", { level: 2 })).toHaveText("2 fiches sur 4, par nom");

    const filters = await bookFilters(page);
    await filters.getByLabel("Pièces").selectOption({ label: "À régler" });
    await expect(page).toHaveURL(/pieces=a-regler/);
    await closeBookFilters(page);
    await expect(results.getByRole("heading", { level: 2 })).toHaveText("1 fiche sur 4, par état des pièces");
    await expect(page.locator(`tr[data-vendor-id="${book.studio.id}"] .book-documents-reason`)).toHaveText(/^demande du \d{1,2} \S+/);
    const chips = page.getByRole("group", { name: "Filtres actifs" });
    await expect(chips.getByRole("link", { name: "Retirer le filtre Photo et vidéo" })).toBeVisible();
    await expect(chips.getByRole("link", { name: "Retirer le filtre Pièces à régler" })).toBeVisible();
    await expectNoAxeViolation(page);

    await chips.getByRole("link", { name: "Retirer le filtre Photo et vidéo" }).click();
    await expect(results.getByRole("heading", { level: 2 })).toHaveText("2 fiches sur 4, par état des pièces");
    // « Pièces à régler » : ce qui presse d'abord.
    await expect(page.locator("tbody .vendor-name-link")).toHaveText(["Maison Haddad", "Studio Lumière"]);
    await chips.getByRole("link", { name: "Effacer les filtres" }).click();
    await expect(results.getByRole("heading", { level: 2 })).toHaveText("4 fiches, par nom");
    await expect(page.getByRole("group", { name: "Filtres actifs" })).toHaveCount(0);
  });

  test("un lieu trie par distance et écrit le trajet ; le rayon n'est actif qu'avec un lieu ; une fiche proche hors du rayon est dite", async ({ page }) => {
    const book = await filledBook();
    await signIn(page, book.email, /\/$/);
    await page.goto("/prestataires");
    let filters = await bookFilters(page);
    await expect(filters.getByLabel("Rayon")).toBeDisabled();
    await filters.getByLabel("Où ?").fill("Lille");
    await filters.getByLabel("Où ?").press("Enter");
    await expect(page).toHaveURL(/autour=Lille/);
    filters = await bookFilters(page);
    await expect(filters.getByLabel("Rayon")).toBeEnabled();
    await filters.getByLabel("Rayon").selectOption({ label: "à 25 km" });
    await expect(page).toHaveURL(/rayon=25/);
    await closeBookFilters(page);
    const results = bookResults(page);
    await expect(results.getByRole("heading", { level: 2 })).toHaveText("2 fiches sur 4, par distance");
    await expect(page.locator("tbody .vendor-name-link")).toHaveText(["Maison Haddad", "Studio Lumière"]);
    await expect(page.locator(`tr[data-vendor-id="${book.studio.id}"]`)).toContainText(/\d+ km · ≈ \d+ min/);
    await expect(page.getByText(/^Iris Beauté \(Lens, \d+ km\) n'apparaît pas : hors du rayon\./)).toBeVisible();
    await page.getByRole("link", { name: "Élargir à 30 km" }).click();
    await expect(results.getByRole("heading", { level: 2 })).toHaveText("3 fiches sur 4, par distance");
    await expectNoAxeViolation(page);
  });
});

test.describe("UX-15, UX-07, HUB-13 — Sélectionner et agir sur plusieurs fiches (lot 73b, critère 7)", () => {
  test("« Ajouter une étiquette… » et « Archiver… » agissent sur les fiches choisies, avec « Annuler » ; l'export de la sélection ne contient qu'elles", async ({ page }) => {
    const book = await filledBook();
    const tag = await createVendorTag(book.organizationId, "Bohème");
    await signIn(page, book.email, /\/$/);
    await page.goto("/prestataires");
    // Hors du mode « Sélectionner », aucune case.
    await expect(page.getByRole("checkbox", { name: "Choisir Maison Haddad" })).toBeHidden();
    await page.getByRole("button", { name: "Sélectionner", exact: true }).click();
    await page.getByRole("checkbox", { name: "Choisir Maison Haddad" }).check();
    await page.getByRole("checkbox", { name: "Choisir Iris Beauté" }).check();
    const bar = page.getByRole("region", { name: "Actions sur les fiches sélectionnées" });
    await expect(bar).toContainText("2 fiches sélectionnées");
    await expectNoAxeViolation(page);

    // L'étiquette, et son « Annuler ».
    await bar.getByRole("button", { name: /Ajouter une étiquette…|Étiquette/ }).click();
    await page.getByRole("dialog", { name: "Ajouter une étiquette à 2 fiches" }).getByRole("button", { name: "Bohème" }).click();
    const tagged = feedback(page).filter({ hasText: "Étiquette ajoutée à 2 fiches." });
    await expect(tagged).toBeVisible();
    expect((await getVendor(book.organizationId, book.haddad.id))!.tagIds).toEqual([tag.id]);
    expect((await getVendor(book.organizationId, book.studio.id))!.tagIds).toEqual([]);
    await tagged.getByRole("button", { name: "Annuler" }).click();
    await expect(feedback(page).filter({ hasText: "2 fiches rétablies." })).toBeVisible();
    expect((await getVendor(book.organizationId, book.haddad.id))!.tagIds).toEqual([]);

    // L'export de la sélection : seulement les fiches choisies, cellules neutralisées.
    await page.getByRole("button", { name: "Sélectionner", exact: true }).click();
    await page.getByRole("checkbox", { name: "Choisir Maison Haddad" }).check();
    await page.getByRole("checkbox", { name: "Choisir Studio Lumière" }).check();
    await bar.getByRole("button", { name: /Exporter…|Exporter/ }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "La sélection en CSV (2 fiches)" }).click()]);
    const csv = await readFile((await download.path())!, "utf-8");
    expect(csv).toContain("Maison Haddad");
    expect(csv).toContain("Studio Lumière");
    expect(csv).not.toContain("Iris Beauté");
    expect(csv).not.toContain("Atelier Papier");

    // « Archiver… » : niveau 2, puis « Annuler » dix secondes.
    await bar.getByRole("button", { name: /Archiver…|Archiver/ }).click();
    const confirm = page.getByRole("dialog", { name: "Archiver 2 fiches ?" });
    await expect(confirm).toContainText("Elles quittent le carnet, pas les mariages où elles sont.");
    await expectNoAxeViolation(page);
    await confirm.getByRole("button", { name: "Garder les fiches" }).click();
    await expect(confirm).toBeHidden();
    await bar.getByRole("button", { name: /Archiver…|Archiver/ }).click();
    await confirm.getByRole("button", { name: "Archiver 2 fiches" }).click();
    const archived = feedback(page).filter({ hasText: "2 fiches archivées." });
    await expect(archived).toBeVisible();
    await expect(bookResults(page).getByRole("heading", { level: 2 })).toHaveText("2 fiches, par nom");
    await archived.getByRole("button", { name: "Annuler" }).click();
    await expect(bookResults(page).getByRole("heading", { level: 2 })).toHaveText("4 fiches, par nom");
  });

  test("abus : l'export d'une sélection qui contient une fiche d'une autre organisation est refusé", async ({ page, baseURL }) => {
    const book = await filledBook();
    const other = await filledBook();
    await signIn(page, book.email, /\/$/);
    const origin = new URL(baseURL!).origin;
    const refused = await page.request.post("/prestataires/export", { headers: { origin }, form: { format: "csv", ids: other.haddad.id } });
    expect(refused.status()).toBe(404);
    const mine = await page.request.post("/prestataires/export", { headers: { origin }, form: { format: "csv", ids: book.haddad.id } });
    expect(mine.status()).toBe(200);
    expect(await mine.text()).toContain("Maison Haddad");
    // Sans en-tête d'origine (formulaire d'un autre site) : refusé.
    expect((await page.request.post("/prestataires/export", { form: { format: "csv", ids: book.haddad.id } })).status()).toBe(403);
  });
});

test.describe("HUB-14, PRE-01 — Un carnet « à classer » et l'écran « Classer » (lot 73b, critères 8 et 9 ; P13)", () => {
  test("la phrase et son bouton plein ; des métiers proposés d'après le nom ; « Fermer sans enregistrer ? » ; « N fiches classées · Revoir » ; la phrase disparaît", async ({ page }) => {
    const setup = await atelier();
    for (const name of ["Belle Époque Traiteur", "Bulles & Cie", "Domaine de la Brousse"]) await createVendor(setup.organizationId, { name, city: "Niort" });
    await signIn(page, setup.email, /\/$/);
    await page.goto("/prestataires");
    await expect(page.getByText("3 fiches n'ont pas encore de métier.")).toBeVisible();
    const classify = page.getByRole("link", { name: "Classer les 3 fiches" });
    await expect(classify).toHaveClass(/button-link-primary/);
    await expect(page.getByRole("link", { name: "Nouveau prestataire" })).not.toHaveClass(/button-link-primary/);
    await expect(page.getByRole("navigation", { name: "Familles de prestataires" }).getByRole("link", { name: /^À classer · 3/ })).toBeVisible();
    await classify.click();

    await expect(page.getByRole("heading", { level: 1, name: "Classer 3 fiches" })).toBeVisible();
    await expect(page.getByText("2 proposées · 1 sans proposition")).toBeVisible();
    const row = (name: string) => page.getByRole("row").filter({ has: page.getByRole("link", { name }) });
    await expect(row("Belle Époque Traiteur").getByLabel("Métier de Belle Époque Traiteur")).toHaveValue(await typeId(setup.organizationId, "Traiteur"));
    await expect(row("Belle Époque Traiteur")).toContainText("Proposé d'après « Traiteur » dans le nom");
    await expect(row("Domaine de la Brousse")).toContainText("Proposé d'après « Domaine » dans le nom");
    await expect(row("Bulles & Cie")).toContainText("Rien dans le nom ni le fichier");
    const bar = page.getByRole("region", { name: "Enregistrer les métiers" });
    await expect(bar).toContainText("2 métiers à enregistrer · 1 fiche restera « À classer » : vous pourrez y revenir.");
    await expectNoAxeViolation(page);

    // « Fermer » avec des choix faits demande « Fermer sans enregistrer ? » ; rien n'est écrit avant.
    await row("Bulles & Cie").getByLabel("Métier de Bulles & Cie").selectOption({ label: "Photographe" });
    await bar.getByRole("button", { name: "Fermer" }).click();
    const close = page.getByRole("dialog", { name: "Fermer sans enregistrer ?" });
    await expect(close).toBeVisible();
    await close.getByRole("button", { name: "Continuer le classement" }).click();
    await row("Bulles & Cie").getByLabel("Métier de Bulles & Cie").selectOption({ label: "Choisir un métier" });

    await bar.getByRole("button", { name: "Enregistrer les 2 métiers" }).click();
    await expect(page).toHaveURL(/\/prestataires$/, { timeout: 15_000 });
    const sorted = feedback(page).filter({ hasText: "2 fiches classées" });
    await expect(sorted).toBeVisible();
    await expect(page.getByText("1 fiche n'a pas encore de métier.")).toBeVisible();

    // « Revoir » rouvre l'écran sur ces deux fiches, avec leur métier enregistré, qui se change.
    await sorted.getByRole("link", { name: "Revoir" }).click();
    await expect(page).toHaveURL(/\/prestataires\/classer\?revoir=[A-Za-z0-9_.-]+$/);
    expect(page.url()).not.toContain("Domaine");
    await expect(page.getByRole("heading", { level: 1, name: "Revoir 2 fiches classées" })).toBeVisible();
    await expect(row("Domaine de la Brousse")).toContainText("Enregistré");
    await row("Domaine de la Brousse").getByLabel("Métier de Domaine de la Brousse").selectOption({ label: "Traiteur" });
    await page.getByRole("region", { name: "Enregistrer les métiers" }).getByRole("button", { name: "Enregistrer le métier" }).click();
    await expect(feedback(page).filter({ hasText: "1 fiche classée" })).toBeVisible();

    // La dernière fiche classée, la phrase disparaît.
    await page.goto("/prestataires/classer");
    await row("Bulles & Cie").getByLabel("Métier de Bulles & Cie").selectOption({ label: "Photographe" });
    await page.getByRole("region", { name: "Enregistrer les métiers" }).getByRole("button", { name: "Enregistrer le métier" }).click();
    await expect(page).toHaveURL(/\/prestataires$/, { timeout: 15_000 });
    await expect(page.getByText(/n'ont? pas encore de métier/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Nouveau prestataire" })).toHaveClass(/button-link-primary/);
  });
});

test.describe("UX-08, PAR-01 — Le carnet vide (lot 73b, critère 10)", () => {
  test("un carnet vide n'a ni filtres ni carte, et propose « Nouveau prestataire » et « Reprendre votre carnet » ; un filtre sans résultat dit « 0 fiche sur N »", async ({ page }) => {
    const setup = await atelier();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/prestataires");
    await expect(page.getByRole("heading", { level: 2, name: "Votre carnet de prestataires" })).toBeVisible();
    await expect(page.getByRole("search", { name: "Filtres du carnet" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: /^Carte/ })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Affichage" })).toHaveCount(0);
    const empty = page.getByRole("region", { name: "Votre carnet de prestataires" });
    await expect(empty.getByRole("link", { name: "Nouveau prestataire" })).toHaveAttribute("href", "/prestataires?nouveau=1");
    await expect(empty.getByRole("link", { name: /^Reprendre votre carnet/ })).toHaveAttribute("href", "/reprise?ligne=vendor_book");
    await expect(empty).toContainText("Vous pourrez aussi en créer un depuis le budget d'un mariage");
    await expectNoAxeViolation(page);
    await expectNoHorizontalScroll(page);

    await createVendor(setup.organizationId, { name: "Atelier Papier", city: "Lille" });
    await createVendor(setup.organizationId, { name: "Iris Beauté", city: "Lens" });
    await page.goto("/prestataires?q=zzzz");
    await expect(page.getByText("0 fiche sur 2 avec ces filtres.")).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Effacer les filtres" }).first()).toBeVisible();
  });
});

test.describe("NFR-02 — Un carnet de 500 fiches (lot 73b)", () => {
  test("la page dit « Les 500 premières », ne monte aucun menu de ligne fermé, et répond sous 300 ms", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "mesure : une fois, sous Chromium à l'ordinateur");
    test.setTimeout(300_000);
    const setup = await atelier();
    const types = await listVendorTypes(setup.organizationId);
    for (let index = 0; index < 510; index += 1) {
      await createVendor(setup.organizationId, { name: `Prestataire ${String(index).padStart(3, "0")}`, typeIds: [types[index % types.length]!.id], city: "Lille", contactName: `Contact ${index}`, phone: "06 00 00 00 00" });
    }
    await signIn(page, setup.email, /\/$/);
    await page.goto("/prestataires");
    await expect(page.getByText("Les 500 premières : affinez avec les filtres.")).toBeVisible();
    await expect(bookResults(page).getByRole("heading", { level: 2 })).toHaveText("500 fiches sur 510, par nom");
    await expect(page.locator("tbody tr")).toHaveCount(500);
    // Un seul bouton « ⋯ » par ligne, et aucun menu de ligne dans la page avant le premier clic.
    await expect(page.locator("[data-row-menu]")).toHaveCount(500);
    await expect(page.locator('[role="menu"]')).toHaveCount(1);
    const html = await (await page.request.get("/prestataires")).text();
    expect((html.match(/role="menu"/g) ?? []).length).toBeLessThanOrEqual(1);

    // Le serveur : la médiane des 95e centiles de trois séries, comme NFR-02 (ADR 0078), seuil inchangé.
    if (testInfo.config.workers !== 1) return;
    const series: number[] = [];
    for (let serie = 0; serie < 3; serie += 1) {
      const times: number[] = [];
      for (let request = 0; request < 10; request += 1) {
        const started = performance.now();
        expect((await page.request.get("/prestataires")).status()).toBe(200);
        times.push(performance.now() - started);
      }
      times.sort((a, b) => a - b);
      series.push(times[Math.ceil(0.95 * times.length) - 1]!);
    }
    series.sort((a, b) => a - b);
    reportMeasure(testInfo, { mesure: "Lot 73b — NFR-02, carnet de 510 fiches (médiane des 95e centiles de 3 séries)", valeur: series[1]!, seuil: 300, detail: `séries : ${series.map(Math.round).join(", ")} ms` });
    expect(series[1]!).toBeLessThan(300);
  });
});
