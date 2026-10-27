// EVT-05 — programme du jour J : modèle de départ, lignes triées par
// heure, intervenants (postes de l'événement et texte libre),
// chevauchement signalé sans bloquer, export PDF en deux variantes. En
// taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

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

test("EVT-05 — programme du jour J depuis un modèle, chevauchement signalé et export PDF", async ({ page }) => {
  const email = `planner-evt05-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-evt05-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Paramètres : une source et un poste par défaut « Photographe ».
  await page.goto("/events/parametres");
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await page.getByLabel("Nouveau poste par défaut").fill("Photographe");
  await page.getByRole("button", { name: "Ajouter le poste par défaut" }).click();
  await expect(page.getByText("Poste ajouté.")).toBeVisible();

  // Modèles de programme : le modèle de départ se charge.
  await page.goto("/events");
  await page.getByRole("link", { name: "Modèles de programme" }).click();
  await expect(page).toHaveURL(/\/events\/modeles-programme$/);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Charger le modèle de programme de départ" }).click();
  await expect(page.getByRole("heading", { name: "Programme du jour J (modèle de départ)" })).toBeVisible();
  await expectNoAxeViolation(page);

  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Inès");
  await page.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  const detailUrl = page.url();

  // Le programme part du modèle : lignes triées par heure, postes reliés.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Modèle de programme à appliquer").selectOption({ label: "Programme du jour J (modèle de départ)" });
  await page.getByRole("button", { name: "Appliquer le modèle de programme" }).click();
  await expect(page.getByText("Modèle appliqué : les lignes ont été ajoutées au programme.")).toBeVisible();
  const program = page.getByRole("list", { name: "Programme du jour J" });
  await expect(program.getByRole("listitem").first()).toContainText("09:00 – 12:00 — Coiffure et maquillage");
  await expect(program.getByRole("listitem").filter({ hasText: "15:00 – 16:00 — Cérémonie" })).toContainText(
    "Intervenants : Photographe",
  );
  await expect(page.getByRole("heading", { name: "Chevauchements à vérifier" })).toHaveCount(0);

  // Une ligne qui chevauche les photos de groupe pour le photographe : signalée, pas bloquée.
  const newLine = page.getByRole("group", { name: "Nouvelle ligne du programme" });
  await newLine.getByLabel("Heure de début").fill("16:15");
  await newLine.getByLabel("Heure de fin (facultative)").fill("17:00");
  await newLine.getByLabel("Intitulé de la ligne").fill("Photos des invités");
  await newLine.getByLabel("Lieu").fill("Parc du château");
  await newLine.getByRole("group", { name: "Intervenants parmi les postes de l'événement" }).getByLabel("Photographe").check();
  await newLine.getByLabel("Autres intervenants (séparés par des virgules)").fill("Témoin");
  await newLine.getByLabel("Note interne").fill("Prévoir les alliances");
  await newLine.getByRole("button", { name: "Ajouter la ligne" }).click();
  await expect(page.getByText("Ligne ajoutée.")).toBeVisible();
  const added = program.getByRole("listitem").filter({ hasText: "16:15 – 17:00 — Photos des invités" });
  await expect(added).toContainText("Parc du château — Intervenants : Photographe, Témoin");
  await expect(added).toContainText("Note interne : Prévoir les alliances");
  await expect(page.getByRole("region", { name: "Chevauchements à vérifier" })).toContainText(
    "Photographe est prévu à la fois sur « Photos de groupe » et sur « Photos des invités ».",
  );
  await expectNoAxeViolation(page);

  // Export PDF A4 dans les deux variantes.
  for (const [linkName, file] of [
    ["Télécharger le PDF « mariés »", "programme-maries.pdf"],
    ["Télécharger le PDF « prestataires »", "programme-prestataires.pdf"],
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
