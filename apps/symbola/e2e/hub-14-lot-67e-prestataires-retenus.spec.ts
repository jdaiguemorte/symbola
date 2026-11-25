// Lot 67e (HUB-14, PRE-02, BUD-04 ; recette du 24/11/2026, R07) — reprendre d'un PDF les prestataires
// retenus d'un évènement, depuis l'onglet « Budget et prestataires » : aperçu (fiche du carnet
// retrouvée, ligne du budget proposée, ligne de la planner écartée), puis reprise, qui pourvoit les
// lignes. Fichier fabriqué aux noms inventés. En taille ordinateur et en 375 px (projets
// Playwright), axe-core sur l'aperçu.
import { randomUUID } from "node:crypto";
import path from "node:path";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { vendors } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import { expect, test } from "@playwright/test";
import { createProspect, createProspectSource } from "../modules/events/service";
import { readyOrganization, signIn } from "./helpers";

const VENDORS_PDF = path.resolve(process.cwd(), "../../packages/testing/import-corpus/files/logiciel-tiers/prestataires-evenement.pdf");

async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID()}`);
    const email = `reprise-${randomUUID()}@symbola.test`;
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-67e", role: "owner" });
    await withOrganization(db, organization.id, (tx) => tx.insert(vendors).values({ organizationId: organization.id, name: "Studio Lumière", city: "Tours" }));
    const source = await createProspectSource(organization.id, "Salon");
    const event = await createProspect({ organizationId: organization.id, createdByUserId: user.id, prospectSourceId: source.id, clients: [{ firstName: "Clémence", lastName: "Martin" }], eventDate: "2027-06-12" });
    return { email, eventId: event.id };
  } finally {
    await sql.end();
  }
}

test("HUB-14 — prestataires retenus repris d'un PDF : aperçu contrôlé, puis lignes du budget pourvues", async ({ page }) => {
  const { email, eventId } = await atelier();
  await signIn(page, email, /\/$/);
  await page.goto(`/events/${eventId}?onglet=budget&reprendre=1`);

  const panel = page.locator("#reprendre-prestataires");
  await expect(panel.getByText("Reprendre les prestataires retenus (PDF)")).toBeVisible();
  await panel.getByLabel("Fichier PDF").setInputFiles(VENDORS_PDF);
  await panel.getByRole("button", { name: "Lire le fichier" }).click();

  // Aperçu : 12 prestataires (la ligne de la planner est dite, et écartée), rien n'est encore écrit.
  await expect(panel.getByRole("heading", { name: "12 prestataires lus" })).toBeVisible();
  await expect(panel.getByText("Fichier de : Clémence MARTIN, Bastien LEROY — 12 juin 2027.")).toBeVisible();
  await expect(panel.getByText("Ligne non reprise, c'est vous : Belle Journée.")).toBeVisible();
  const table = panel.getByRole("region", { name: "12 prestataires lus" });
  const row = (name: string) => table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${name}`) }) });
  // Fiche du carnet retrouvée ; une fiche inconnue sera créée, un métier sans ligne en aura une.
  await expect(row("Studio Lumière")).toContainText("Trouvée dans le carnet");
  await expect(row("Nuit Blanche Sono").getByLabel("Fiche du carnet pour Nuit Blanche Sono")).toHaveValue("new");
  await expect(row("Les P'tits Loups").getByLabel("Ligne du budget pour Les P'tits Loups")).toHaveValue("new");
  const result = await new AxeBuilder({ page }).include("#reprendre-prestataires").analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);

  // La planner écarte une ligne, puis reprend.
  await panel.getByLabel("Ne pas reprendre FlashBooth").check();
  await panel.getByRole("button", { name: /^Reprendre \d+ prestataires$/ }).click();
  await expect(panel.getByRole("status").filter({ hasText: /11 prestataires retenus, 10 fiches créées, (aucune ligne créée|\d+ lignes? créées?)\./ })).toBeVisible();

  // Les lignes du budget portent leurs prestataires.
  await page.goto(`/events/${eventId}?onglet=budget`);
  const budget = page.getByRole("main");
  await expect(budget.getByText("Studio Lumière").first()).toBeVisible();
  await expect(budget.getByText("Nuit Blanche Sono").first()).toBeVisible();
  await expect(budget.getByText("FlashBooth")).toHaveCount(0);
});
