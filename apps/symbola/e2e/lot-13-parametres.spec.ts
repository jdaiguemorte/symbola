// Lot 13 (L13-HUB-16) — Paramètres en rubriques : menu latéral groupé, une page
// par rubrique, lignes du budget en tableau, édition en panneau latéral.
// Ordinateur et 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { addDefaultVendorSlots } from "../modules/events/service";
import { clickMenuLink, openSettingsTab, readyOrganization, signIn as signInByLink } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function login(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

test("L13-HUB-16 — Paramètres en rubriques, lignes du budget modifiées dans le panneau latéral", async ({ page }) => {
  test.setTimeout(90_000);
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
  // Panneau fermé (plein écran sur téléphone) avant de toucher au tableau.
  await expect(addPanel).toHaveCount(0);
  await expect(page).toHaveURL(/\/events\/parametres$/);
  await expect(table.getByRole("rowheader", { name: "Fleuriste" })).toBeVisible();

  // L'ordre se change avec les flèches (clavier, téléphone), enregistré aussitôt.
  const order = () => table.getByRole("rowheader").allTextContents();
  await expect.poll(order).toEqual(["Lieu de réception", "Photographe et vidéaste", "Fleuriste"]);
  await expect(page.getByRole("button", { name: "Monter la ligne « Lieu de réception »" })).toBeDisabled();
  const down = page.getByRole("button", { name: "Descendre la ligne « Lieu de réception »" });
  await down.focus();
  await page.keyboard.press("Enter");
  await expect.poll(order).toEqual(["Photographe et vidéaste", "Lieu de réception", "Fleuriste"]);
  await expect(page.getByRole("status").filter({ hasText: "« Lieu de réception » est maintenant en position 2 sur 3." })).toBeAttached();
  await expect(down).toBeFocused();
  // Au glisser-déposer à la souris (ordinateur) : Fleuriste en tête.
  if (page.viewportSize()!.width >= 1024) {
    await table.getByRole("row", { name: /Fleuriste/ }).dragTo(table.getByRole("row", { name: /Photographe et vidéaste/ }));
    await expect.poll(order).toEqual(["Fleuriste", "Photographe et vidéaste", "Lieu de réception"]);
    // L'annonce ne vient qu'une fois l'ordre enregistré : recharger avant perdrait le déplacement.
    await expect(page.getByRole("status").filter({ hasText: "« Fleuriste » est maintenant en position 1 sur 3." })).toBeAttached();
  }
  await page.reload();
  await expect.poll(order).toEqual(
    page.viewportSize()!.width >= 1024 ? ["Fleuriste", "Photographe et vidéaste", "Lieu de réception"] : ["Photographe et vidéaste", "Lieu de réception", "Fleuriste"],
  );
  await expectNoAxeViolation(page);

  // Sources et motifs : leur propre rubrique.
  // Après le rechargement, sur téléphone, la rubrique s'affiche seule : on repasse par le menu.
  await openSettingsTab(page, "Sources et motifs");
  await expect(page).toHaveURL(/\/events\/parametres\/sources$/);
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Sources de prospect" }).getByText("Salon")).toBeVisible();
  await expectNoAxeViolation(page);
});
