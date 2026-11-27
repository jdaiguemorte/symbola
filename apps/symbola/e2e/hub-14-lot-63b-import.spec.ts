// Lot 63b (HUB-14, UX-15, UX-07, CHR-08) — retours de la recette du 21/11 sur l'import : la fenêtre
// de chargement dès le clic, les colonnes en un tableau avec l'aperçu de la fiche (maquette M5), les
// rapprochements côte à côte (« Benjamin » n'est pas « Benjamin Dupuy »), la fin d'import qui mène à
// la liste filtrée sur l'import, et le programme du jour J lu depuis le PDF de l'ancien logiciel
// (fichier fabriqué aux noms inventés). En taille ordinateur et en 375 px (projets Playwright),
// axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import path from "node:path";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { vendors, vendorTypeLinks, vendorTypes } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import { expect, test, type Page } from "@playwright/test";
import { addEventVendorSlot, addVendorCandidate, createProspect, createProspectSource } from "../modules/events/service";
import { readyOrganization, signIn } from "./helpers";

const PROGRAM_PDF = path.resolve(process.cwd(), "../../packages/testing/import-corpus/files/logiciel-tiers/programme-jour-j.pdf");

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function atelier(label: string) {
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID()}`);
    const email = `${label}-${randomUUID()}@symbola.test`;
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-63b", role: "owner" });
    await withOrganization(db, organization.id, async (tx) => {
      const [photographer] = await tx.insert(vendorTypes).values({ organizationId: organization.id, label: "Photographe", color: "#2f5d7c", position: 0 }).returning();
      const created = await tx
        .insert(vendors)
        .values([
          { organizationId: organization.id, name: "Benjamin Dupuy", email: "contact@dupuy-photo.example.org", phone: "06 39 98 00 44" },
          { organizationId: organization.id, name: "Studio Lumière", city: "Tours" },
        ])
        .returning();
      // Lot 63e : le métier d'une fiche est un lien, le principal donne la couleur.
      await tx.insert(vendorTypeLinks).values(created.map((vendor) => ({ organizationId: organization.id, vendorId: vendor.id, typeId: photographer!.id, isPrimary: true })));
    });
    return { organizationId: organization.id, userId: user.id, email };
  } finally {
    await sql.end();
  }
}

const continueStep = (page: Page) => page.getByRole("group", { name: "Actions de l'étape" }).getByRole("button", { name: "Continuer" }).click();

test("HUB-14 — import de prestataires : chargement visible, colonnes avec aperçu, rapprochements côte à côte, fin d'import vers la liste filtrée", async ({ page }) => {
  test.setTimeout(180_000);
  const { email } = await atelier("planner-63b");
  await signIn(page, email, /\/$/);

  // Le bouton « Importer » de l'écran ouvre l'import réglé sur les prestataires. Lot 71b (I6) : il porte
  // le nom de l'écran, « Reprendre et importer ».
  // Lot 73b : il est au menu « ⋯ » de l'en-tête du carnet.
  await page.goto("/prestataires");
  await page.getByRole("button", { name: "Autres actions du carnet" }).click();
  await page.getByRole("menuitem", { name: "Reprendre et importer" }).click();
  await expect(page).toHaveURL(/\/import\?type=vendors/);
  await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles({
    name: "prestataires-2026.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Nom;Type de prestataire;Ville;E-mail;Tél;N° TVA;Dépt\n" +
        "Benjamin;DJ;Villeurbanne;bnj.mix@example.org;;FR00123456789;69\n" +
        "Studio Lumière;Photographe;Tours;lea@studio-lumiere.example.org;06 39 98 00 05;;37\n" +
        "Fleurs de Saison;Fleuriste;Nice;amandine@fleurs-saison.example.org;06 39 98 00 10;;06\n",
      "utf-8",
    ),
  });
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  // UX-15 : la fenêtre de chargement répond au clic, avant la réponse du serveur.
  const loading = page.getByRole("dialog", { name: "Import en cours…" });
  await expect(loading).toBeVisible();
  await expect(loading).toContainText("Rien n'est encore enregistré.");

  // Où va chaque colonne (maquette M5) : un tableau, l'état dit en mots, l'aperçu de la ligne 1.
  await expect(page).toHaveURL(/\/colonnes$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Où va chaque colonne de votre fichier ?" })).toBeVisible();
  await expect(page.getByText("Symbola en a reconnu 5 sur 7.")).toBeVisible();
  const table = page.getByRole("region", { name: "Colonnes du fichier et ce qu'elles deviennent" });
  const vat = table.getByRole("row").filter({ hasText: "N° TVA" });
  await expect(vat).toContainText("FR00123456789");
  await expect(vat).toContainText("À choisir");
  await vat.getByLabel("Champ pour la colonne « N° TVA »").selectOption("free");
  await expect(vat).toContainText("Choisie");
  await expect(vat).toContainText("Visible sur la fiche, rubrique « Notes ».");
  await table.getByLabel("Champ pour la colonne « Dépt »").selectOption("ignore");
  await expect(table.getByRole("row").filter({ hasText: "Dépt" })).toContainText("Ignorée");
  const preview = page.getByRole("complementary", { name: "Aperçu : ligne 1 du fichier" });
  await expect(preview.getByRole("heading", { name: "Benjamin" })).toBeVisible();
  await expect(preview).toContainText("N° TVA : FR00123456789");
  await expect(preview).not.toContainText("69");
  await expectNoAxeViolation(page);
  await continueStep(page);

  // Types du fichier : proposés, rien à changer.
  await expect(page).toHaveURL(/\/types$/);
  await continueStep(page);

  // Rapprochements côte à côte : seul le prénom est commun, « À vérifier », deux prestataires par défaut.
  await expect(page).toHaveURL(/\/rapprochements/);
  const benjamin = page.getByRole("listitem", { name: /Benjamin — Villeurbanne/ });
  await expect(benjamin).toContainText("À vérifier");
  await expect(benjamin).toContainText("Seul un mot du nom est commun");
  await expect(benjamin.getByRole("row", { name: /Métier/ })).toContainText("Photographe différent");
  await expect(benjamin).toContainText("Choix actuel : Ce sont deux prestataires");
  await expect(benjamin.getByRole("button", { name: "Ce sont deux prestataires : Benjamin — Villeurbanne" })).toHaveAttribute("aria-pressed", "true");
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "C'est le même : Studio Lumière — Tours" }).click();
  // Décidé, il passe dans « Mises à jour ».
  await expect(page.getByRole("navigation", { name: "Filtrer les lignes" }).getByRole("link", { name: "Mises à jour · 1" })).toBeVisible();
  await continueStep(page);

  // Vérifier et confirmer.
  await expect(page).toHaveURL(/\/confirmation$/);
  await page.getByRole("button", { name: "Importer 3 prestataires" }).click();

  // Fin d'import : le bilan d'abord, puis « Vérifier les N prestataires » ; l'annulation est repliée.
  await expect(page.getByRole("heading", { name: "Import terminé" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "créés" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tout annuler" })).toBeHidden();
  await expect(page.getByText("Annuler cet import", { exact: true })).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("link", { name: "Vérifier les 3 prestataires" }).click();

  // La liste filtrée sur l'import, pastille « Import du JJ/MM » retirable.
  await expect(page).toHaveURL(/\/prestataires\?import=/);
  await expect(page.getByText(/^Import du \d{2}\/\d{2}/)).toBeVisible();
  await expect(page.getByText("3 fiches sur 4, par nom")).toBeVisible();
  await expect(page.getByRole("link", { name: "Benjamin Dupuy" })).toHaveCount(0);
  await expectNoAxeViolation(page);
  await page.getByRole("link", { name: /^Retirer le filtre « Import du/ }).click();
  await expect(page.getByText("4 fiches, par nom")).toBeVisible();
});

test("CHR-08 — programme du jour J importé depuis le PDF de l'ancien logiciel : intervenants rattachés, ligne cachée des mariés importée cachée", async ({ page }) => {
  test.setTimeout(180_000);
  const { organizationId, userId, email } = await atelier("planner-63b-programme");
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: source.id, clients: [{ firstName: "Clémence", lastName: null }], eventDate: "2027-06-12" });
  const dj = await addEventVendorSlot(organizationId, event.id, "DJ");
  await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: dj.id, vendorName: "Ondes Sonores" });
  await signIn(page, email, /\/$/);

  await page.goto(`/events/${event.id}?onglet=programme`);
  await page.getByRole("link", { name: "Importer", exact: true }).click();
  // Lot 65g (CHR-08) : l'import s'ouvre en tête de la carte, une fois la page rechargée.
  await expect(page).toHaveURL(/importer=1/);
  await page.getByLabel("Fichier CSV, XLSX ou PDF").setInputFiles(PROGRAM_PDF);
  await page.getByRole("button", { name: "Voir avant d'importer" }).click();

  await expect(page.getByRole("heading", { name: "12 séquences lues" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Programme lu depuis le PDF de votre ancien logiciel")).toBeVisible();
  // L'intervenant « DJ » de l'en-tête est rattaché au poste de l'évènement qui porte son nom.
  await expect(page.getByLabel("Prestataire de l'évènement pour « DJ »")).toHaveValue(dj.id);
  // Q44 : la ligne « Caché des mariés » s'importe cachée d'eux, pas écartée.
  await expect(page.getByText(/est « Cachée des mariés » dans le fichier : elle s'importe cachée d'eux/)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Écarter la ligne 10" })).not.toBeChecked();
  await expectNoAxeViolation(page);

  await page.getByRole("button", { name: "Importer 12 séquences" }).click();
  await expect(page.getByText("12 séquences importées, 2 temps forts créés.")).toBeVisible({ timeout: 30_000 });
  // Dans l'éditeur, la séquence porte la pastille et la case cochée.
  await page.reload();
  const surprise = page.getByRole("row").filter({ hasText: "Animation surprise" });
  await expect(surprise).toContainText("Cachée des mariés");
  await surprise.getByRole("button", { name: /Modifier/ }).click();
  await expect(page.getByRole("checkbox", { name: /Cachée des mariés/ })).toBeChecked();
  await expectNoAxeViolation(page);
});
