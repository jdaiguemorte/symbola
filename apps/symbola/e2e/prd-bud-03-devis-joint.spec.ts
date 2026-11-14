// PRD-BUD-03 — devis prestataire joint à une ligne du budget (PDF ou image,
// antivirus, stockage privé), ouvert par lien signé temporaire. En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { openEventTab, readyOrganization, changeEventStatus, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("PRD-BUD-03 — joindre le devis d'un prestataire à une ligne et l'ouvrir par lien signé", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `planner-bud03-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-bud03-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Prérequis (même parcours que PRD-BUD-02) : postes, source, modèle, budget estimé.
  await page.goto("/events/parametres");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Charger le modèle de départ" }).click();
  await expect(page.getByRole("rowheader", { name: "Lieu de réception" })).toBeVisible();
  // Lot 13 (L13-HUB-16) : les sources ont leur rubrique.
  await page.goto("/events/parametres/sources");
  await page.getByLabel("Nouvelle source").fill("Instagram");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await page.goto("/budget/parametres");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nom du modèle").fill("Classique");
  await page.getByLabel("Lieu de réception %").fill("60");
  await page.getByLabel("Traiteur %").fill("40");
  await page.getByRole("button", { name: "Créer le modèle" }).click();
  await expect(page.getByText("Modèle créé.")).toBeVisible();
  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Camille");
  await page.getByLabel("Source du prospect").selectOption({ label: "Instagram" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page.getByRole("heading", { name: "Camille" })).toBeVisible();
  const eventUrl = page.url();
  // Lot 12 (L12-EVT-17) : le budget est un onglet de la fiche ; le module
  // Budget s'ouvre depuis son lien.
  await openEventTab(page, "Budget");
  await page.getByRole("link", { name: "Proposer des montants estimés, historique et devis joints" }).click();
  await page.getByLabel("Budget total (€)").fill("10000");
  await page.getByLabel("Nombre d'invités").fill("40");
  await page.getByLabel("Modèle de répartition").selectOption({ label: "Classique" });
  await page.getByRole("button", { name: "Simuler" }).click();
  await expect(page.getByText("250,00 €", { exact: false })).toBeVisible();
  await page.goto(eventUrl);
  await page.waitForLoadState("networkidle");
  await changeEventStatus(page, "Confirmé");
  await page.getByRole("button", { name: "En faire le budget estimé" }).click();
  await expect(page.getByRole("heading", { name: "Faire de la simulation le budget estimé" })).toHaveCount(0);

  // PRD-BUD-03 : un format non supporté est refusé avec un message clair.
  await page.goto(eventUrl.replace("/events/", "/budget/"));
  await page.waitForLoadState("networkidle");
  // Lot 28b : la ligne (pas le total de sa catégorie), repérée par « Modifier ».
  const lieuRow = page.getByRole("table", { name: "Estimé, devisé, engagé, payé" }).getByRole("row").filter({ hasText: "Modifier « Lieu de réception »" });
  await lieuRow.getByText("Modifier « Lieu de réception »").click();
  // Lot 28b : le formulaire s'ouvre dans une rangée pleine largeur, sous la ligne.
  const editor = page.getByRole("region", { name: "Ligne « Lieu de réception » : montants, prestataire, documents et échéances" });
  const quoteInput = editor.getByLabel(/Document du prestataire — Lieu de réception/);
  await quoteInput.setInputFiles({ name: "devis.txt", mimeType: "text/plain", buffer: Buffer.from("devis en texte") });
  await editor.getByRole("button", { name: "Joindre le document" }).click();
  await expect(editor.getByRole("alert")).toHaveText("Format non supporté : joignez un PDF ou une image.");

  // Un PDF est accepté, puis s'ouvre par un lien signé temporaire.
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");
  await quoteInput.setInputFiles({ name: "devis-lieu.pdf", mimeType: "application/pdf", buffer: pdf });
  await editor.getByRole("button", { name: "Joindre le document" }).click();
  await expect(editor.getByText("Document joint.")).toBeVisible();
  const link = editor.getByRole("link", { name: /Ouvrir le devis 1 — Lieu de réception/ });
  await expect(link).toBeVisible();
  await expectNoAxeViolation(page);

  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/budget\/[0-9a-f-]{36}\/devis\/[0-9a-f-]{36}$/);
  // ADR 0027 : servi par l'app elle-même, jamais de redirection vers le stockage.
  const opened = await page.request.get(href!, { maxRedirects: 0 });
  expect(opened.status()).toBe(200);
  expect(opened.headers()["content-type"]).toBe("application/pdf");
  expect(opened.headers()["cache-control"]).toBe("private, no-store");
  expect((await opened.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // Sans session, le devis ne s'ouvre pas.
  const anonymous = await page.context().browser()!.newContext();
  expect((await anonymous.request.get(new URL(href!, page.url()).toString(), { maxRedirects: 0 })).status()).toBe(401);
  await anonymous.close();
});
