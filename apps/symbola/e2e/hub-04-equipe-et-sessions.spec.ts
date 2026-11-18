// Lot 52 (HUB-04, HUB-05, SEC-02 ; D1, D4, D5 ; ADR 0094) — l'écran de l'équipe (inviter un Comptable,
// visibilité des évènements), « Mes sessions » (fermer les autres sessions : refusées à leur requête
// suivante), le bandeau de double authentification d'une Planner, et l'accueil en lecture du Comptable
// (double authentification exigée, écrans de la planner refusés). En taille ordinateur et en 375 px,
// axe-core.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { readyOrganization, signIn } from "./helpers";

async function team() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`)).id;
    const make = async (role: "owner" | "member" | "accountant", label: string) => {
      const email = `${label}-${randomUUID()}@symbola.test`;
      await createUser(db, { organizationId, email, role });
      return email;
    };
    return { organizationId, owner: await make("owner", "camille"), planner: await make("member", "lea"), accountant: await make("accountant", "compta") };
  } finally {
    await sql.end();
  }
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test.describe("HUB-04 — Équipe : inviter un Comptable, visibilité des évènements", () => {
  test("la Propriétaire invite un Comptable et coupe « toutes les Planners voient tout »", async ({ page }) => {
    test.setTimeout(90_000);
    const t = await team();
    await signIn(page, t.owner);
    await page.goto("/parametres/equipe");
    await expect(page.getByRole("heading", { name: "Équipe", level: 1 })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Comptable" })).toBeVisible();
    await expectNoAxeViolation(page);
    const invited = `expert-${randomUUID()}@symbola.test`;
    await page.getByLabel("Adresse e-mail").fill(invited);
    await page.getByLabel("Comptable").check();
    await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
    await expect(page.getByText(`${invited} (Comptable)`)).toBeVisible();
    const toggle = page.getByLabel("Toutes les Planners voient tous les évènements");
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Réglage enregistré." })).toBeVisible();
    await expect(page.getByLabel("Toutes les Planners voient tous les évènements")).not.toBeChecked();
  });
});

test.describe("HUB-05 — Mes sessions", () => {
  test("l'utilisateur voit chacune de ses sessions et ferme les autres ; elles sont refusées à leur requête suivante", async ({ page, browser }) => {
    test.setTimeout(90_000);
    const t = await team();
    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const otherPage = await other.newPage();
    await signIn(otherPage, t.planner);
    await signIn(page, t.planner);
    await page.goto("/securite");
    await expect(page.getByRole("heading", { name: "Mes sessions" })).toBeVisible();
    await expect(page.getByText("Cet appareil")).toBeVisible();
    await expect(page.getByText("Symbola ne garde ni l'adresse IP ni la ville")).toBeVisible();
    await expectNoAxeViolation(page);
    await page.getByRole("button", { name: /Fermer l'autre session|Fermer les \d+ autres sessions/ }).click();
    await expect(page.getByRole("status").filter({ hasText: /session(s)? fermée/ })).toBeVisible();
    await otherPage.goto("/");
    await expect(otherPage).toHaveURL(/\/login/);
    await other.close();
  });
});

test.describe("SEC-02 (D5) — Double authentification proposée aux Planners", () => {
  test("une Planner sans second facteur voit le bandeau ; « Plus tard » le ferme", async ({ page }) => {
    test.setTimeout(90_000);
    const t = await team();
    await signIn(page, t.planner);
    await page.goto("/");
    const banner = page.getByRole("complementary", { name: "Double authentification" });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("link", { name: "Sécuriser mon compte" })).toBeVisible();
    await banner.getByRole("button", { name: "Plus tard" }).click();
    await expect(page.getByRole("complementary", { name: "Double authentification" })).toHaveCount(0);
  });
});

test.describe("HUB-04 — Le Comptable, en lecture seule", () => {
  test("se connecte avec sa double authentification, arrive sur sa comptabilité ; les écrans de la planner le renvoient", async ({ page }) => {
    test.setTimeout(90_000);
    const t = await team();
    await signIn(page, t.accountant, /\/comptable/);
    await expect(page.getByRole("heading", { name: /Comptabilité de/ })).toBeVisible();
    await expect(page.getByText("Lecture seule", { exact: true })).toBeVisible();
    await expectNoAxeViolation(page);
    for (const path of ["/events", "/contacts", "/parametres", "/parametres/equipe"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/comptable/);
    }
    await page.goto("/devis/encaissements");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Réglages/ })).toHaveCount(0);
  });
});
