// Lot 16 (ADR 0045) — types d'événement et vocabulaire : il suit le type de
// l'événement sur ses écrans, et le métier ailleurs. Une wedding planner peut
// organiser un séminaire, une agence un mariage. Ordinateur et 375 px,
// axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { eq } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { organizationProfiles } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { createProspectSource } from "../modules/events/service";
import { readyOrganization, signIn as signInByLink } from "./helpers";

async function login(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function plannerOf(metier: "wedding_planner" | "event_agency") {
  const email = `planner-types-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-types-evenement";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await withOrganization(db, organization.id, (tx) => tx.update(organizationProfiles).set({ metier }).where(eq(organizationProfiles.organizationId, organization.id)));
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    await createProspectSource(organization.id, "Bouche-à-oreille");
  } finally {
    await sql.end();
  }
  return { email, password };
}

async function createEvent(page: Page, type: string, expectedLabel: string): Promise<string> {
  await page.goto("/events/new");
  await page.getByLabel("Type d'événement").selectOption({ label: type });
  await page.getByLabel(expectedLabel).fill("Inès");
  await page.getByLabel("Source du prospect").selectOption({ label: "Bouche-à-oreille" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname;
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("lot 16 — une wedding planner organise un séminaire : sa fiche parle du client, la liste garde « Mariés »", async ({ page }) => {
  const planner = await plannerOf("wedding_planner");
  await login(page, planner.email, planner.password);

  // Les libellés des clients suivent le type choisi.
  await page.goto("/events/new");
  await expect(page.getByLabel("Prénom du premier marié")).toBeVisible();
  const path = await createEvent(page, "Séminaire", "Prénom du premier contact");

  await page.goto(`${path}?onglet=maries`);
  await expect(page.getByRole("heading", { name: "Coordonnées des clients" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Coordonnées des mariés" })).toHaveCount(0);
  await expectNoAxeViolation(page);

  // Le type change sur la fiche, et le vocabulaire avec lui.
  await page.getByRole("combobox", { name: /^Type de l'événement/ }).selectOption({ label: "Mariage" });
  await page.getByRole("button", { name: "Changer le type" }).click();
  await expect(page.getByRole("heading", { name: "Coordonnées des mariés" })).toBeVisible();

  // Les écrans qui mêlent plusieurs événements gardent le vocabulaire du métier.
  await page.goto("/events");
  await expect(page.getByRole("columnheader", { name: "Mariés" })).toBeVisible();
});

test("lot 16 — une agence organise un mariage : sa fiche parle des mariés, la liste garde « Clients »", async ({ page }) => {
  const agency = await plannerOf("event_agency");
  await login(page, agency.email, agency.password);

  await page.goto("/events/new");
  await expect(page.getByLabel("Prénom du premier contact")).toBeVisible();
  const path = await createEvent(page, "Mariage", "Prénom du premier marié");
  await page.goto(`${path}?onglet=maries`);
  await expect(page.getByRole("heading", { name: "Coordonnées des mariés" })).toBeVisible();
  await expectNoAxeViolation(page);

  await page.goto("/events");
  await expect(page.getByRole("columnheader", { name: "Clients" })).toBeVisible();
});

test("lot 16 — Paramètres › Types d'événements : ajouter un type qui parle des mariés", async ({ page }) => {
  const planner = await plannerOf("event_agency");
  await login(page, planner.email, planner.password);
  await page.goto("/events/parametres/types");
  const table = page.getByRole("region", { name: "Tableau des types d'événements" });
  await expect(table.getByRole("textbox", { name: "Nom du type Séminaire" })).toBeVisible();
  await page.getByLabel("Nom du type", { exact: true }).fill("Pacs");
  await page.getByLabel("Vos clients sont").selectOption({ label: "les mariés" });
  await page.getByRole("button", { name: "Ajouter le type" }).click();
  await expect(table.getByRole("textbox", { name: "Nom du type Pacs" })).toBeVisible();
  await expect(table.getByRole("combobox", { name: "Vos clients pour le type Pacs" })).toHaveValue("couple");
  await expectNoAxeViolation(page);
});
