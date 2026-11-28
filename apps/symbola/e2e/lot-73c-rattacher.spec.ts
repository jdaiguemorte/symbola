// Lot 73c (PRE-02, BUD-01, UX-07, UX-14 ; spécification du lot 73, § 5.3, critères 1 à 9 ; P12, P-14 ;
// maquette 19) — « Ajouter à un mariage… » depuis le carnet (ligne, menu du téléphone, sélection, fiche) et
// depuis le mariage (le panneau du poste, puis le carnet ouvert depuis un poste), à l'ordinateur et en
// 375 px (projets Playwright), axe-core sur la fenêtre et le panneau ; aucun nom coupé mot par mot à 1 280
// et 1 366 px.
import { randomUUID } from "node:crypto";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "./axe";
import { addDefaultVendorSlots, addVendorCandidate, createProspect, createProspectSource, listEventVendorSlots, listVendorCandidates, selectVendorCandidate } from "../modules/events/service";
import { createVendor, createVendorType } from "../modules/vendors/service";
import { feedback, readyOrganization, signIn } from "./helpers";
import { isPhone } from "./vendor-book";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Critère 9 : aucune commande sous 44 px dans la fenêtre ou le panneau (une case d'option a pour cible son
// libellé entier).
async function expectTouchTargets(scope: Locator) {
  const small = await scope.evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("button, a[href], select, input:not([type=hidden]):not([type=radio]), label:has(input[type=radio])")]
      .filter((element) => !element.closest(".sr-only") && !element.classList.contains("sr-only"))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden" && box.height < 44;
      })
      .map((element) => `${element.tagName} « ${(element.textContent ?? "").trim().slice(0, 30)} » ${Math.round(element.getBoundingClientRect().height)}`),
  );
  expect(small).toEqual([]);
}

// Une agence, sa titulaire, un mariage à venir (« Traiteur », « Fleurs et décoration »), un fleuriste et
// deux traiteurs au carnet.
async function agency() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Agence ${randomUUID()}`)).id;
    const email = `camille-73c-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-lot73c-e2e", role: "owner" });
    await addDefaultVendorSlots(organizationId, ["Traiteur", "Fleurs et décoration"]);
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Dubois" }], eventDate: "2099-06-12" });
    const slots = await listEventVendorSlots(organizationId, event.id);
    const florist = await createVendorType(organizationId, "Fleuriste", "#2f6f5e");
    const caterer = await createVendorType(organizationId, "Traiteur", "#8a5a00");
    const fleurs = (await createVendor(organizationId, { name: "Les Fleurs du Causse", typeIds: [florist.id], primaryTypeId: florist.id, city: "Millau" })).vendor;
    const haddad = (await createVendor(organizationId, { name: "Maison Haddad", typeIds: [caterer.id], primaryTypeId: caterer.id, city: "Lille" })).vendor;
    const epoque = (await createVendor(organizationId, { name: "Belle Époque Traiteur", typeIds: [caterer.id], primaryTypeId: caterer.id, city: "Arras" })).vendor;
    return {
      organizationId,
      userId: owner.id,
      email,
      eventId: event.id,
      catererSlot: slots.find((slot) => slot.label === "Traiteur")!,
      flowersSlot: slots.find((slot) => slot.label === "Fleurs et décoration")!,
      fleurs,
      haddad,
      epoque,
    };
  } finally {
    await sql.end();
  }
}

async function onSlot(setup: { organizationId: string; eventId: string }, slotId: string) {
  return (await listVendorCandidates(setup.organizationId, setup.eventId)).filter((candidate) => candidate.vendorSlotId === slotId).map((candidate) => [candidate.vendorName, candidate.status]);
}

// « Ajouter à un mariage… » d'une ligne : le bouton de la ligne à l'ordinateur, le menu « ⋯ » sur téléphone.
async function openFromRow(page: Page, vendorId: string, name: string) {
  const row = page.locator(`tr[data-vendor-id="${vendorId}"]`);
  if (isPhone(page)) {
    await row.getByRole("button", { name: `Autres actions pour ${name}` }).click();
    await page.getByRole("menu", { name: `Autres actions pour ${name}` }).getByRole("menuitem", { name: /^Ajouter à (un mariage|ce poste)…/ }).click();
  } else {
    await row.getByRole("button", { name: new RegExp(`^Ajouter (à un mariage… \\(${name}\\)|« ${name} » au poste)`) }).click();
  }
}

test.describe("PRE-02 — « Ajouter à un mariage… » depuis le carnet (lot 73c, critères 1 à 6 et 9)", () => {
  test("la fenêtre : rien de coché, « Choisissez comment l'ajouter. », poste proposé d'après le métier ; en comparaison ; le message dit où, « Annuler » défait", async ({ page }) => {
    const setup = await agency();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/prestataires");
    await openFromRow(page, setup.fleurs.id, "Les Fleurs du Causse");
    const dialog = page.getByRole("dialog", { name: "Ajouter « Les Fleurs du Causse » à un mariage" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Mariage")).toHaveValue(setup.eventId);
    await expect(dialog.getByText("Les évènements à venir, demandes comprises ; le plus proche d'abord.")).toBeVisible();
    await expect(dialog.getByLabel("Poste du budget")).toHaveValue(setup.flowersSlot.id);
    await expect(dialog.getByText("Proposé d'après le métier « Fleuriste ». Autre choix : un autre poste, ou « Nouveau poste ».")).toBeVisible();
    await expect(dialog.getByRole("radio", { name: /^En comparaison/ })).not.toBeChecked();
    await expect(dialog.getByRole("radio", { name: /^Retenu/ })).not.toBeChecked();
    await expect(dialog).not.toContainText("engag");
    await expectNoAxeViolation(page);
    if (isPhone(page)) {
      // En page entière, sans défilement de côté ni commande sous 44 px.
      const box = (await dialog.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(370);
      await expectNoHorizontalScroll(page);
      await expectTouchTargets(dialog);
    }

    // Critère 1 : sans réponse, rien n'est envoyé.
    await dialog.getByRole("button", { name: "Ajouter au mariage" }).click();
    await expect(dialog.getByText("Choisissez comment l'ajouter.")).toBeVisible();
    expect(await onSlot(setup, setup.flowersSlot.id)).toEqual([]);

    await dialog.getByRole("radio", { name: /^En comparaison/ }).check();
    await dialog.getByRole("button", { name: "Ajouter au mariage" }).click();
    await expect(dialog).toBeHidden();
    const message = feedback(page).filter({ hasText: "Ajouté à « Fleurs et décoration », en comparaison." });
    await expect(message).toContainText("Les Fleurs du Causse · Léa & Maxime · 1 en comparaison");
    await expect(message.getByRole("link", { name: "Ouvrir le poste" })).toHaveAttribute("href", `/events/${setup.eventId}?onglet=budget&poste=${setup.flowersSlot.id}`);
    expect(await onSlot(setup, setup.flowersSlot.id)).toEqual([["Les Fleurs du Causse", "shortlisted"]]);
    await message.getByRole("button", { name: "Annuler" }).click();
    await expect(feedback(page).filter({ hasText: "Ajout annulé" })).toBeVisible();
    expect(await onSlot(setup, setup.flowersSlot.id)).toEqual([]);
  });

  test("« Retenu » sur un poste pourvu (P12) : « Remplacer {nom} » d'abord, « Retenir aussi » ensuite ; le remplacé repasse en comparaison", async ({ page }) => {
    const setup = await agency();
    const retained = await addVendorCandidate({ organizationId: setup.organizationId, eventId: setup.eventId, vendorSlotId: setup.catererSlot.id, vendorName: setup.haddad.name, vendorId: setup.haddad.id });
    await selectVendorCandidate({ organizationId: setup.organizationId, candidateId: retained.id, changedByUserId: setup.userId });
    await signIn(page, setup.email, /\/$/);
    await page.goto("/prestataires");
    await openFromRow(page, setup.epoque.id, "Belle Époque Traiteur");
    const dialog = page.getByRole("dialog", { name: "Ajouter « Belle Époque Traiteur » à un mariage" });
    await expect(dialog.getByLabel("Poste du budget")).toHaveValue(setup.catererSlot.id);
    await dialog.getByRole("radio", { name: /^Retenu/ }).check();
    await expect(dialog.getByRole("button", { name: "Ajouter au mariage" })).toHaveCount(0);
    const replace = dialog.getByRole("button", { name: "Remplacer Maison Haddad" });
    const also = dialog.getByRole("button", { name: "Retenir aussi" });
    await expect(replace).toHaveClass(/button-primary/);
    await expect(also).toHaveClass(/button-secondary/);
    // « Remplacer » vient avant « Retenir aussi » dans l'ordre de lecture.
    const order = await dialog.locator("button").evaluateAll((buttons) => buttons.map((button) => button.textContent?.trim()));
    expect(order.indexOf("Remplacer Maison Haddad")).toBeLessThan(order.indexOf("Retenir aussi"));
    await expect(dialog.getByText("Maison Haddad repasse en comparaison.")).toBeVisible();
    await expect(dialog.getByText("Les deux seront retenus sur ce poste.")).toBeVisible();
    await expectNoAxeViolation(page);
    await replace.click();
    await expect(feedback(page).filter({ hasText: "Retenu sur « Traiteur »." })).toContainText("Maison Haddad repasse en comparaison");
    expect(await onSlot(setup, setup.catererSlot.id)).toEqual([
      ["Maison Haddad", "shortlisted"],
      ["Belle Époque Traiteur", "retained"],
    ]);
  });

  test("la sélection : plusieurs fiches vont en comparaison, « Retenu » n'est pas proposé ; la fiche ouvre la même fenêtre", async ({ page }) => {
    const setup = await agency();
    await signIn(page, setup.email, /\/$/);
    await page.goto("/prestataires");
    await page.getByRole("button", { name: "Sélectionner" }).click();
    for (const name of ["Maison Haddad", "Belle Époque Traiteur"]) await page.getByRole("checkbox", { name: new RegExp(name) }).check();
    const bulk = page.getByRole("region", { name: "Actions sur les fiches sélectionnées" });
    // « Ajouter à un mariage… » (sur téléphone, « Mariage ») : le premier geste de la barre.
    await bulk.getByRole("button").first().click();
    const dialog = page.getByRole("dialog", { name: "Ajouter 2 fiches à un mariage" });
    await expect(dialog.getByRole("radio", { name: /^En comparaison/ })).toBeChecked();
    await expect(dialog.getByRole("radio", { name: /^Retenu/ })).toHaveCount(0);
    await expect(dialog.getByText("2 fiches : elles vont toutes en comparaison sur ce poste.")).toBeVisible();
    // Plusieurs fiches : aucun poste proposé d'avance.
    await dialog.getByLabel("Poste du budget").selectOption(setup.catererSlot.id);
    await dialog.getByRole("button", { name: "Ajouter au mariage" }).click();
    await expect(feedback(page).filter({ hasText: "Ajouté à « Traiteur », en comparaison." })).toContainText("2 fiches · Léa & Maxime · 2 en comparaison");
    expect(await onSlot(setup, setup.catererSlot.id)).toEqual([
      ["Maison Haddad", "shortlisted"],
      ["Belle Époque Traiteur", "shortlisted"],
    ]);

    await page.goto(`/prestataires/${setup.fleurs.id}`);
    await page.getByRole("button", { name: "Ajouter à un mariage…" }).click();
    await expect(page.getByRole("dialog", { name: "Ajouter « Les Fleurs du Causse » à un mariage" })).toBeVisible();
  });
});

test.describe("PRE-02 — Depuis le mariage : le panneau du poste, puis le carnet (lot 73c, critères 7 à 9)", () => {
  test("le panneau : le métier d'abord avec ses pièces, la phrase des deux boutons, « Dans la comparaison », recherche vide à chaque ouverture ; « Annuler »", async ({ page }) => {
    const setup = await agency();
    await signIn(page, setup.email, /\/$/);
    await page.goto(`/events/${setup.eventId}?onglet=budget`);
    const table = page.getByRole("region", { name: "Budget et prestataires, par poste" });
    const flowers = table.getByRole("row").filter({ hasText: "Fleurs et décoration" }).first();
    await flowers.getByRole("button", { name: /\+ Ajouter des prestataires/ }).click();
    const panel = page.getByRole("group", { name: "Ajouter un prestataire à « Fleurs et décoration »" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Mettre en comparaison : le poste reste à pourvoir. Retenir : il pourvoit le poste.")).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Fleuriste du carnet · 1" })).toBeVisible();
    const row = panel.getByRole("listitem").filter({ hasText: "Les Fleurs du Causse" });
    await expect(row).toContainText("Fleuriste · Millau");
    await expect(row).toContainText("Aucune pièce demandée");
    await expect(panel.getByRole("link", { name: "Chercher dans tout le carnet (3 fiches)" })).toBeVisible();
    await expectNoAxeViolation(page);
    if (isPhone(page)) {
      const box = (await panel.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(370);
      await expect(panel.getByRole("button", { name: "← Budget" })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectTouchTargets(panel);
    } else {
      expect((await panel.boundingBox())!.width).toBeGreaterThanOrEqual(690);
    }

    await panel.getByRole("searchbox").fill("Haddad");
    await expect(panel.getByRole("listitem").filter({ hasText: "Maison Haddad" })).toBeVisible();
    await panel.getByRole("searchbox").fill("");
    await row.getByRole("button", { name: "Mettre en comparaison — Les Fleurs du Causse" }).click();
    const message = feedback(page).filter({ hasText: "Ajouté à « Fleurs et décoration », en comparaison." });
    await expect(message).toBeVisible();
    // Le panneau reste ouvert ; la fiche dit « Dans la comparaison » au lieu de ses boutons.
    await expect(row).toContainText("Dans la comparaison");
    await expect(row.getByRole("button", { name: "Mettre en comparaison — Les Fleurs du Causse" })).toHaveCount(0);
    expect(await onSlot(setup, setup.flowersSlot.id)).toEqual([["Les Fleurs du Causse", "shortlisted"]]);
    await message.getByRole("button", { name: "Annuler" }).click();
    await expect(feedback(page).filter({ hasText: "Ajout annulé" })).toBeVisible();
    expect(await onSlot(setup, setup.flowersSlot.id)).toEqual([]);

    // Fermé puis rouvert : la recherche est vide.
    if (isPhone(page)) await panel.getByRole("button", { name: "← Budget" }).click();
    else await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await flowers.getByRole("button", { name: /\+ Ajouter des prestataires/ }).click();
    await expect(panel.getByRole("searchbox")).toHaveValue("");
  });

  test("« Chercher dans tout le carnet » : filtré par le métier du poste, filtre nommé qui s'enlève, aucun lieu ; « Ajouter à ce poste… » ; « Dans la comparaison »", async ({ page }) => {
    const setup = await agency();
    await addVendorCandidate({ organizationId: setup.organizationId, eventId: setup.eventId, vendorSlotId: setup.catererSlot.id, vendorName: setup.haddad.name, vendorId: setup.haddad.id });
    await signIn(page, setup.email, /\/$/);
    await page.goto(`/events/${setup.eventId}?onglet=budget`);
    const table = page.getByRole("region", { name: "Budget et prestataires, par poste" });
    await table.getByRole("row").filter({ hasText: "Traiteur" }).first().getByRole("button", { name: /\+ Ajouter (des|d'autres) prestataires|Ajouter/ }).first().click();
    await page.getByRole("group", { name: "Ajouter un prestataire à « Traiteur »" }).getByRole("link", { name: /Chercher dans tout le carnet/ }).click();
    await expect(page).toHaveURL(/\/prestataires\?/);
    expect(new URL(page.url()).searchParams.get("autour")).toBeNull();
    await expect(page.getByText("Pour le poste « Traiteur » de Léa & Maxime · choisissez un prestataire, ou plusieurs.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Revenir au mariage" })).toHaveAttribute("href", `/events/${setup.eventId}?onglet=budget&poste=${setup.catererSlot.id}`);
    // Un filtre nommé, le métier du poste, qui s'enlève ; seuls les traiteurs.
    await expect(page.getByRole("link", { name: "Retirer le filtre Traiteur" })).toBeVisible();
    await expect(page.locator(`tr[data-vendor-id="${setup.fleurs.id}"]`)).toHaveCount(0);
    // Déjà sur le poste : « Dans la comparaison » (sur téléphone, le menu n'offre pas l'ajout).
    if (!isPhone(page)) await expect(page.locator(`tr[data-vendor-id="${setup.haddad.id}"]`)).toContainText("Dans la comparaison");
    await expectNoAxeViolation(page);

    await openFromRow(page, setup.epoque.id, "Belle Époque Traiteur");
    const dialog = page.getByRole("dialog", { name: "Ajouter « Belle Époque Traiteur » à un mariage" });
    await expect(dialog.getByLabel("Mariage")).toHaveValue(setup.eventId);
    await expect(dialog.getByLabel("Poste du budget")).toHaveValue(setup.catererSlot.id);
    await dialog.getByRole("radio", { name: /^En comparaison/ }).check();
    await dialog.getByRole("button", { name: "Ajouter au mariage" }).click();
    await expect(feedback(page).filter({ hasText: "Ajouté à « Traiteur », en comparaison." })).toContainText("2 en comparaison");

    await page.getByRole("link", { name: "Retirer le filtre Traiteur" }).click();
    await expect(page.locator(`tr[data-vendor-id="${setup.fleurs.id}"]`)).toHaveCount(1);
  });

  test("à 1 280 et 1 366 px, aucun nom n'est coupé mot par mot dans le panneau", async ({ page }) => {
    test.skip(isPhone(page), "largeurs d'ordinateur");
    const setup = await agency();
    await signIn(page, setup.email, /\/$/);
    for (const width of [1280, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/events/${setup.eventId}?onglet=budget`);
      const table = page.getByRole("region", { name: "Budget et prestataires, par poste" });
      await table.getByRole("row").filter({ hasText: "Traiteur" }).first().getByRole("button", { name: /\+ Ajouter/ }).first().click();
      const panel = page.getByRole("group", { name: "Ajouter un prestataire à « Traiteur »" });
      await expect(panel.getByRole("listitem").first()).toBeVisible();
      const wrapped = await panel.locator(".vendor-choice-who > strong").evaluateAll((names) =>
        names.filter((name) => {
          const line = parseFloat(getComputedStyle(name).lineHeight) || 20;
          return name.getBoundingClientRect().height > line * 1.5;
        }).map((name) => name.textContent),
      );
      expect(wrapped).toEqual([]);
    }
  });
});
