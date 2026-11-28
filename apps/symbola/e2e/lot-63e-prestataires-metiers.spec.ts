// Lot 63e (PRE-01, PRE-11 ; ADR 0105, ADR 0107, maquettes M4 et M11) — une fiche, plusieurs métiers,
// modifiée dans la grande fenêtre à rubriques : « Suivant » enregistre et enchaîne, un métier principal,
// les étiquettes de chaque métier ; la fiche est trouvée par l'un comme par l'autre de ses métiers.
// En taille ordinateur et en 375 px (une page avec « Retour »), axe-core.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import AxeBuilder from "./axe";
import { readyOrganization, signIn } from "./helpers";
import { vendorCatalogInput } from "../lib/vendors/catalog";
import { createVendor, createVendorTag, listVendorFamilies, listVendorTypes, seedStarterVendorCatalog } from "../modules/vendors/service";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

let email = "";
let vendorId = "";
let photoId = "";
let videoId = "";

test.beforeEach(async () => {
  email = `planner-lot63e-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-lot63e-e2e", role: "owner" });
    await seedStarterVendorCatalog(organization.id, vendorCatalogInput("fr"), { withTypes: true });
    const types = await listVendorTypes(organization.id);
    photoId = types.find((type) => type.starterKey === "photographer")!.id;
    videoId = types.find((type) => type.starterKey === "videographer")!.id;
    const photoFamily = (await listVendorFamilies(organization.id)).find((family) => family.starterKey === "photo_video")!;
    await createVendorTag(organization.id, "Drone", { familyIds: [photoFamily.id] });
    await createVendorTag(organization.id, "Anglais");
    vendorId = (await createVendor(organization.id, { name: "Studio Lumière", typeIds: [photoId], city: "Lyon" })).vendor.id;
  } finally {
    await sql.end();
  }
});

test("PRE-01 — la fiche se modifie en grande fenêtre ; elle coche deux métiers, choisit le principal ; les étiquettes de chaque métier s'ajoutent", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, email, "/");
  await page.goto(`/prestataires/${vendorId}`);
  await page.getByRole("link", { name: "Modifier la fiche" }).click();
  const edit = page.getByRole("dialog", { name: "Studio Lumière : modifier" });
  await expect(edit).toBeVisible();
  const rubrics = edit.getByRole("navigation", { name: "Rubriques de la fiche" });
  await expect(rubrics.getByRole("button", { name: "Identité" })).toHaveAttribute("aria-current", "step");
  await expect(edit.getByText("Rubrique 1 sur 4")).toBeVisible();
  await expectNoAxeViolation(page);

  // « Suivant » enregistre la rubrique et passe à la suivante.
  await edit.getByRole("button", { name: "Suivant : Métiers et étiquettes" }).click();
  await expect(rubrics.getByRole("button", { name: "Métiers et étiquettes" })).toHaveAttribute("aria-current", "step");
  await expect(edit.getByText("Fiche enregistrée.")).toBeVisible();
  await edit.getByRole("checkbox", { name: "Vidéaste" }).check();
  await edit.getByRole("radio", { name: /^Principal.*Vidéaste est le métier principal/ }).check();
  // Les étiquettes de la famille des métiers, puis celles pour tous.
  await expect(edit.getByRole("group", { name: "Étiquettes : Vidéaste, Photographe" }).getByRole("checkbox", { name: "Drone" })).toBeVisible();
  await expect(edit.getByRole("group", { name: "Étiquettes pour tous les métiers" }).getByRole("checkbox", { name: "Anglais" })).toBeVisible();
  await edit.getByRole("checkbox", { name: "Drone" }).check();
  await expectNoAxeViolation(page);
  await edit.getByRole("button", { name: "Enregistrer et fermer" }).click();
  await expect(edit).toHaveCount(0, { timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(`/prestataires/${vendorId}$`));
  await expect(page.locator(".title-with-badge")).toContainText("Vidéaste (principal)");
  await expect(page.locator(".title-with-badge")).toContainText("Photographe");
  await expect(page.locator(".title-with-badge")).toContainText("Drone");

  // PRE-11 : trouvée par l'un comme par l'autre de ses métiers.
  for (const typeId of [photoId, videoId]) {
    await page.goto(`/prestataires?type=${typeId}`);
    await expect(page.locator("[data-vendor-id] .vendor-name-link", { hasText: "Studio Lumière" })).toBeVisible();
  }
  await expectNoAxeViolation(page);
});

test("ADR 0107 — Échap ferme la fenêtre ; sur téléphone, elle prend l'écran et dit « Retour »", async ({ page }) => {
  await signIn(page, email, "/");
  await page.goto(`/prestataires/${vendorId}?modifier=1&rubrique=contact`);
  const edit = page.getByRole("dialog", { name: "Studio Lumière : modifier" });
  await expect(edit.getByLabel("Ville")).toHaveValue("Lyon");
  const narrow = page.viewportSize()!.width < 640;
  await expect(edit.getByRole("button", { name: "‹ Retour" })).toBeVisible({ visible: narrow });
  await expect(edit.getByRole("button", { name: "Fermer", exact: true })).toBeVisible({ visible: !narrow });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expectNoAxeViolation(page);
  await page.keyboard.press("Escape");
  await expect(edit).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/prestataires/${vendorId}$`));
});
