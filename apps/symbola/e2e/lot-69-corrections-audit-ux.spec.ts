// Lot 69 (UX-05, UX-10, UX-14, UX-15, NFR-17 ; corrections simples de l'audit UX, lot 68) — les
// défauts d'affichage sont mesurés par les boîtes des éléments, sans capture d'image : champ « Où ? »
// du carnet (C-43), menu latéral (C-13), tableaux du budget et de l'équipe (C-49, C-75), astérisque
// (C-25), « ⌘K » et « touche N » (C-81), cartes du budget en 375 px (C-78) ; puis les deux comportements :
// phrase des modèles de rétroplanning (C-39) et tableau de relance relu (C-50). Tailles : ordinateur et
// 375 px (projets Playwright) ; les mesures propres à une taille se règlent par `setViewportSize`.
import { randomUUID } from "node:crypto";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { updateBudgetLine } from "../modules/budget/service";
import { vendorCatalogInput } from "../lib/vendors/catalog";
import {
  addDefaultVendorSlots,
  addEventTask,
  addStandaloneTask,
  addVendorCandidate,
  createProspect,
  createProspectSource,
  listEventVendorSlots,
} from "../modules/events/service";
import {
  createVendor,
  listVendorTypes,
  seedStarterVendorCatalog,
} from "../modules/vendors/service";
import { readyOrganization, signIn } from "./helpers";

const LONG_EMAIL =
  "une-adresse-vraiment-longue-pour-la-collegue-de-camille@exemple-de-test-symbola.test";

async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (
      await readyOrganization(db, `Atelier ${randomUUID()}`)
    ).id;
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, {
      organizationId,
      email,
      password: "mot-de-passe-lot69-e2e",
      role: "owner",
    });
    await createUser(db, {
      organizationId,
      email: `${randomUUID().slice(0, 8)}-${LONG_EMAIL}`,
      password: "mot-de-passe-lot69-e2e-2",
      role: "member",
    });
    await seedStarterVendorCatalog(organizationId, vendorCatalogInput("fr"), {
      withTypes: true,
    });
    const types = await listVendorTypes(organizationId);
    const vendor = await createVendor(organizationId, {
      name: "Studio Lumière",
      typeIds: [types[0]!.id],
      city: "Lyon",
    });
    // Deux tâches en retard quel que soit le jour du test : la pastille « 2 en retard » du menu.
    await addStandaloneTask(organizationId, {
      label: "Déclaration de TVA",
      dueDate: "2026-01-20",
      recurrence: null,
    });
    await addStandaloneTask(organizationId, {
      label: "Assurance",
      dueDate: "2026-01-21",
      recurrence: null,
    });
    await addDefaultVendorSlots(organizationId, ["Traiteur", "Fleurs"]);
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({
      organizationId,
      createdByUserId: owner.id,
      prospectSourceId: source.id,
      clients: [{ firstName: "Léa", lastName: "Martin" }],
      eventDate: "2027-06-12",
    });
    const [caterer] = await listEventVendorSlots(organizationId, event.id);
    await addVendorCandidate({
      organizationId,
      eventId: event.id,
      vendorSlotId: caterer!.id,
      vendorName: vendor.vendor.name,
      vendorId: vendor.vendor.id,
    });
    await updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId: caterer!.id, field: "estimated", amountCents: 1087100, changedByUserId: owner.id });
    // Un évènement sans tâche, un autre avec : la phrase des modèles de rétroplanning (C-39).
    const bare = await createProspect({
      organizationId,
      createdByUserId: owner.id,
      prospectSourceId: source.id,
      clients: [{ firstName: "Inès" }],
      eventDate: "2027-09-04",
    });
    await addEventTask(organizationId, event.id, {
      label: "Visiter la salle",
      dueDate: "2027-01-10",
      responsible: "planner",
    });
    return { email, eventId: event.id, bareEventId: bare.id };
  } finally {
    await sql.end();
  }
}

const box = async (locator: Locator) => (await locator.boundingBox())!;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("lot 69 — mises en page mesurées", () => {
  let setup: Awaited<ReturnType<typeof atelier>>;
  test.beforeEach(async ({ page }) => {
    setup = await atelier();
    await signIn(page, setup.email, /\/$/);
  });

  test("C-43 — le champ « Où ? » du carnet est assez large, sur la ligne de « dans un rayon de », sans fond de carte", async ({
    page,
  }) => {
    await page.goto("/prestataires");
    const where = page.locator("fieldset.filter-where");
    const input = where.locator('input[name="autour"]');
    const radius = where.locator('select[name="rayon"]');
    const width = page.viewportSize()!.width;
    const field = await box(input);
    expect(field.height).toBeGreaterThanOrEqual(36);
    expect(field.height).toBeLessThanOrEqual(48);
    if (width >= 768) {
      expect(field.width).toBeGreaterThanOrEqual(160);
      expect(Math.abs((await box(radius)).y - field.y)).toBeLessThan(16);
      expect(
        await where.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      ).toBe("rgba(0, 0, 0, 0)");
    } else {
      // Téléphone : les contrôles occupent la largeur de la fenêtre, sans dépasser.
      expect(field.x + field.width).toBeLessThanOrEqual(width);
      expect(field.width).toBeGreaterThanOrEqual(width * 0.4);
    }
    await expectNoHorizontalOverflow(page);
  });

  test("C-13 — la pastille « en retard » du menu tient sur une ligne, l'adresse du compte se lit en entier", async ({
    page,
  }) => {
    test.skip(
      page.viewportSize()!.width < 768,
      "le menu est replié sur téléphone",
    );
    await page.goto("/taches");
    const count = page.locator(".app-sidebar .nav-count").first();
    await expect(count).toContainText("2");
    expect((await box(count)).height).toBeLessThanOrEqual(28);
    // Lot 70e (M7) : le compte est dans la barre du haut ; son menu lit l'adresse en entier.
    await page.locator(".account-menu-button").click();
    const email = page.locator(".account-menu-identity > span").first();
    expect(
      await email.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });

  for (const width of [1280, 1366]) {
    test(`C-49 — la ligne d'un poste du budget tient dans le cadre en ${width} px`, async ({
      page,
    }) => {
      test.skip(
        page.viewportSize()!.width < 768,
        "mesure propre à l'ordinateur",
      );
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/events/${setup.eventId}?onglet=budget`);
      const wrap = page
        .locator(".list-table-wrap")
        .filter({ has: page.locator("table.budget-vendors") });
      await expect(wrap).toBeVisible();
      expect(
        await wrap.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
      const frame = await box(wrap);
      for (const button of await wrap.locator("td.actions button:visible").all()) {
        const rect = await box(button);
        expect(rect.x + rect.width).toBeLessThanOrEqual(
          frame.x + frame.width + 1,
        );
      }
    });

    test(`C-75 — le tableau de l'équipe se lit sans défilement horizontal en ${width} px`, async ({
      page,
    }) => {
      test.skip(
        page.viewportSize()!.width < 768,
        "mesure propre à l'ordinateur",
      );
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/parametres/equipe");
      const wrap = page.locator(".list-table-wrap").first();
      await expect(wrap).toBeVisible();
      await expect(
        wrap.getByText(LONG_EMAIL, { exact: false }).first(),
      ).toBeVisible();
      expect(
        await wrap.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
    });
  }

  test("C-25 — l'astérisque d'un champ obligatoire est sur la ligne de son libellé", async ({
    page,
  }) => {
    await page.goto("/events/new");
    const mark = page.locator("label .required-mark").first();
    await expect(mark).toBeVisible();
    const gap = await mark.evaluate((element) => {
      const label = element.closest("label")!;
      const range = document.createRange();
      range.selectNodeContents(
        [...label.childNodes].find(
          (node) =>
            node.nodeType === Node.TEXT_NODE &&
            (node.textContent ?? "").trim() !== "",
        )!,
      );
      return Math.abs(
        element.getBoundingClientRect().top - range.getBoundingClientRect().top,
      );
    });
    expect(gap).toBeLessThan(8);
  });

  test("C-81 — « ⌘K » et « Touche N pour ouvrir ce menu » ne s'affichent que sur ordinateur", async ({
    page,
  }) => {
    await page.goto("/");
    const wide = page.viewportSize()!.width >= 768;
    const shortcut = page.locator(".search-box-shortcut").first();
    if (wide) await expect(shortcut).toBeVisible();
    else await expect(shortcut).toBeHidden();
    if (!wide) {
      // Le menu est replié : on l'ouvre avant d'atteindre « Créer ».
      const toggle = page.getByRole("button", { name: /menu/i }).first();
      if (await toggle.isVisible()) await toggle.click();
    }
    await page
      .getByRole("button", { name: "Créer", exact: true })
      .first()
      .click();
    const hint = page.getByText("Touche N pour ouvrir ce menu");
    if (wide) await expect(hint).toBeVisible();
    else await expect(hint).toBeHidden();
  });

  test("C-78 — en 375 px, les montants des cartes du budget sont dans la fenêtre", async ({
    page,
  }) => {
    test.skip(page.viewportSize()!.width > 400, "mesure propre au téléphone");
    await page.goto(`/events/${setup.eventId}?onglet=budget`);
    const table = page.locator("table.budget-vendors");
    await expect(table).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const width = page.viewportSize()!.width;
    for (const cell of await table.locator("td[data-label]").all()) {
      const rect = await box(cell);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width);
    }
  });

  test("C-39 — « Aucun modèle de rétroplanning » ne s'affiche que sur un évènement sans tâche", async ({
    page,
  }) => {
    await page.goto(`/events/${setup.bareEventId}?onglet=retroplanning`);
    await expect(
      page.getByText("Aucun modèle de rétroplanning pour l'instant."),
    ).toBeVisible();
    await page.goto(`/events/${setup.eventId}?onglet=retroplanning`);
    await expect(page.getByText("Visiter la salle").first()).toBeVisible();
    await expect(
      page.getByText("Aucun modèle de rétroplanning pour l'instant."),
    ).toHaveCount(0);
  });

  test("C-50 — « Relance notée » : le tableau de la fenêtre du poste montre aussitôt la date de la relance", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto(`/events/${setup.eventId}?onglet=budget`);
    await page
      .getByRole("button", { name: /^Ouvrir/ })
      .first()
      .click();
    const comparison = page.getByRole("table", {
      name: /^Comparaison des prestataires de/,
    });
    await expect(comparison).toBeVisible();
    await expect(
      comparison.getByRole("row", { name: /Dernière relance/ }),
    ).toContainText("—");
    await comparison
      .getByRole("button", { name: /^Noter une relance/ })
      .click();
    const dialog = page.getByRole("dialog", { name: /^Relance de/ });
    await dialog.getByRole("radio", { name: "E-mail" }).check();
    await dialog.getByRole("button", { name: "Noter la relance" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    const row = comparison.getByRole("row", { name: /Dernière relance/ });
    await expect(row).toContainText("E-mail");
    await expect(row).not.toHaveText(/^Dernière relance\s*—\s*$/);
  });

  test("C-59 — sur /import?type=X, seule la tuile de X est marquée, et aucune quand X n'est pas une tuile", async ({ page }) => {
    const borders = async () => page.locator(".import-tile").evaluateAll((tiles) => tiles.map((tile) => getComputedStyle(tile).borderTopColor));
    await page.goto("/import?type=budget_lines");
    await expect(page.locator(".import-tile")).not.toHaveCount(0);
    await expect(page.locator('.import-tile[aria-current="true"]')).toHaveCount(0);
    expect(new Set(await borders()).size).toBe(1);
    await page.goto("/import?type=contacts");
    await expect(page.locator('.import-tile[aria-current="true"]')).toHaveCount(1);
    await expect(page.locator('.import-tile[aria-current="true"]')).toContainText("contacts");
  });
});
