// PRD-EVT-05 — programme du jour J : modèle de départ, lignes triées par
// heure, intervenants (postes de l'événement et texte libre),
// chevauchement signalé sans bloquer, export PDF en deux variantes. En
// taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { openEventTab, readyOrganization, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("PRD-EVT-05 — programme du jour J depuis un modèle, chevauchement signalé et export PDF", async ({ page }) => {
  const email = `planner-evt05-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-evt05-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Paramètres : une source et un poste par défaut « Photographe ».
  await page.goto("/events/parametres/sources");
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  // Lot 13 (L13-HUB-16) : ajout d'une ligne dans le panneau latéral.
  await page.goto("/events/parametres");
  await page.getByRole("link", { name: "+ Ajouter une ligne" }).click();
  await page.getByLabel("Nouvelle ligne par défaut").fill("Photographe");
  await page.getByRole("button", { name: "Ajouter la ligne" }).click();
  await expect(page.getByText("✓ Ligne ajoutée.")).toBeVisible();

  // Modèles de programme : le modèle de départ se charge.
  await page.goto("/events");
  // Lot 20 (décision 1) : par « Réglages », puis la rubrique.
  await page.getByRole("link", { name: /^Réglages/ }).click();
  await page.getByRole("navigation", { name: "Rubriques des paramètres" }).getByRole("link", { name: "Programme du jour J", exact: true }).click();
  await expect(page).toHaveURL(/\/events\/modeles-programme$/);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Charger le modèle de programme de départ" }).click();
  // Lot 21 (L21-EVT-21) : une ligne de la liste des modèles, qui ouvre son détail.
  await expect(page.getByRole("link", { name: /^Programme du jour J \(modèle de départ\)/ })).toBeVisible();
  await expectNoAxeViolation(page);

  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Inès");
  await page.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  const detailUrl = page.url();

  // Le programme part du modèle : lignes triées par heure, postes reliés.
  await openEventTab(page, "Programme du jour J");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Modèle de programme à appliquer").selectOption({ label: "Programme du jour J (modèle de départ)" });
  await page.getByRole("button", { name: "Appliquer le modèle de programme" }).click();
  await expect(page.getByText("Modèle appliqué : les lignes ont été ajoutées au programme.")).toBeVisible();
  const program = page.getByRole("table", { name: "Programme du jour J" });
  // Lot 62c (UX-13) : une ligne par séquence — début, fin, durée (lot 30b, CHR-06), séquence,
  // lieu, qui (les prestataires concernés, par leur nom).
  const first = program.getByRole("row").nth(1);
  await expect(first.locator(".program-start")).toHaveText("09:00");
  await expect(first.locator(".program-end")).toHaveText("12:00");
  await expect(first.locator(".program-duration")).toHaveText("3 h");
  await expect(first.locator("strong")).toHaveText("Coiffure et maquillage");
  const ceremony = program.getByRole("row").filter({ has: page.locator("strong", { hasText: /^Cérémonie$/ }) });
  await expect(ceremony.locator(".program-start")).toHaveText("15:00");
  await expect(ceremony.locator(".program-end")).toHaveText("16:00");
  await expect(ceremony.locator(".program-duration")).toHaveText("1 h");
  await expect(ceremony.locator(".program-who")).toContainText("Photographe");
  await expect(page.getByRole("heading", { name: "Chevauchements à vérifier" })).toHaveCount(0);

  // Une ligne qui chevauche les photos de groupe pour le photographe : signalée, pas bloquée.
  await page.getByRole("button", { name: "Ajouter une séquence" }).click();
  const newLine = page.getByRole("group", { name: "Modifier la ligne Nouvelle séquence" });
  await newLine.getByLabel("Début", { exact: true }).fill("16:15");
  await newLine.getByLabel("Fin", { exact: true }).fill("17:00");
  await newLine.getByLabel("Séquence", { exact: true }).fill("Photos des invités");
  await newLine.getByLabel("Lieu", { exact: true }).fill("Parc du château");
  await newLine.getByRole("group", { name: "Prestataires concernés (lignes du budget)" }).getByLabel("Photographe").check();
  await newLine.getByLabel("Autres intervenants (séparés par des virgules)").fill("Témoin");
  await newLine.getByLabel("Note interne").fill("Prévoir les alliances");
  // Lot 62c (D1) : rien n'est écrit avant « Enregistrer le programme », qui dit le nombre de lignes.
  await expect(page.getByText("1 ligne modifiée, pas encore enregistrée.")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer le programme" }).click();
  await expect(page.getByText("Programme enregistré : 1 ligne.")).toBeVisible();
  const added = program.getByRole("row").filter({ has: page.locator("strong", { hasText: /^Photos des invités$/ }) });
  await expect(added.locator(".program-start")).toHaveText("16:15");
  await expect(added.locator(".program-end")).toHaveText("17:00");
  await expect(added.locator(".program-duration")).toHaveText("45 min");
  await expect(added).toContainText("Parc du château");
  await expect(added.locator(".program-who")).toContainText("Photographe, Témoin");
  await expect(added).toContainText("Note interne : Prévoir les alliances");
  await expect(page.getByRole("region", { name: "Chevauchements à vérifier" })).toContainText(
    "Photographe est prévu à la fois sur « Photos de groupe » et sur « Photos des invités ».",
  );
  await expectNoAxeViolation(page);

  // Export PDF A4 dans les deux variantes. Lot 37b (CHR-07) : la variante avec notes internes est
  // celle de l'équipe ; les prestataires reçoivent la version diffusée, sans note interne.
  for (const [linkName, file] of [
    ["Télécharger le PDF « mariés »", "programme-maries.pdf"],
    ["Télécharger le PDF « équipe » (notes internes comprises)", "programme-equipe.pdf"],
  ] as const) {
    const href = await page.getByRole("link", { name: linkName }).getAttribute("href");
    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    expect(response.headers()["content-disposition"]).toContain(file);
    expect((await response.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }

  // L'export est refusé sans session.
  const anonymous = await page.context().browser()!.newContext();
  const refused = await anonymous.request.get(`${detailUrl}/programme/pdf?variant=couple`);
  expect(refused.status()).toBe(401);
  await anonymous.close();
});
