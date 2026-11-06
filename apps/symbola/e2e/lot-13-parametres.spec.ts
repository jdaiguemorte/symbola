// Lot 13 (HUB-16) — Paramètres en rubriques : menu latéral groupé, une page
// par rubrique, lignes du budget en tableau, édition en panneau latéral.
// Ordinateur et 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { addDefaultVendorSlots } from "../modules/events/service";
import { clickMenuLink, readyOrganization } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
}

test("HUB-16 — Paramètres en rubriques, lignes du budget modifiées dans le panneau latéral", async ({ page }) => {
  const email = `planner-param-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-parametres";
  const { sql, db } = createAppConnection();
  let organizationId: string;
  try {
    organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    await createUser(db, { organizationId, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await addDefaultVendorSlots(organizationId, [
    { label: "Lieu de réception", icon: "venue" },
    { label: "Photographe", icon: "camera" },
  ]);
  await login(page, email, password);

  // Le menu latéral range les rubriques en groupes ; chacune a son adresse.
  await clickMenuLink(page, "Paramètres");
  const sections = page.getByRole("navigation", { name: "Rubriques des paramètres" });
  for (const group of ["Mon entreprise", "Événements", "Ventes", "Prestataires et données"]) {
    await expect(sections.getByText(group, { exact: true })).toBeVisible();
  }
  await sections.getByRole("link", { name: "Lignes du budget", exact: true }).click();
  await expect(page).toHaveURL(/\/events\/parametres$/);
  await expect(sections.getByRole("link", { name: "Lignes du budget", exact: true })).toHaveAttribute("aria-current", "page");

  // Tableau aligné ; « Modifier » ouvre le panneau latéral, la liste reste visible.
  const table = page.getByRole("region", { name: "Lignes du budget par défaut" });
  await expect(table.getByRole("rowheader", { name: "Photographe" })).toBeVisible();
  await page.getByRole("link", { name: "Modifier la ligne « Photographe »" }).click();
  const panel = page.getByRole("complementary", { name: /^Modifier la ligne/ });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading")).toBeFocused();
  await expectNoAxeViolation(page);
  await panel.getByLabel("Nom de la ligne").fill("Photographe et vidéaste");
  await panel.getByRole("button", { name: "Enregistrer" }).click();
  await expect(panel.getByText("✓ Enregistré")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/events\/parametres$/);
  await expect(table.getByRole("rowheader", { name: "Photographe et vidéaste" })).toBeVisible();

  // Ajouter une ligne, avec son icône, depuis le panneau.
  await page.getByRole("link", { name: "+ Ajouter une ligne" }).click();
  const addPanel = page.getByRole("complementary", { name: "Nouvelle ligne du budget" });
  await addPanel.getByLabel("Nouvelle ligne par défaut").fill("Fleuriste");
  await addPanel.getByLabel("Icône").selectOption({ label: "Fleurs" });
  await addPanel.getByRole("button", { name: "Ajouter la ligne" }).click();
  await expect(addPanel.getByText("✓ Ligne ajoutée.")).toBeVisible();
  await addPanel.getByRole("link", { name: "Fermer le panneau" }).click();
  await expect(table.getByRole("rowheader", { name: "Fleuriste" })).toBeVisible();

  // Sources et motifs : leur propre rubrique.
  await sections.getByRole("link", { name: "Sources et motifs", exact: true }).click();
  await expect(page).toHaveURL(/\/events\/parametres\/sources$/);
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Sources de prospect" }).getByText("Salon")).toBeVisible();
  await expectNoAxeViolation(page);
});
