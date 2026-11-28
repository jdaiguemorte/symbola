// Lot 74h (UX-09, HUB-28, GC-02, CHR-03, HUB-09 ; D7, G8, G9, G10, G15 ; page 30 des maquettes du lot 68 ;
// spécification du lot 74, § 6.8) — le patron d'un écran de réglage et sa première vague, à 1 440, 911 × 512
// et 375 px, axe-core sur chaque écran. Chaque critère d'acceptation est un test ; abus : une collègue lit les
// rubriques de la titulaire sans commande, B ne voit rien de A.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { setUserNames } from "@symbola/auth";
import { organizationModules } from "@symbola/db/schema/hub";
import { signedInAccount } from "../lib/test-fixtures/session";
import { readyOrganization } from "./helpers";

const SIZES = [
  { name: "1440", width: 1440, height: 900 },
  { name: "911x512", width: 911, height: 512 },
  { name: "375", width: 375, height: 812 },
] as const;
type Size = (typeof SIZES)[number];
type Account = { token: string; organizationId: string; userId: string };

// Les écrans de la vague, leur portée, et s'ils ont une commande à eux.
const WAVE = [
  { path: "/parametres/entreprise", title: "Fiche de l'entreprise", scope: "Pour toute l'agence" },
  { path: "/parametres/mentions", title: "Mentions et logo des documents", scope: "Pour toute l'agence" },
  { path: "/parametres/equipe", title: "Équipe et accès", scope: "Pour toute l'agence" },
  { path: "/parametres/abonnement", title: "Abonnement et modules", scope: "Pour toute l'agence" },
  { path: "/profil", title: "Votre profil et votre connexion", scope: "Pour vous seule" },
  { path: "/parametres/notifications", title: "Vos notifications", scope: "Pour vous seule" },
  { path: "/events/parametres/taches", title: "Tâches : catégories et échéances", scope: "Pour toute l'agence" },
  { path: "/parametres/automatisations", title: "Automatismes : en marche ou coupés", scope: "Pour toute l'agence" },
  { path: "/parametres/radar", title: "Radar des risques : règles et seuils", scope: "Pour toute l'agence" },
  { path: "/parametres/automatisations/rappel-jour-j", title: "Rappel du jour J", scope: "Pour toute l'agence" },
] as const;

async function agency(roles: ("owner" | "member")[] = ["owner"]): Promise<Record<string, Account>> {
  const { sql, db } = createAppConnection();
  try {
    const created = await readyOrganization(db, `Atelier 74h ${randomUUID().slice(0, 6)}`);
    for (const moduleKey of ["events", "budget", "quotes", "vendors", "guests", "appointments"] as const) {
      await db.insert(organizationModules).values({ organizationId: created.id, moduleKey, enabled: true }).onConflictDoUpdate({ target: [organizationModules.organizationId, organizationModules.moduleKey], set: { enabled: true } });
    }
    const accounts: Record<string, Account> = {};
    for (const role of roles) {
      const account = await signedInAccount(db, { organizationId: created.id, role });
      await setUserNames(db, account.userId, { firstName: role === "owner" ? "Camille" : "Bastien", lastName: "Exemple" });
      accounts[role] = { token: account.token, organizationId: created.id, userId: account.userId };
    }
    return accounts;
  } finally {
    await sql.end();
  }
}

async function enter(page: Page, account: Account, size: Size) {
  await page.setViewportSize({ width: size.width, height: size.height });
  const origin = new URL(test.info().project.use.baseURL ?? "http://localhost:3000").origin;
  await page.context().clearCookies();
  await page.context().addCookies([
    { name: "symbola_session", value: account.token, url: origin, httpOnly: true, sameSite: "Lax" },
    { name: "symbola_visites_auto", value: "0", url: origin },
  ]);
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations.map((violation) => [violation.id, violation.nodes.map((node) => node.target)]), null, 1)).toEqual([]);
}

// Les boutons pleins de l'écran (fond de la couleur d'action), au repos.
async function filledButtons(page: Page): Promise<string[]> {
  await page.mouse.move(0, 0);
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--color-primary)";
    document.body.append(probe);
    const primary = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return [...document.querySelectorAll("main button, main a, main summary")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !element.closest("dialog:not([open])") && getComputedStyle(element).backgroundColor === primary;
      })
      .map((element) => (element.textContent ?? "").trim());
  });
}

test.beforeEach(() => {
  test.skip(test.info().project.name !== "desktop", "les trois tailles sont jouées dans le projet « desktop »");
});

test.describe("UX-09 — Patron d'un écran de réglage (lot 74h, critère 1, G8)", () => {
  for (const size of SIZES) {
    test(`chaque écran de la vague a l'en-tête commun et un bouton plein au plus — ${size.name}`, async ({ page }) => {
      test.setTimeout(180_000);
      const { owner } = await agency();
      await enter(page, owner!, size);
      for (const screen of WAVE) {
        await page.goto(screen.path);
        const header = page.locator("header.settings-header");
        await expect(header.getByRole("heading", { level: 1 }), screen.path).toHaveText(screen.title);
        await expect(header.locator(".settings-header-scope"), screen.path).toContainText(screen.scope);
        expect((await filledButtons(page)).length, `${screen.path} : ${(await filledButtons(page)).join(", ")}`).toBeLessThanOrEqual(1);
        await expectNoAxeViolation(page);
      }
    });
  }
});

test.describe("UX-09 — Un réglage isolé s'enregistre seul (lot 74h, critères 2 et 5, D7, G9)", () => {
  for (const size of SIZES) {
    test(`le seuil de « Bientôt » : de 1 à 30, l'erreur sous le champ, « ✓ Enregistré » à côté — ${size.name}`, async ({ page }) => {
      const { owner } = await agency();
      await enter(page, owner!, size);
      await page.goto("/events/parametres/taches");
      const setting = page.getByRole("form", { name: "Échéance proche" });
      const days = setting.getByRole("spinbutton", { name: "Jours avant « Bientôt »" });
      await expect(days).toHaveValue("7");
      // Aucun bouton « Enregistrer » dans une liste de réglages.
      await expect(setting.getByRole("button")).toHaveCount(0);
      await days.fill("45");
      await days.press("Tab");
      await expect(setting.getByText("Entre 1 et 30 jours.")).toBeVisible();
      await expect(days).toHaveAttribute("aria-invalid", "true");
      await expectNoAxeViolation(page);
      await page.reload();
      await expect(days).toHaveValue("7");
      await days.fill("12");
      await days.press("Tab");
      await expect(setting.getByRole("status")).toHaveText("✓ Enregistré");
      await expect(setting.getByText("Entre 1 et 30 jours.")).toHaveCount(0);
      await page.reload();
      await expect(days).toHaveValue("12");
      // Les catégories : « ✓ Enregistré » sur la ligne, « Monter » et « Supprimer… » dans son menu « ⋯ ».
      const name = page.getByLabel("Nom de la catégorie Client");
      await name.fill("Clientes et clients");
      await name.press("Tab");
      await expect(page.getByRole("row").filter({ has: page.getByLabel("Nom de la catégorie Client") }).getByText("✓ Enregistré")).toBeVisible();
      await expect(page.getByRole("button", { name: /^Monter/ })).toHaveCount(0);
      await page.getByLabel("Autres actions pour « Client »").click();
      await expect(page.getByRole("button", { name: "Supprimer… Ses tâches restent, sans catégorie" })).toBeVisible();
      // Échap referme le menu et rend le focus au bouton « ⋯ ».
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Supprimer… Ses tâches restent, sans catégorie" })).toBeHidden();
      await expectNoAxeViolation(page);
    });
  }
});

test.describe("UX-09 — Un formulaire lié s'enregistre par sa barre (lot 74h, critères 3 et 4, D7, G8, G15)", () => {
  for (const size of SIZES) {
    test(`la fiche de l'entreprise : barre toujours visible, champs nommés, question à la sortie, brouillon gardé — ${size.name}`, async ({ page }) => {
      test.setTimeout(120_000);
      const { owner } = await agency();
      await enter(page, owner!, size);
      await page.goto("/parametres/entreprise");
      const bar = page.getByRole("region", { name: "Enregistrement de la page" });
      const inView = async () => {
        const box = (await bar.boundingBox())!;
        const tabbar = await page.locator(".app-tabbar").boundingBox();
        return box.y >= 0 && box.y + box.height <= (tabbar && tabbar.height > 0 ? tabbar.y + 1 : size.height + 1);
      };
      // Toujours visible, sans défiler, au-dessus de la barre du bas du téléphone.
      expect(await inView()).toBe(true);
      await expect(bar.getByRole("status")).toHaveText("Rien à enregistrer");
      // Jamais grisé : sans changement, il le dit.
      const save = bar.getByRole("button", { name: "Enregistrer la fiche" });
      await expect(save).toBeEnabled();
      await save.click();
      await expect(bar.getByRole("status")).toHaveText("Rien à enregistrer : aucune modification.");

      await page.getByLabel("Ville").fill("Annecy-le-Vieux");
      await page.getByLabel("Téléphone").fill("06 00 00 00 01");
      await expect(bar.getByRole("status")).toHaveText("2 modifications à enregistrer : Ville, Téléphone");
      await page.mouse.wheel(0, 2000);
      expect(await inView()).toBe(true);
      await expectNoAxeViolation(page);

      // Quitter avec des changements : la question, dans la barre.
      await page.getByRole("link", { name: /Paramètres/ }).first().click();
      await expect(bar.getByText("Quitter sans enregistrer ?")).toBeVisible();
      await expect(bar).toContainText("Ville, Téléphone");
      await bar.getByRole("button", { name: "Rester sur la page" }).click();
      await expect(page).toHaveURL(/\/parametres\/entreprise/);

      // « Mariages par an » (G15) se change dans la fiche, avec le reste.
      await page.getByLabel("Mariages par an").selectOption({ label: "De 11 à 25" });
      await expect(bar.getByRole("status")).toHaveText("3 modifications à enregistrer : Ville, Téléphone, Mariages par an");
      await save.click();
      await expect(bar.getByRole("status")).toHaveText(/^Tout est enregistré · à \d{1,2}:\d{2}$/, { timeout: 20_000 });
      await page.reload();
      await expect(page.getByLabel("Mariages par an")).toHaveValue("11_to_25");
      await expect(page.getByLabel("Ville")).toHaveValue("Annecy-le-Vieux");

      // Un onglet fermé garde la saisie (brouillon, ADR 0074).
      await page.getByLabel("Ville").fill("Annecy");
      await page.waitForTimeout(1200);
      const again = await page.context().newPage();
      await again.setViewportSize({ width: size.width, height: size.height });
      await page.close({ runBeforeUnload: false });
      await again.goto("/parametres/entreprise");
      await expect(again.getByText(/Brouillon du .* retrouvé/)).toBeVisible();
    });
  }

  test("la fiche vide dit ce qui manque avant le premier devis ; la TVA est une ligne à part, avec sa fenêtre", async ({ page }) => {
    const { owner } = await agency();
    await enter(page, owner!, SIZES[0]);
    await page.goto("/parametres/entreprise");
    const tva = page.getByRole("region", { name: "TVA", exact: true });
    await expect(tva).toContainText("Régime actuel");
    await tva.getByRole("button", { name: "Changer de régime…" }).click();
    await expect(page.getByRole("dialog", { name: "Changer de régime de TVA" }).getByRole("form", { name: "Régime de TVA" })).toBeVisible();
    await expectNoAxeViolation(page);
  });
});

test.describe("HUB-28 — Couper le radar le dit, avec la date et la personne (lot 74h, critères 6 et 7, G10)", () => {
  for (const size of SIZES) {
    test(`« Coupé le … par Camille » dans « Automatismes », en tête des règles, puis « Remettre le radar en marche » — ${size.name}`, async ({ page, browser }) => {
      test.setTimeout(120_000);
      const { owner, member } = await agency(["owner", "member"]);
      await enter(page, owner!, size);
      await page.goto("/parametres/automatisations");
      const radar = page.locator("#automatisme-risk_radar");
      await expect(radar.getByText("En marche", { exact: true })).toBeVisible();
      await radar.getByRole("switch", { name: "Radar des risques : en marche" }).uncheck();
      await expect(radar.getByRole("status").first()).toHaveText("✓ Enregistré");
      await page.reload();
      await expect(radar.getByText("Coupé", { exact: true })).toBeVisible();
      await expect(radar).toContainText(/Coupé le \d{1,2} \S+ par Camille\. Tant qu'il est coupé, aucune alerte n'arrive dans « À traiter en premier »\./);
      await expectNoAxeViolation(page);

      // Une collègue lit l'état et « Seule la titulaire la change », sans interrupteur ni « Remettre en marche ».
      const baseURL = test.info().project.use.baseURL;
      const memberPage = await (await browser.newContext(baseURL ? { baseURL } : {})).newPage();
      await enter(memberPage, member!, size);
      await memberPage.goto("/parametres/automatisations");
      await expect(memberPage.locator(".settings-header-scope")).toContainText("Seule la titulaire la change");
      await expect(memberPage.getByRole("switch")).toHaveCount(0);
      await expect(memberPage.locator("#automatisme-risk_radar")).toContainText("par Camille");
      await memberPage.goto("/parametres/radar");
      await expect(memberPage.getByText(/^À vérifier : le radar est coupé depuis le/)).toBeVisible();
      await expect(memberPage.getByRole("button", { name: "Remettre le radar en marche" })).toHaveCount(0);
      for (const box of await memberPage.getByRole("main").getByRole("checkbox").all()) await expect(box).toBeDisabled();
      await expectNoAxeViolation(memberPage);

      await page.goto("/parametres/radar");
      await expect(page.getByText(/^À vérifier : le radar est coupé depuis le/)).toBeVisible();
      await page.getByRole("button", { name: "Remettre le radar en marche" }).click();
      await expect(page.getByText(/^À vérifier : le radar est coupé/)).toHaveCount(0);
      await page.goto("/parametres/automatisations");
      await expect(radar.getByText("En marche", { exact: true })).toBeVisible();
    });
  }

  test("abus — la coupure de A ne se voit pas dans B", async ({ page, browser }) => {
    const a = await agency();
    const b = await agency();
    await enter(page, a.owner!, SIZES[0]);
    await page.goto("/parametres/automatisations");
    await page.locator("#automatisme-risk_radar").getByRole("switch").uncheck();
    await expect(page.locator("#automatisme-risk_radar").getByRole("status").first()).toHaveText("✓ Enregistré");
    // B dans son propre navigateur : une réponse tardive de A ne renouvelle pas sa session par-dessus.
    const baseURL = test.info().project.use.baseURL;
    const other = await (await browser.newContext(baseURL ? { baseURL } : {})).newPage();
    await enter(other, b.owner!, SIZES[0]);
    await other.goto("/parametres/radar");
    await expect(other.getByRole("heading", { level: 1 })).toHaveText("Radar des risques : règles et seuils");
    await expect(other.getByText(/^À vérifier : le radar est coupé/)).toHaveCount(0);
    await other.goto("/parametres/automatisations");
    await expect(other.locator("#automatisme-risk_radar").getByText("En marche", { exact: true })).toBeVisible();
  });
});
