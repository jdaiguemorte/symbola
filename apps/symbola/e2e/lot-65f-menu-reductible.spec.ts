// Lot 65f — menu latéral réductible (recette staging du 22/11/2026). Sur ordinateur, « Réduire le
// menu » ne garde que les icônes, leur nom en infobulle et comme nom accessible ; le contenu prend la
// largeur libérée ; le choix tient après un rechargement et d'un écran à l'autre. En 375 px, le menu de
// téléphone ne change pas, même si l'appareil a retenu un menu réduit. axe-core dans les deux tailles.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { clickMenuLink, mainMenu, openMenu, readyOrganization, signIn } from "./helpers";

async function planner(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    const email = `planner-lot65f-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId: organization.id, email, role: "owner" });
    return email;
  } finally {
    await sql.end();
  }
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

const width = async (locator: Locator) => (await locator.boundingBox())!.width;

/** L'infobulle d'un lien (son nom) : visible, à droite du menu, ou réduite à un point invisible. */
async function tipBox(link: Locator) {
  return link.locator(".app-nav-label").boundingBox();
}

/** Rien ne recouvre la bulle : en son centre, l'élément du dessus est elle-même. */
async function expectOnTop(tip: Locator) {
  expect(
    await tip.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    }),
  ).toBe(true);
}

/** La bulle est à la hauteur de son lien (centres alignés à 2 px près). */
async function expectBeside(tip: { y: number; height: number }, link: Locator) {
  const box = (await link.boundingBox())!;
  expect(Math.abs(tip.y + tip.height / 2 - (box.y + box.height / 2))).toBeLessThanOrEqual(2);
}

/** Chaque lien et bouton visible du menu mesure au moins 44 px de côté. */
async function expectMenuTargets(sidebar: Locator) {
  const small = await sidebar.evaluate((element) =>
    [...element.querySelectorAll<HTMLElement>("a[href], button")]
      .filter((target) => {
        const box = target.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(target).visibility !== "hidden";
      })
      .filter((target) => {
        const box = target.getBoundingClientRect();
        return box.width < 44 || box.height < 44;
      })
      .map((target) => {
        const box = target.getBoundingClientRect();
        return `${target.tagName} « ${target.textContent?.trim()} » ${Math.round(box.width)}×${Math.round(box.height)}`;
      }),
  );
  expect(small).toEqual([]);
}

test.describe("Lot 65f — Menu latéral réductible", () => {
  test("sur ordinateur, le menu se réduit à ses icônes, garde ses noms et retient le choix", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 768, "Menu de téléphone : parcours en 375 px ci-dessous.");
    test.setTimeout(120_000);
    await signIn(page, await planner(), /\/$/);
    const sidebar = page.locator(".app-sidebar");
    const content = page.locator(".app-main");
    const menu = page.getByRole("navigation", { name: "Menu principal" });
    const contacts = menu.getByRole("link", { name: "Contacts", exact: true });

    // Menu ouvert : le bouton dit ce qu'il fait, l'état est annoncé.
    const collapse = page.getByRole("button", { name: "Réduire le menu" });
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    const openSidebar = await width(sidebar);
    const openContent = await width(content);
    await expect(contacts).toContainText("Contacts");
    await expectMenuTargets(sidebar);
    // Le bouton est une icône : son nom en infobulle, au-dessus de la barre de recherche.
    await collapse.hover();
    const collapseTip = collapse.locator(".app-tip");
    await expect.poll(async () => (await collapseTip.boundingBox())!.width).toBeGreaterThan(40);
    await expect(collapseTip).toHaveText("Réduire le menu");
    await expectOnTop(collapseTip);

    await collapse.click();
    const expand = page.getByRole("button", { name: "Agrandir le menu" });
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => width(sidebar)).toBeLessThan(100);
    // Le contenu prend la largeur libérée.
    await expect.poll(() => width(content)).toBeGreaterThan(openContent + (openSidebar - 100) - 1);

    // Réduit : des icônes de 44 px ; chaque lien garde son nom accessible, le texte n'occupe plus de place.
    await expectMenuTargets(sidebar);
    for (const name of ["Aujourd'hui", "Contacts", "Paramètres", "Aide"]) {
      const link = menu.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      expect((await tipBox(link))!.width).toBeLessThanOrEqual(1);
    }
    await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Symbola" })).toBeVisible();

    // Survol : le nom en infobulle, à droite du menu ; Échap la masque.
    await contacts.hover();
    const box = (await sidebar.boundingBox())!;
    const sidebarRight = box.x + box.width;
    await expect.poll(async () => (await tipBox(contacts))!.width).toBeGreaterThan(40);
    const tip = (await tipBox(contacts))!;
    expect(tip.x).toBeGreaterThanOrEqual(sidebarRight);
    await expectBeside(tip, contacts);
    await expectOnTop(contacts.locator(".app-nav-label"));
    await expect(contacts.locator(".app-nav-label")).toHaveText("Contacts");
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await tipBox(contacts))!.width).toBeLessThanOrEqual(1);

    // Clavier : le focus visible ouvre l'infobulle du lien suivant le bouton.
    await expand.focus();
    await page.keyboard.press("Tab");
    const today = menu.getByRole("link", { name: "Aujourd'hui", exact: true });
    await expect(today).toBeFocused();
    await expect.poll(async () => (await tipBox(today))!.width).toBeGreaterThan(40);
    await expectBeside((await tipBox(today))!, today);
    await expectNoAxeViolation(page);

    // Menu plus haut que la fenêtre, et défilé : la bulle reste en face de son lien.
    await page.setViewportSize({ width: 1280, height: 480 });
    const help = menu.getByRole("link", { name: "Aide", exact: true });
    await help.hover();
    await expect.poll(async () => (await tipBox(help))!.width).toBeGreaterThan(30);
    expect(await sidebar.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expectBeside((await tipBox(help))!, help);
    await page.setViewportSize({ width: 1280, height: 720 });

    // Le choix tient après un rechargement et d'un écran à l'autre, sans clignotement : le serveur
    // rend d'emblée le menu réduit.
    await page.reload();
    await expect(page.getByRole("button", { name: "Agrandir le menu" })).toHaveAttribute("aria-expanded", "false");
    expect(await width(sidebar)).toBeLessThan(100);
    const html = await (await page.request.get("/")).text();
    expect(html).toContain("app-sidebar is-collapsed");
    await contacts.click();
    await expect(page).toHaveURL(/\/contacts/);
    expect(await width(sidebar)).toBeLessThan(100);
    await expectNoAxeViolation(page);

    // Agrandir : les noms reviennent, et le choix tient aussi.
    await page.getByRole("button", { name: "Agrandir le menu" }).click();
    await expect(page.getByRole("button", { name: "Réduire le menu" })).toHaveAttribute("aria-expanded", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: "Réduire le menu" })).toBeVisible();
    await expect.poll(() => width(sidebar)).toBe(openSidebar);
    expect((await tipBox(contacts))!.width).toBeGreaterThan(40);
  });

  test("en 375 px, le menu de téléphone ne change pas, même avec un menu réduit retenu", async ({ page, context }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, "Parcours de téléphone.");
    test.setTimeout(120_000);
    await context.addCookies([{ name: "symbola_menu_reduit", value: "1", domain: "localhost", path: "/", sameSite: "Lax" }]);
    await signIn(page, await planner(), /\/$/);
    await expect(page.getByRole("button", { name: /^(Réduire|Agrandir) le menu$/ })).toBeHidden();
    const toggle = page.getByRole("button", { name: "Menu", exact: true });
    await expect(toggle).toBeVisible();
    expect(await width(page.locator(".app-sidebar"))).toBe(375);
    await openMenu(page);
    const contacts = mainMenu(page).getByRole("link", { name: "Contacts", exact: true });
    await expect(contacts).toBeVisible();
    // Les noms s'affichent à côté des icônes, comme avant le lot 65f.
    expect((await tipBox(contacts))!.width).toBeGreaterThan(40);
    expect((await contacts.boundingBox())!.width).toBeGreaterThan(300);
    await expectNoAxeViolation(page);
    await clickMenuLink(page, "Contacts");
    await expect(page).toHaveURL(/\/contacts/);
  });
});
