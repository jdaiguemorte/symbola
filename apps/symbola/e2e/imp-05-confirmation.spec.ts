// IMP-05 — parcours complet d'un import d'évènements : aperçu (créations, mises
// à jour, lignes rejetées), confirmation avec source par défaut, champ libre
// visible sur la fiche, journal, puis annulation. En taille ordinateur et en
// 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { eventClients, eventPlaces, events, prospectSources } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createUser } from "@symbola/auth";
import { createContact } from "../modules/hub/service";
import { expect, test, type Page } from "@playwright/test";
import { openSettingsTab, readyOrganization, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("IMP-05 — aperçu, confirmation, champ libre sur la fiche, journal et annulation", async ({ page }) => {
  const email = `planner-imp05-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-imp05-e2e";
  let existingEventId = "";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    existingEventId = await withOrganization(db, organization.id, async (tx) => {
      const [source] = await tx.insert(prospectSources).values({ organizationId: organization.id, label: "Instagram" }).returning();
      const [event] = await tx
        .insert(events)
        .values({ organizationId: organization.id, eventDate: "2027-06-12", prospectSourceId: source!.id })
        .returning();
      // Lot 34b (D10) : le lieu de réception est le premier lieu de la liste.
      await tx.insert(eventPlaces).values({ organizationId: organization.id, eventId: event!.id, label: "Salle des fêtes", position: 0 });
      // Lot 36a : le client est un contact du hub.
    const contact = await createContact(organization.id, { firstName: "Élodie", lastName: "Durand" });
    await tx.insert(eventClients).values({ organizationId: organization.id, eventId: event!.id, contactId: contact.id, position: 0 });
      return event!.id;
    });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Le menu mène à l'import.
  await openSettingsTab(page, "Reprendre et importer");
  // Lot 16 (IMP-11) : « Un autre fichier », puis le contenu. Lot 71b (I6) : « Une autre liste ».
  await page.getByRole("navigation", { name: "Que voulez-vous importer ?" }).getByRole("link", { name: /Une autre liste/ }).click();
  await page.getByLabel("Évènements et leurs clients (une ligne par évènement)").check();
  await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles({
    name: "mariages.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Prénom mariée;Nom mariée;Date du mariage;Lieu;E-mail\n" +
        "Élodie;Durand;12/06/2027;Château de Vaux;elodie@example.org\n" +
        "Inès;Moreau;03/09/2027;Domaine des Œillets;\n" +
        "Léa;Martin;31/02/2027;;\n",
      "utf-8",
    ),
  });
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  const continueButton = page.getByRole("group", { name: "Actions de l'étape" }).getByRole("button", { name: "Continuer" });

  // Lot 16 (IMP-11) : la colonne « E-mail » se garde en champ libre dès l'étape « Colonnes ».
  await expect(page).toHaveURL(/\/colonnes$/);
  await page.getByLabel("Champ pour la colonne « E-mail »").selectOption({ label: "Une note sur la fiche" });
  await continueButton.click();
  // Doublons : l'évènement existant est mis à jour.
  await expect(page).toHaveURL(/\/rapprochements/);
  await page.getByRole("button", { name: /Mettre à jour l'existant pour Élodie Durand/ }).click();
  await continueButton.click();

  await expect(page).toHaveURL(/\/confirmation$/);
  await expect(page.getByRole("heading", { name: "Import de « mariages.csv »" })).toBeVisible();
  const effects = page.getByRole("region", { name: "Ce que va faire l'import" });
  await expect(effects.getByRole("definition")).toHaveText(["1", "1", "E-mail", "1"]);
  await expect(page.getByText("Ligne 3 : Inès Moreau, le 3 septembre 2027")).toBeVisible();
  await expect(page.getByText("Ligne 2 : Élodie Durand, le 12 juin 2027")).toBeVisible();
  await expectNoAxeViolation(page);

  await page.getByLabel("Source pour les évènements sans source").selectOption({ label: "Instagram" });
  await page.getByRole("button", { name: "Importer 2 évènements" }).click();
  await expect(page).toHaveURL(/\/journal$/);
  // Lot 63b (HUB-14, UX-07) : la fin d'import s'annonce comme telle.
  await expect(page.getByRole("heading", { name: "Import terminé" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir les 2 évènements" })).toBeVisible();
  // Lot 63b (HUB-14, UX-07) : le bilan d'abord ; le détail du journal est replié.
  await page.getByText("Détails du journal (fichier, auteur, dates)").click();
  await expect(page.getByText("1 création, 1 mise à jour, aucune ligne inchangée, 1 ligne rejetée")).toBeVisible();
  // L'auteur de l'import, dans la page (le menu affiche aussi l'e-mail connecté).
  await expect(page.getByRole("main").getByText(email)).toBeVisible();
  await expectNoAxeViolation(page);

  // La colonne gardée en champ libre est visible sur la fiche mise à jour.
  await page.goto(`/events/${existingEventId}`);
  const imported = page.getByRole("region", { name: "Champs importés" });
  await expect(imported).toContainText("E-mail");
  await expect(imported).toContainText("elodie@example.org");
  await expectNoAxeViolation(page);

  // Annulation : l'évènement créé disparaît, l'évènement mis à jour revient.
  await page.goto("/import");
  await page.getByRole("link", { name: "mariages.csv" }).click();
  // Lot 63b (HUB-14, UX-07) : l'annulation est repliée sous le bilan.
  // Lot 71d (C-66) : « Retirer cet import… », danger de niveau 2.
  await page.getByRole("button", { name: "Retirer cet import…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Retirer l'import" }).click();
  await expect(page.getByText("2 éléments annulés ; aucun gardé car modifié ; aucun gardé car utilisé.")).toBeVisible();
  await page.getByText("Détails du journal (fichier, auteur, dates)").click();
  await expect(page.getByText("Annulé le")).toBeVisible();
  await expectNoAxeViolation(page);

  await page.goto(`/events/${existingEventId}`);
  await expect(page.getByRole("region", { name: "Champs importés" })).toHaveCount(0);
  await page.goto("/events");
  await expect(page.getByText("Inès")).toHaveCount(0);
});
