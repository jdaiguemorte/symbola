// Lot 65a (UX-13, HUB-08 ; recette staging du 22/11/2026, retours 1 à 3) — défauts visuels :
// - dans un formulaire en grille, les champs d'une même rangée sont alignés, même quand un libellé
//   tient sur deux lignes ; un libellé ajusté (`field-fit`) ne déborde pas sur la colonne voisine ;
// - dans le panneau des réglages, l'aide de l'écran est un bloc repliable en tête du panneau : elle
//   n'ouvre pas un second panneau par-dessus.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { openSettingsTab, readyOrganization, signIn } from "./helpers";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;

async function planner() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    const email = `planner-65a-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId, email, password: "mot-de-passe-lot-65a", role: "owner" });
    return { email };
  } finally {
    await sql.end();
  }
}

// Pour chaque formulaire en grille : les champs dont les libellés commencent à la même hauteur (une
// rangée) commencent eux aussi à la même hauteur ; aucun libellé ne déborde de sa case.
async function gridDefects(page: Page) {
  return page.evaluate(() => {
    const defects: string[] = [];
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    for (const grid of document.querySelectorAll("form.form-grid, div.form-grid")) {
      const labels = [...grid.children].filter((child): child is HTMLLabelElement => child instanceof HTMLLabelElement && visible(child) && !child.querySelector(':scope > input[type="checkbox"], :scope > input[type="radio"]'));
      const rows = new Map<number, number[]>();
      for (const label of labels) {
        const field = label.querySelector("input, select, textarea");
        if (!field || !visible(field)) continue;
        const top = Math.round(label.getBoundingClientRect().top);
        rows.set(top, [...(rows.get(top) ?? []), field.getBoundingClientRect().top]);
      }
      for (const [top, fields] of rows) {
        if (fields.length > 1 && Math.max(...fields) - Math.min(...fields) > 2) defects.push(`rangée à ${top} px : champs décalés de ${Math.round(Math.max(...fields) - Math.min(...fields))} px`);
      }
    }
    for (const label of document.querySelectorAll("label.field-fit")) {
      const parent = label.parentElement;
      if (!parent || !visible(label)) continue;
      if (label.getBoundingClientRect().right > parent.getBoundingClientRect().right + 1) defects.push(`libellé « ${(label.textContent ?? "").trim().slice(0, 40)} » hors de sa case`);
    }
    return defects;
  });
}

test("UX-13 — Les champs d'une rangée sont alignés ; un libellé ajusté reste dans sa case (65a)", async ({ page }) => {
  test.setTimeout(90_000);
  const setup = await planner();
  await signIn(page, setup.email);
  await page.goto("/devis/parametres");
  await expect(page.getByRole("heading", { name: "Clients professionnels" })).toBeVisible();
  expect(await gridDefects(page)).toEqual([]);
  await openSettingsTab(page, "Mentions et logo");
  expect(await gridDefects(page)).toEqual([]);
});

test("UX-13 — Dans le panneau des réglages, l'aide se déplie en tête du panneau, sans second panneau (65a)", async ({ page }) => {
  test.setTimeout(90_000);
  const setup = await planner();
  await signIn(page, setup.email);
  await page.goto("/devis");
  await page.getByRole("link", { name: /Réglages/ }).first().click();
  const panel = page.getByRole("complementary", { name: "Réglages" });
  await expect(panel).toBeVisible();
  const help = panel.locator("details.settings-panel-help");
  await expect(help).toHaveCount(1);
  await help.locator("summary").click();
  await expect(help).toHaveAttribute("open", "");
  // Un seul panneau à droite : pas de tiroir d'aide par-dessus.
  await expect(page.getByRole("complementary")).toHaveCount(1);
  expect(await gridDefects(page)).toEqual([]);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
  if (isPhone(page)) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});
