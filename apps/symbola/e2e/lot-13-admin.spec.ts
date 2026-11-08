// Lot 13 (HUB-17, HUB-18) — console d'Administration : menu latéral distinct,
// vue d'ensemble (services, chiffres, « À faire », tendance), dernière
// sauvegarde signalée par le script de sauvegarde, page Santé détaillée.
// Toujours aucune donnée métier (ADR 0029). Ordinateur et 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import postgres from "postgres";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { createProspect, createProspectSource } from "../modules/events/service";
import { openMenu, readyOrganization } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Le script de sauvegarde écrit avec le rôle d'administration de PostgreSQL ;
// le rôle applicatif ne fait que lire (HUB-18).
function adminSql() {
  return postgres({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? "symbola",
    username: process.env.POSTGRES_ADMIN_USER ?? "postgres",
    password: process.env.POSTGRES_ADMIN_PASSWORD!,
    max: 1,
  });
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
}

test("HUB-17 / HUB-18 — console d'Administration : vue d'ensemble, dernière sauvegarde, Santé", async ({ page }) => {
  const adminEmail = `admin-console-${randomUUID()}@symbola.test`;
  const secretName = `Mariage secret ${randomUUID()}`;
  const organizationName = `Org console ${randomUUID()}`;
  const { sql, db } = createAppConnection();
  try {
    await createUser(db, { organizationId: null, email: adminEmail, password: "mot-de-passe-admin-console", role: "admin" });
    const organization = await readyOrganization(db, organizationName);
    const owner = await createUser(db, { organizationId: organization.id, email: `titulaire-console-${randomUUID()}@symbola.test`, password: "mot-de-passe-titulaire-console", role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    await createProspect({ organizationId: organization.id, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: secretName }] });
  } finally {
    await sql.end();
  }
  const admin = adminSql();
  const runs: string[] = [];
  try {
    const [done] = await admin<[{ id: string }]>`
      insert into hub.backup_runs (started_at, finished_at, status, size_bytes)
      values (now() - interval '2 hours', now() - interval '1 hour 50 minutes', 'succeeded', 73400320) returning id`;
    runs.push(done.id);

    // L'Admin arrive sur la console, avec son propre menu.
    await login(page, adminEmail, "mot-de-passe-admin-console");
    await expect(page).toHaveURL("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vue d'ensemble");
    await openMenu(page);
    const menu = page.getByRole("navigation", { name: "Menu de l'Administration" });
    await expect(menu.getByRole("link", { name: "Vue d'ensemble" })).toHaveAttribute("aria-current", "page");
    await expect(menu.getByRole("link", { name: "Organisations" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Menu principal" })).toHaveCount(0);
    // Sur téléphone, le menu se replie pour laisser voir la vue d'ensemble.
    const toggle = page.locator('button[aria-controls="app-menu"]');
    if (await toggle.isVisible()) await toggle.click();

    await expect(page.getByRole("status").filter({ hasText: /services/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Chiffres de toutes les organisations" })).toContainText("Événements créés ce mois");
    const todo = page.getByRole("region", { name: "À faire" });
    await expect(todo.getByRole("listitem").filter({ hasText: "Dernière sauvegarde" })).toContainText("Faite le");
    await expect(page.getByRole("img", { name: /Événements créés par mois/ })).toBeVisible();
    // Aucune donnée métier : ni le nom d'un marié, ni un montant.
    await expect(page.getByText(secretName)).toHaveCount(0);
    await expectNoAxeViolation(page);

    // Une sauvegarde qui échoue passe en alerte.
    const [failed] = await admin<[{ id: string }]>`
      insert into hub.backup_runs (started_at, finished_at, status) values (now(), now(), 'failed') returning id`;
    runs.push(failed.id);
    await page.reload();
    await expect(page.getByRole("region", { name: "À faire" }).getByRole("listitem").filter({ hasText: "Dernière sauvegarde" })).toContainText("Échec le");

    // Santé : chaque service, et le détail de la dernière sauvegarde.
    await page.goto("/admin/health");
    await expect(page.getByRole("row", { name: /Base de données/ })).toContainText("en ligne");
    await expect(page.getByRole("row", { name: /Stockage des fichiers/ })).toBeVisible();
    const backup = page.getByRole("region", { name: "Dernière sauvegarde" });
    await expect(backup).toContainText("Échec");
    await expectNoAxeViolation(page);

    // Organisations en tableau : recherche par nom, une ligne ouvre son panneau
    // (modules, comptes, prise en main), toujours sans donnée métier.
    await page.goto("/admin/organisations");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Organisations");
    await page.getByRole("search", { name: "Chercher une organisation" }).getByLabel("Rechercher par nom").fill(organizationName);
    await expect(page).toHaveURL(/q=/);
    const table = page.getByRole("region", { name: "Toutes les organisations" });
    await expect(table.getByRole("row")).toHaveCount(2);
    const row = table.getByRole("row", { name: new RegExp(organizationName) });
    await expect(row).toContainText("Événements");
    await row.getByRole("link", { name: organizationName }).click();
    const panel = page.getByRole("complementary", { name: organizationName });
    // Lot 16 (ARC-01) : le bouton nomme le module dans la langue de l'écran.
    await expect(panel.getByRole("button", { name: /Événements : activé/ })).toBeVisible();
    await expect(panel).toContainText("titulaire");
    await expect(page.getByText(secretName)).toHaveCount(0);
    await expectNoAxeViolation(page);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await page.getByRole("link", { name: "Nouvelle organisation" }).click();
    await expect(page.getByRole("complementary", { name: "Créer une organisation" }).getByRole("button", { name: "Créer et inviter" })).toBeVisible();
  } finally {
    if (runs.length > 0) await admin`delete from hub.backup_runs where id in ${admin(runs)}`;
    await admin.end();
  }
});

test("HUB-17 — la console est réservée à l'Admin", async ({ page }) => {
  const email = `titulaire-sans-console-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-sans-console", role: "owner" });
  } finally {
    await sql.end();
  }
  await login(page, email, "mot-de-passe-sans-console");
  await expect(page).toHaveURL("/");
  for (const path of ["/admin", "/admin/organisations", "/admin/health"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/");
  }
});
