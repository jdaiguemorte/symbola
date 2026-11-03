// IMP-05 — parcours complet d'un import d'événements : aperçu (créations, mises
// à jour, lignes rejetées), confirmation avec source par défaut, champ libre
// visible sur la fiche, journal, puis annulation. En taille ordinateur et en
// 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { eventClients, events, prospectSources } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { clickMenuLink } from "./helpers";

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

test("IMP-05 — aperçu, confirmation, champ libre sur la fiche, journal et annulation", async ({ page }) => {
  const email = `planner-imp05-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-imp05-e2e";
  let existingEventId = "";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    existingEventId = await withOrganization(db, organization.id, async (tx) => {
      const [source] = await tx.insert(prospectSources).values({ organizationId: organization.id, label: "Instagram" }).returning();
      const [event] = await tx
        .insert(events)
        .values({ organizationId: organization.id, eventDate: "2027-06-12", venueName: "Salle des fêtes", prospectSourceId: source!.id })
        .returning();
      await tx.insert(eventClients).values({ organizationId: organization.id, eventId: event!.id, firstName: "Élodie", lastName: "Durand", position: 0 });
      return event!.id;
    });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Le menu mène à l'import.
  await clickMenuLink(page, "Importer des données");
  await page.getByLabel("Événements et leurs clients (une ligne par événement)").check();
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
  await page.getByRole("link", { name: "Continuer : reconnaître les colonnes" }).click();
  await page.getByRole("button", { name: "Enregistrer les colonnes" }).click();
  await page.getByRole("link", { name: "Continuer : rapprocher des éléments existants" }).click();
  await page.getByRole("button", { name: "Valider le rapprochement proposé" }).click();
  await page.getByRole("link", { name: "Continuer : rapport des écarts" }).click();
  await page.getByRole("group", { name: "E-mail" }).getByLabel("Garder en champ libre sur la fiche").check();
  await page.getByRole("button", { name: "Enregistrer les choix" }).click();
  await page.getByRole("link", { name: "Continuer : aperçu et confirmation" }).click();

  await expect(page.getByRole("heading", { name: "Aperçu de l'import « mariages.csv »" })).toBeVisible();
  await expect(page.getByText("1 création, 1 mise à jour, 1 ligne rejetée.")).toBeVisible();
  await expect(page.getByText("Ligne 3 : Inès Moreau, le 3 septembre 2027")).toBeVisible();
  await expect(page.getByText("Ligne 2 : Élodie Durand, le 12 juin 2027")).toBeVisible();
  await expectNoAxeViolation(page);

  await page.getByLabel("Source pour les événements sans source").selectOption({ label: "Instagram" });
  await page.getByRole("button", { name: "Confirmer l'import" }).click();
  await expect(page.getByRole("heading", { name: "Import de « mariages.csv »" })).toBeVisible();
  await expect(page.getByText("1 création, 1 mise à jour, aucune ligne inchangée, 1 ligne rejetée")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expectNoAxeViolation(page);

  // La colonne gardée en champ libre est visible sur la fiche mise à jour.
  await page.goto(`/events/${existingEventId}`);
  await page.waitForLoadState("networkidle");
  const tour = page.getByRole("dialog");
  if (await tour.isVisible()) await tour.getByRole("button", { name: "Passer" }).click();
  const imported = page.getByRole("region", { name: "Champs importés" });
  await expect(imported).toContainText("E-mail");
  await expect(imported).toContainText("elodie@example.org");
  await expectNoAxeViolation(page);

  // Annulation : l'événement créé disparaît, l'événement mis à jour revient.
  await page.goto("/import");
  await page.getByRole("link", { name: "mariages.csv" }).click();
  await page.getByRole("button", { name: "Annuler l'import" }).click();
  await expect(page.getByText("2 éléments annulés ; aucun gardé car modifié ; aucun gardé car utilisé.")).toBeVisible();
  await expect(page.getByText("Annulé le")).toBeVisible();
  await expectNoAxeViolation(page);

  await page.goto(`/events/${existingEventId}`);
  await expect(page.getByRole("region", { name: "Champs importés" })).toHaveCount(0);
  await page.goto("/events");
  await expect(page.getByText("Inès")).toHaveCount(0);
});
