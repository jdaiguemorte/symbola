// Lot 10 (AIDE-08) — recherche globale : un nom de client ouvre l'événement,
// un mot d'aide mène à l'écran qui en parle ; résultats instantanés au
// clavier, et page /recherche. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { createProspect, createProspectSource } from "../modules/events/service";
import { readyOrganization, signIn as signInByLink } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("AIDE-08 — rechercher un événement par le nom du client, et une aide par un mot", async ({ page }) => {
  const email = `planner-recherche-${randomUUID()}@symbola.test`;
  const firstName = `Marion${randomUUID().slice(0, 6)}`;
  const { sql, db } = createAppConnection();
  let eventId: string;
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-recherche", role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    eventId = (
      await createProspect({
        organizationId: organization.id,
        createdByUserId: user.id,
        prospectSourceId: source.id,
        clients: [{ firstName }, { firstName: "Julien" }],
        venueName: "Domaine des Oliviers",
      })
    ).id;
  } finally {
    await sql.end();
  }

  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email);
  await expect(page).toHaveURL("/");

  // Résultats instantanés : flèche bas puis Entrée ouvre l'événement.
  const box = page.getByRole("combobox", { name: "Rechercher" });
  await box.fill(firstName.toLowerCase());
  const options = page.getByRole("option");
  await expect(options.first()).toContainText(`${firstName} & Julien`);
  await expectNoAxeViolation(page);
  await box.press("ArrowDown");
  await box.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/events/${eventId}$`));

  // Le lieu suffit aussi, sans accent ni majuscule.
  await box.fill("domaine oliviers");
  await expect(page.getByRole("option").first()).toContainText(`${firstName} & Julien`);

  // Un mot d'aide mène à l'écran qui en parle ; la page /recherche marche aussi.
  await box.fill("TVA");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/recherche\?q=TVA$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Résultats pour « TVA »");
  await expect(page.getByRole("region", { name: "Aide et écrans" })).toContainText("Mon organisation");
  await expectNoAxeViolation(page);

  await page.goto("/recherche?q=xyzintrouvable");
  await expect(page.getByText("Aucun résultat pour « xyzintrouvable ».", { exact: false })).toBeVisible();
  // Lot 20 (L20-HUB-27) : un seul champ de recherche, celui du haut, qui garde la
  // recherche faite, sans ouvrir sa liste au chargement.
  await expect(page.getByRole("searchbox").or(page.getByRole("combobox"))).toHaveCount(1);
  await expect(box).toHaveValue("xyzintrouvable");
  await expect(box).toHaveAttribute("aria-expanded", "false");
});
