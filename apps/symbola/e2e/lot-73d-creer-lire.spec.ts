// Lot 73d (PRE-01, PRE-02, PRE-05, PRE-08, PRE-10, UX-10 ; spécification du lot 73, § 5.4, critères 1 à 11 ;
// V10, V11, P3, P4, P9 ; C-46, C-48 ; maquette 20) — créer une fiche (la même fenêtre au carnet et depuis un
// poste), lire une fiche (en-tête court, une action, alertes, « Avec vous », « Pièces »), une fiche neuve
// et « Demander l'assurance et le Kbis », les deux réglages des pièces ; à l'ordinateur et en 375 px
// (projets Playwright), axe-core sur la fenêtre (en erreur comprise) et sur la fiche.
import { randomUUID } from "node:crypto";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "./axe";
import { addDefaultVendorSlots, addEventVendorSlot, addVendorCandidate, createProspect, createProspectSource, listEventVendorSlots, listVendorCandidates, selectVendorCandidate, updateVendorCandidate } from "../modules/events/service";
import { addVendorDocument, createVendor, createVendorType, findVendors, listVendorDocumentKinds } from "../modules/vendors/service";
import { feedback, readyOrganization, signIn } from "./helpers";
import { isPhone } from "./vendor-book";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Une agence, sa titulaire, un mariage à venir (« Traiteur », « Transport »), un traiteur au carnet, retenu
// sur le mariage, dont l'attestation d'assurance a expiré.
async function agency() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Agence ${randomUUID()}`)).id;
    const email = `camille-73d-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-lot73d-e2e", role: "owner" });
    await addDefaultVendorSlots(organizationId, ["Traiteur", "Transport"]);
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Dubois" }], eventDate: "2099-06-12" });
    const slots = await listEventVendorSlots(organizationId, event.id);
    const catererSlot = slots.find((slot) => slot.label === "Traiteur")!;
    const caterer = await createVendorType(organizationId, "Traiteur", "#8a5a00");
    const haddad = (await createVendor(organizationId, { name: "Maison Haddad", typeIds: [caterer.id], primaryTypeId: caterer.id, city: "Poitiers", contactName: "Karim Haddad", phone: "06 00 00 41 27", email: "contact@maison-haddad.example" })).vendor;
    const candidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: catererSlot.id, vendorName: haddad.name, vendorId: haddad.id });
    await updateVendorCandidate({ organizationId, candidateId: candidate.id, quoteAmountCents: 960000 });
    await selectVendorCandidate({ organizationId, candidateId: candidate.id, changedByUserId: owner.id });
    const insurance = (await listVendorDocumentKinds(organizationId)).find((kind) => kind.starterKey === "insurance")!;
    await addVendorDocument({ organizationId, vendorId: haddad.id, kindId: insurance.id, fileName: "assurance-2026.pdf", content: PDF, validUntil: "2026-10-31", userId: owner.id });
    return { organizationId, email, eventId: event.id, catererSlot, caterer, haddad };
  } finally {
    await sql.end();
  }
}

test.describe("PRE-01 — Une seule fenêtre de création, au carnet (lot 73d, critères 1 à 5 et 9 à 10)", () => {
  test("six champs dans l'ordre, erreurs sous le champ sans bulle, nom proche signalé ; la fiche neuve s'ouvre et dit quoi faire", async ({ page }) => {
    const setup = await agency();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/prestataires");
    await page.getByRole("link", { name: "Nouveau prestataire" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Nouveau prestataire" });
    await expect(dialog).toBeVisible();
    // Critère 1 : les six champs, dans l'ordre de l'usage.
    const labels = await dialog.locator(".vendor-create-main > label").evaluateAll((elements) => elements.map((element) => (element.firstChild?.textContent ?? element.textContent ?? "").trim()));
    expect(labels.map((label) => label.replace(/\s*\*$/, ""))).toEqual(["Nom", "Métier", "Contact", "Téléphone", "E-mail", "Ville"]);
    await expect(dialog.locator(".required-legend")).toHaveText("* obligatoire");
    await expect(dialog.getByRole("combobox", { name: /^Métier/ }).locator("option").last()).toHaveText("À classer");

    // Critère 3 : envoyée vide, aucune bulle du navigateur ; le message de Symbola sous chaque champ ; la
    // saisie reste.
    await dialog.getByLabel("Contact").fill("Lucie Faure");
    await dialog.getByRole("button", { name: "Créer la fiche" }).click();
    await expect(dialog.getByText("Donnez le nom du prestataire, par exemple « Maison Haddad ».")).toBeVisible();
    await expect(dialog.getByText("Choisissez son métier, ou « À classer » si vous ne le savez pas encore.")).toBeVisible();
    expect(await dialog.locator("form").evaluate((form) => (form as HTMLFormElement).noValidate)).toBe(true);
    await expect(dialog.getByLabel("Contact")).toHaveValue("Lucie Faure");
    await expect(dialog.getByRole("textbox", { name: /^Nom/ })).toBeFocused();
    await expectNoAxeViolation(page);

    // Critère 4 : un nom proche d'une fiche du carnet, signalé sous le champ, avec un lien ; la création reste possible.
    await dialog.getByRole("textbox", { name: /^Nom/ }).fill("Maison Hadad");
    await expect(dialog.getByText("Une fiche « Maison Haddad » existe à Poitiers.")).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole("link", { name: /La voir/ })).toHaveAttribute("href", `/prestataires/${setup.haddad.id}`);
    await dialog.getByRole("textbox", { name: /^Nom/ }).fill("Douceurs Montées");

    // Critère 2 : « Plus de détails » ouvre en place ce que portaient les rubriques d'avant.
    await dialog.getByText(/^Plus de détails/).click();
    await expect(dialog.getByLabel("N° SIRET")).toBeVisible();
    await expect(dialog.getByText("14 chiffres, sur ses devis et factures")).toBeVisible();
    for (const label of ["Rue", "Code postal", "Site web", "Instagram", "Tarifs indicatifs", "Note interne"]) await expect(dialog.getByLabel(label, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Évaluation" })).toBeVisible();
    if (isPhone(page)) {
      expect((await dialog.boundingBox())!.width).toBeGreaterThanOrEqual(370);
      await expectNoHorizontalScroll(page);
    }

    // Critère 5 : « À classer » choisi exprès est accepté ; après « Créer la fiche », la fiche s'ouvre.
    await dialog.getByRole("combobox", { name: /^Métier/ }).selectOption({ label: "À classer" });
    await dialog.getByLabel("Ville").fill("Poitiers");
    await dialog.getByRole("button", { name: "Créer la fiche" }).click();
    await expect(page).toHaveURL(/\/prestataires\/[0-9a-f-]{36}(\?placement=[a-z_]+)?$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Douceurs Montées" })).toBeVisible();

    // Critère 9 : la fiche neuve n'a aucun « — » ; chaque valeur absente dit pourquoi ou quoi faire.
    const main = page.locator("main.vendor-sheet");
    await expect(main).toContainText("À classer · Poitiers · aucun mariage avec vous");
    await expect(main).toContainText("Pas encore de mariage ensemble. « Ajouter à un mariage… » le met en comparaison ou le retient sur un poste.");
    await expect(main).toContainText("E-mail non renseigné");
    await expect(main).toContainText("pas encore notée : elle se donne après un mariage");
    await expect(main).toContainText("non renseignée : la carte et les trajets en ont besoin");
    expect(await main.innerText()).not.toContain("—");
    await expectNoAxeViolation(page);

    // Critère 10 : « Demander Assurance et Kbis » ; la demande paraît pour le prestataire ; « Annuler » la retire.
    await expect(main).toContainText("Aucune pièce demandée. Votre agence demande d'habitude : Assurance et Kbis.");
    await expect(main).toContainText("La demande l'attendra sur son lien, dès qu'il en aura un.");
    await main.getByRole("button", { name: "Demander Assurance et Kbis" }).click();
    const message = feedback(page).filter({ hasText: "2 pièces demandées à Douceurs Montées" });
    await expect(message).toBeVisible();
    await expect(main).toContainText("à recevoir");
    const created = (await findVendors({ organizationId: setup.organizationId, text: "Douceurs" }))[0]!;
    expect(created.typeIds).toEqual([]);
    await message.getByRole("button", { name: "Annuler" }).click();
    await expect(feedback(page).filter({ hasText: "Demande retirée." })).toBeVisible();
    await expect(main.getByRole("button", { name: "Demander Assurance et Kbis" })).toBeVisible();
  });
});

test.describe("PRE-02 — La même fenêtre depuis un poste (lot 73d, critères 1 et 5)", () => {
  test("le métier proposé d'après le poste, « Comment l'ajouter ? » sans réponse, « Créer et ajouter » retient la fiche sur le poste", async ({ page }) => {
    const setup = await agency();
    await signIn(page, setup.email, /\/$/);
    await page.goto(`/events/${setup.eventId}?onglet=budget`);
    const table = page.getByRole("region", { name: "Budget et prestataires, par poste" });
    const transport = table.getByRole("row").filter({ hasText: "Transport" }).first();
    await transport.getByRole("button", { name: /\+ Ajouter des prestataires/ }).click();
    const panel = page.getByRole("group", { name: "Ajouter un prestataire à « Transport »" });
    await panel.getByRole("searchbox").fill("Les Calèches du Lac");
    await panel.getByRole("button", { name: "+ Nouveau prestataire « Les Calèches du Lac »" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouveau prestataire" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Pour le poste « Transport » de Léa & Maxime")).toBeVisible();
    // La recherche qui n'a rien trouvé préremplit le nom, et seulement le nom.
    await expect(dialog.getByRole("textbox", { name: /^Nom/ })).toHaveValue("Les Calèches du Lac");
    await expect(dialog.getByLabel("Ville")).toHaveValue("");
    await expect(dialog.getByRole("radio", { name: /^En comparaison/ })).not.toBeChecked();
    await expect(dialog.getByRole("radio", { name: /^Retenu/ })).not.toBeChecked();
    await expect(dialog.locator(".required-legend")).toHaveText("* obligatoire · la fiche rejoint aussi le carnet");
    await dialog.getByRole("combobox", { name: /^Métier/ }).selectOption({ label: "À classer" });
    await dialog.getByRole("button", { name: "Créer et ajouter" }).click();
    await expect(dialog.getByText("Choisissez comment l'ajouter au poste : en comparaison, ou retenu.")).toBeVisible();
    await expectNoAxeViolation(page);
    expect((await listVendorCandidates(setup.organizationId, setup.eventId)).map((candidate) => candidate.vendorName)).toEqual(["Maison Haddad"]);

    await dialog.getByRole("radio", { name: /^Retenu/ }).check();
    await dialog.getByRole("button", { name: "Créer et ajouter" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(feedback(page).filter({ hasText: "Retenu sur « Transport »." })).toBeVisible();
    const candidates = await listVendorCandidates(setup.organizationId, setup.eventId);
    expect(candidates.find((candidate) => candidate.vendorName === "Les Calèches du Lac")?.status).toBe("retained");
    expect((await findVendors({ organizationId: setup.organizationId, text: "Calèches" })).map((vendor) => vendor.name)).toEqual(["Les Calèches du Lac"]);
  });

  test("depuis le poste « Photographe », le métier « Photographe » est proposé", async ({ page }) => {
    const setup = await agency();
    const photographer = await createVendorType(setup.organizationId, "Photographe", "#0369a1");
    await addEventVendorSlot(setup.organizationId, setup.eventId, "Photographe");
    await signIn(page, setup.email, /\/$/);
    await page.goto(`/events/${setup.eventId}?onglet=budget`);
    const table = page.getByRole("region", { name: "Budget et prestataires, par poste" });
    await table.getByRole("row").filter({ hasText: "Photographe" }).first().getByRole("button", { name: /\+ Ajouter des prestataires/ }).click();
    await page.getByRole("group", { name: "Ajouter un prestataire à « Photographe »" }).getByRole("button", { name: /^\+ Nouveau prestataire/ }).click();
    const dialog = page.getByRole("dialog", { name: "Nouveau prestataire" });
    await expect(dialog.getByRole("combobox", { name: /^Métier/ })).toHaveValue(photographer.id);
    await expect(dialog.getByText(/Proposé d'après le poste « Photographe »\./)).toBeVisible();
  });
});

test.describe("PRE-01, PRE-05, PRE-08 — Lire une fiche (lot 73d, critères 6 à 8 et 11)", () => {
  test("un clic depuis le carnet ; l'en-tête court, une seule action pleine ; l'alerte de la pièce ; « Avec vous » et son montant", async ({ page }) => {
    const setup = await agency();
    if (!isPhone(page)) await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, setup.email, /\/$/);
    await page.goto("/prestataires");
    await page.locator(`tr[data-vendor-id="${setup.haddad.id}"]`).getByRole("link", { name: "Maison Haddad" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/prestataires/${setup.haddad.id}$`));

    const head = page.locator(".vendor-sheet-head");
    await expect(head.getByRole("button", { name: "Ajouter à un mariage…" })).toBeVisible();
    await expect(head).toContainText("Traiteur · Poitiers · 1 mariage avec vous");
    await expect(head.getByRole("link", { name: "06 00 00 41 27" })).toHaveAttribute("href", "tel:06 00 00 41 27");
    await expect(head.getByRole("link", { name: "contact@maison-haddad.example" })).toHaveAttribute("href", "mailto:contact@maison-haddad.example");
    if (!isPhone(page)) expect((await head.boundingBox())!.height).toBeLessThanOrEqual(200);
    // Critère 6 : un seul bouton plein dans l'en-tête, et sur la fiche.
    const filled = async (scope: string) =>
      page.locator(scope).evaluate((root) => {
        const primary = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
        const probe = document.createElement("span");
        probe.style.color = primary;
        document.body.append(probe);
        const rgb = getComputedStyle(probe).color;
        probe.remove();
        return [...root.querySelectorAll<HTMLElement>("button, a")].filter((element) => !element.closest("dialog:not([open])") && element.checkVisibility() && getComputedStyle(element).backgroundColor === rgb).map((element) => element.textContent?.trim());
      });
    expect(await filled(".vendor-sheet-head")).toEqual(["Ajouter à un mariage…"]);
    expect(await filled("main.vendor-sheet")).toEqual(["Ajouter à un mariage…"]);

    // Critère 7 : la pièce à renouveler monte sous l'en-tête (P3), avec « Demander au prestataire » ; sans lien,
    // la fenêtre le dit.
    const alerts = page.getByRole("list", { name: "À régler sur cette fiche" });
    await expect(alerts).toContainText("Attestation d'assurance responsabilité civile · à renouveler : fin de validité le 31 octobre 2026.");
    await expect(alerts).toContainText("Maison Haddad est retenu sur 1 mariage à venir.");
    const request = page.getByRole("dialog", { name: "Demander une pièce à Maison Haddad" });
    // Le bouton répond une fois la page prête.
    await expect(async () => {
      await alerts.getByRole("button", { name: "Demander au prestataire" }).click();
      await expect(request).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expect(request.getByText("La demande l'attendra sur son lien, dès qu'il en aura un.")).toBeVisible();
    await expect(request.getByLabel("Pièce")).toHaveValue((await listVendorDocumentKinds(setup.organizationId)).find((kind) => kind.starterKey === "insurance")!.id);
    await request.getByRole("button", { name: "Demander", exact: true }).click();
    await expect(feedback(page).filter({ hasText: "Demande déposée : Attestation d'assurance responsabilité civile" })).toBeVisible({ timeout: 20_000 });

    // Critère 8 : « Avec vous », un mariage par ligne, un seul montant (P9).
    const withYou = page.getByRole("region", { name: "Les mariages avec Maison Haddad" });
    const row = withYou.getByRole("row").filter({ hasText: "Léa & Maxime" });
    await expect(row).toContainText("Retenu, contrat non signé");
    await expect(row).toContainText("9 600,00 €");
    await expect(row).toContainText("après le jour J");
    await expect(row.getByRole("link", { name: "Léa & Maxime" })).toHaveAttribute("href", `/events/${setup.eventId}?onglet=budget&poste=${setup.catererSlot.id}`);
    await expect(page.getByText("Montant : ce qui est engagé sur le poste, ou le prix final une fois soldé.")).toBeVisible();
    await expect(page.locator("main.vendor-sheet")).not.toContainText("Prix final");

    // Critère 11 : les fonctions d'avant restent (note interne, fichiers, IBAN, point sur la carte, menu).
    for (const name of ["Caractéristiques", "Paiement et fichiers", "Note interne", "Point sur la carte"]) await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Autres actions pour Maison Haddad" }).click();
    const menu = page.getByRole("menu", { name: "Autres actions pour Maison Haddad" });
    await expect(menu.getByRole("menuitem", { name: "Modifier" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /^Archiver…/ })).toBeVisible();
    await menu.getByRole("menuitem", { name: "Modifier" }).click();
    const edit = page.getByRole("dialog", { name: "Modifier « Maison Haddad »" });
    await expect(edit.getByRole("checkbox", { name: "Traiteur" })).toBeChecked();
    await expect(edit.getByLabel("N° SIRET")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(edit).toBeHidden({ timeout: 20_000 });
    await expectNoAxeViolation(page);
    if (isPhone(page)) await expectNoHorizontalScroll(page);
  });
});

test.describe("PRE-05 — Les deux réglages des pièces (lot 73d ; P3, P4)", () => {
  test("le nom court et « Demandée d'habitude » s'enregistrent seuls, et la fiche neuve les suit", async ({ page }) => {
    const setup = await agency();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/prestataires/parametres/pieces");
    const kbis = page.getByRole("form", { name: "Réglages de « Extrait Kbis ou avis de situation Insee »" });
    await expect(kbis.getByLabel("Nom court")).toHaveValue("Kbis");
    await expect(kbis.getByLabel("Demandée d'habitude")).toBeChecked();
    await kbis.getByLabel("Demandée d'habitude").uncheck();
    await kbis.getByRole("button", { name: "Enregistrer « Kbis »" }).click();
    await expect(kbis.getByText("Enregistré")).toBeVisible();
    const fresh = (await createVendor(setup.organizationId, { name: "Studio Lumière" })).vendor;
    await page.goto(`/prestataires/${fresh.id}`);
    await expect(page.locator("main.vendor-sheet")).toContainText("Votre agence demande d'habitude : Assurance.");
    await expect(page.getByRole("button", { name: "Demander Assurance" })).toBeVisible();
  });
});
