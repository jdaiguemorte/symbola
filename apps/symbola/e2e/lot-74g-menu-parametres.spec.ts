// Lot 74g (G1, G2, G5, G7, G11, G12, C-72, C-79, C-82 ; pages 29 et 31 des maquettes du lot 68) — le
// menu des Paramètres et le menu latéral, à 1 440 × 900, 911 × 512 (1 366 px à 150 %), 375 et 360 px.
// La session est ouverte en base (lib/test-fixtures/session.ts) : la connexion n'est pas ce qui est
// testé ici, et le parcours se rejoue ainsi sur un autre port que celui du fournisseur d'identité.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { organizationModules } from "@symbola/db/schema/hub";
import fr from "@symbola/i18n/messages/fr.json";
import { signedInAccount } from "../lib/test-fixtures/session";
import { settingsMenu, yourDataLines, type SettingsMenuFlags } from "../app/settings-menu";
import { readyOrganization } from "./helpers";

const SIZES = [
  { name: "1440", width: 1440, height: 900 },
  { name: "911x512", width: 911, height: 512 },
  { name: "375", width: 375, height: 812 },
  { name: "360", width: 360, height: 780 },
] as const;
const ALL: SettingsMenuFlags = { events: true, budget: true, quotes: true, vendors: true, guests: true, appointments: true, isOwner: true, selfService: false };
const MODULES = ["events", "budget", "quotes", "vendors", "guests", "appointments"] as const;
const menu = (fr as unknown as { SettingsMenu: Record<string, Record<string, { label: string }>> }).SettingsMenu;
const label = (key: string) => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], menu) as string;

type Account = { token: string; organizationId: string; name: string };

async function organization(modules: Partial<Record<(typeof MODULES)[number], boolean>> = {}, roles: ("owner" | "member" | "accountant")[] = ["owner"]) {
  const { sql, db } = createAppConnection();
  try {
    const name = `Atelier 74g ${randomUUID().slice(0, 6)}`;
    const created = await readyOrganization(db, name);
    for (const moduleKey of MODULES) {
      const enabled = modules[moduleKey] ?? true;
      await db.insert(organizationModules).values({ organizationId: created.id, moduleKey, enabled }).onConflictDoUpdate({ target: [organizationModules.organizationId, organizationModules.moduleKey], set: { enabled } });
    }
    const accounts: Record<string, Account> = {};
    for (const role of roles) accounts[role] = { token: (await signedInAccount(db, { organizationId: created.id, role })).token, organizationId: created.id, name };
    return accounts;
  } finally {
    await sql.end();
  }
}

async function enter(page: Page, account: Account, size: (typeof SIZES)[number]) {
  await page.setViewportSize({ width: size.width, height: size.height });
  const origin = new URL(test.info().project.use.baseURL ?? "http://localhost:3000").origin;
  // Une seule session à la fois : celle que l'app a pu reposer pour un autre compte part d'abord.
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

// Une seule fois par taille : le projet « desktop » porte les quatre tailles (les autres projets passent).
test.beforeEach(() => {
  test.skip(test.info().project.name !== "desktop", "les quatre tailles sont jouées dans le projet « desktop »");
});

test.describe("74g (G1, G2) — L'accueil des Paramètres", () => {
  for (const size of SIZES) {
    test(`huit groupes, 38 rubriques, « Vos données » à part — ${size.name}`, async ({ page }) => {
      const { owner } = await organization();
      await enter(page, owner!, size);
      await page.goto("/parametres");
      await expect(page.getByRole("heading", { level: 1, name: "Paramètres" })).toBeVisible();
      await expect(page.locator(".settings-home-group")).toHaveCount(8);
      await expect(page.locator(".settings-home-link")).toHaveCount(38);
      await expect(page.getByText("38 rubriques en 8 groupes")).toBeVisible();
      await expect(page.getByRole("link", { name: "Ouvrir « Vos données »" })).toBeVisible();
      // « Chercher un réglage » reste sur l'accueil jusqu'au lot 74k (choix de la session d'audit, 28/11).
      await page.getByRole("searchbox", { name: "Chercher un réglage" }).fill("prestataires");
      await expect(page.locator(".settings-home-link")).toHaveCount(5);
      await page.getByRole("searchbox", { name: "Chercher un réglage" }).fill("");
      await expectNoAxeViolation(page);
    });
  }

  test("un groupe d'un module non souscrit disparaît ; « titulaire » marque ce que l'équipe lit sans le changer", async ({ page, browser }) => {
    const { owner, member } = await organization({ quotes: false, appointments: false }, ["owner", "member"]);
    await enter(page, owner!, SIZES[0]);
    await page.goto("/parametres");
    await expect(page.locator(".settings-home-group h2")).toHaveText(["Votre entreprise", "Vous", "Évènements", "Tâches, programme et jour J", "Budget et prestataires", "Messages et automatismes"]);
    // Le membre dans une fenêtre à lui : aucune session de la titulaire ne peut s'y mêler.
    const baseURL = test.info().project.use.baseURL;
    const memberContext = await browser.newContext(baseURL ? { baseURL } : {});
    page = await memberContext.newPage();
    await enter(page, member!, SIZES[0]);
    await page.goto("/parametres");
    const owned = page.locator(".settings-home-link", { has: page.locator(".settings-owner-tag") }).locator(".settings-home-label");
    await expect(owned).toHaveText(["Prestataires par lien", "Adresse d'envoi et réponses", "Automatismes : en marche ou coupés", "Radar des risques : règles et seuils"]);
    // Les rubriques gardées par la titulaire restent hors du menu de l'équipe, comme avant le lot 74g.
    await expect(page.locator(".settings-home-label", { hasText: "Équipe et accès" })).toHaveCount(0);
    await expect(page.locator(".settings-home-label", { hasText: "Demandes : étapes et formulaire de contact" })).toHaveCount(0);
  });
});

// Les rubriques dont le premier réglage reste sous le premier écran, avant leur passage au patron (en-tête
// d'une ligne, lots 74h à 74j) : leur texte d'introduction ou une carte d'information le précède. Écart
// noté dans la PR ; la liste ne peut que diminuer.
const FIRST_SCREEN_PENDING: Record<string, { sizes: string[]; lot: string }> = {
  "/parametres/equipe": { sizes: ["911x512"], lot: "74h" },
  "/events/parametres/etapes": { sizes: ["911x512"], lot: "74i" },
  "/parametres/adresse-envoi": { sizes: ["911x512", "375", "360"], lot: "74j" },
};
// Un écran sans aucune commande tant qu'il est vide (on crée un modèle d'évènement depuis la fiche d'un
// évènement) : son message d'écran vide est son premier élément.
const NO_CONTROL_WHEN_EMPTY = ["/events/modeles-evenement"];

test.describe("74g (critères 3 et 5, C-72, C-79) — Chaque rubrique : son titre, son premier réglage", () => {
  const rubrics = settingsMenu(ALL).flatMap((group) => group.items);
  for (const size of SIZES) {
    test(`les 38 rubriques — ${size.name}`, async ({ page }) => {
      test.setTimeout(240_000);
      expect(rubrics).toHaveLength(38);
      const { owner } = await organization();
      await enter(page, owner!, size);
      const failures: string[] = [];
      for (const rubric of rubrics) {
        await page.goto(rubric.href);
        const title = page.getByRole("heading", { level: 1 });
        // Le titre est le libellé du menu, mot pour mot (« Abonnement et modules » ouvre « Tous les modules »
        // sans le libre-service : son écran garde son titre).
        if (rubric.href !== "/apps") await expect(title, rubric.href).toHaveText(label(rubric.label));
        const box = await page.evaluate(() => {
          const heading = document.querySelector("main h1")!.getBoundingClientRect();
          const visible = (element: Element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && !element.closest("[hidden], .sr-only, .help-drawer");
          };
          const controls = [...document.querySelectorAll("main input:not([type='hidden']), main select, main textarea, main button, main summary, main [role='switch'], main a.button-link")].filter(visible).filter((element) => element.getBoundingClientRect().top >= heading.top);
          return { titleTop: heading.top, title: heading.bottom, control: controls[0]?.getBoundingClientRect().top ?? null, height: window.innerHeight };
        });
        // Sur téléphone, le titre à 150 px du haut au plus (G12) ; partout, entier dans le premier écran.
        if (box.title > box.height || (size.width < 768 && box.titleTop > 150)) failures.push(`${rubric.href} : titre à ${Math.round(box.titleTop)} px`);
        const pending = FIRST_SCREEN_PENDING[rubric.href]?.sizes.includes(size.name) ?? false;
        const below = box.control === null ? !NO_CONTROL_WHEN_EMPTY.includes(rubric.href) : box.control >= box.height;
        if (below !== pending) failures.push(`${rubric.href} : premier réglage à ${box.control === null ? "—" : Math.round(box.control)} px (écran de ${box.height} px)${pending ? ", attendu sous l'écran jusqu'au lot " + FIRST_SCREEN_PENDING[rubric.href]!.lot : ""}`);
      }
      expect(failures).toEqual([]);
    });
  }

  test("sous 1 100 px, la rubrique s'ouvre seule avec « ‹ Paramètres · groupe » ; à 1 440 px, le menu de son groupe", async ({ page }) => {
    const { owner } = await organization();
    await enter(page, owner!, SIZES[2]);
    await page.goto("/events/modeles");
    await expect(page.getByRole("navigation", { name: "Rubriques des paramètres" })).toHaveCount(0);
    await page.getByRole("link", { name: "Paramètres · Tâches, programme et jour J" }).click();
    await expect(page).toHaveURL(/\/parametres#groupe-planning$/);
    await enter(page, owner!, SIZES[0]);
    await page.goto("/events/modeles");
    const nav = page.getByRole("navigation", { name: "Rubriques des paramètres" });
    await expect(nav.getByRole("link", { name: "Rétroplanning : modèles" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("list", { name: "Rubriques du groupe Tâches, programme et jour J" }).getByRole("listitem")).toHaveCount(4);
    await expect(nav.getByRole("link", { name: "Tous les paramètres" })).toBeVisible();
    // Le menu tient dans l'écran sans défiler avec la page.
    const bottom = await nav.evaluate((element) => element.getBoundingClientRect().bottom);
    expect(bottom).toBeLessThanOrEqual(900);
    await expectNoAxeViolation(page);
  });
});

test.describe("74g (G11, C-82) — Le menu latéral à pied tenu", () => {
  for (const size of SIZES.slice(0, 2)) {
    test(`toutes les entrées dans la fenêtre, « Aide » en bas — ${size.name}`, async ({ page }) => {
      const { owner } = await organization();
      await enter(page, owner!, size);
      await page.goto("/");
      const sidebar = page.locator(".app-sidebar");
      await expect(sidebar.getByRole("link", { name: "Apps", exact: true })).toHaveCount(0);
      await expect(sidebar.getByRole("link", { name: "Tutoriels", exact: true })).toHaveCount(0);
      const boxes = (await sidebar.locator(".app-nav a").evaluateAll((links) => links.map((link) => ({ name: link.textContent?.trim() ?? "", top: link.getBoundingClientRect().top, bottom: link.getBoundingClientRect().bottom, height: link.getBoundingClientRect().height })))).filter((box) => box.height > 0);
      for (const box of boxes) {
        expect(box.top, box.name).toBeGreaterThanOrEqual(0);
        expect(box.bottom, box.name).toBeLessThanOrEqual(size.height);
        expect(box.height, box.name).toBeGreaterThanOrEqual(44);
      }
      expect(boxes.at(-1)!.name).toBe("Aide");
      expect(boxes.at(-2)!.name).toBe("Paramètres");
    });
  }
});

test.describe("74g (G5) — « Vos données »", () => {
  test("la titulaire : huit lignes, « Fermer l'espace » en dernier ; ouvert aussi par le menu du compte", async ({ page }) => {
    const { owner } = await organization();
    await enter(page, owner!, SIZES[0]);
    await page.goto("/");
    await page.locator(".account-menu-button").click();
    await page.getByRole("link", { name: /^Vos données/ }).click();
    await expect(page).toHaveURL("/donnees");
    await expect(page.locator(".your-data-line")).toHaveCount(8);
    await expect(page.locator(".your-data-line strong")).toHaveText([
      "Copie de toutes vos données",
      "Reprendre une copie Symbola",
      "Corbeille",
      "Historique des actions",
      "Historique des e-mails envoyés",
      "Demandes sur les données personnelles",
      "Stockage",
      "Comptabilité : exports, archive, facturation électronique",
    ]);
    await expect(page.locator("main > section").last()).toContainText("Fermer l'espace");
    await expect(page.getByRole("link", { name: "Reprendre et importer" })).toHaveAttribute("href", "/import");
    await expectNoAxeViolation(page);
  });

  test("un membre de l'équipe ne voit que ce qui lui était ouvert ; ni copie, ni fermeture", async ({ page }) => {
    const { member } = await organization({}, ["owner", "member"]);
    await enter(page, member!, SIZES[2]);
    await page.goto("/donnees");
    await expect(page.locator(".your-data-line strong")).toHaveText(["Corbeille", "Historique des e-mails envoyés", "Comptabilité : exports, archive, facturation électronique"]);
    await expect(page.getByText("Fermer l'espace")).toHaveCount(0);
    expect(yourDataLines({ ...ALL, isOwner: false })).toHaveLength(3);
  });

  test("isolation : chaque titulaire lit son espace, pas celui d'une autre organisation", async ({ page }) => {
    const a = (await organization()).owner!;
    const b = (await organization()).owner!;
    await enter(page, b, SIZES[0]);
    await page.goto("/donnees");
    const main = page.getByRole("main");
    await expect(main.getByText(b.name)).toBeVisible();
    await expect(main.getByText(a.name)).toHaveCount(0);
  });
});

test.describe("74g (critère 2) — Les anciennes adresses", () => {
  test("les rubriques fondues mènent à leur bloc ; les ancres de l'ancien « Entreprise et TVA » à leur rubrique", async ({ page }) => {
    const { owner } = await organization();
    await enter(page, owner!, SIZES[0]);
    for (const [from, to, block] of [
      ["/events/parametres/termes", /\/events\/parametres\/types#termes$/, "Termes pour désigner les clients"],
      ["/events/parametres/contact", /\/events\/parametres\/etapes#contact$/, "Formulaire de contact"],
      ["/events/parametres/repas", /\/events\/parametres\/regimes#repas$/, "Types de repas"],
      ["/budget/parametres", /\/events\/parametres#repartition$/, "Modèles de budget"],
      ["/parametres#tva-debits", /\/parametres\/entreprise#tva-debits$/, "TVA sur les débits"],
      ["/parametres#informations-professionnel", /\/parametres\/mentions#informations-professionnel$/, "Informations du professionnel"],
    ] as const) {
      await page.goto(from);
      await expect(page, from).toHaveURL(to);
      await expect(page.getByRole("heading", { name: block }).first(), from).toBeVisible();
    }
  });

  test("sans le module Évènements, la répartition du budget garde son adresse et le titre de sa rubrique", async ({ page }) => {
    const { owner } = await organization({ events: false });
    await enter(page, owner!, SIZES[0]);
    await page.goto("/budget/parametres");
    await expect(page).toHaveURL(/\/budget\/parametres$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Budget : postes de départ et répartition");
  });
});

test.describe("74g — Abus : rôle, module, Comptable", () => {
  test("un membre qui ouvre une rubrique de la titulaire a la même réponse qu'avant, sans ses commandes", async ({ page }) => {
    const { member } = await organization({}, ["owner", "member"]);
    await enter(page, member!, SIZES[0]);
    for (const path of ["/parametres/equipe", "/events/parametres/etapes", "/events/parametres/contact"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.getByRole("main").getByRole("button", { name: /Inviter|Ajouter|Enregistrer/ })).toHaveCount(0);
    }
    // Les rubriques que l'équipe lit : les commandes de la titulaire restent fermées.
    await page.goto("/parametres/automatisations");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Automatismes : en marche ou coupés");
    for (const control of await page.getByRole("main").getByRole("checkbox").all()) await expect(control).toBeDisabled();
  });

  test("une rubrique d'un module non souscrit, ou sa redirection, ne montre aucune erreur", async ({ page }) => {
    const { owner } = await organization({ quotes: false, guests: false });
    await enter(page, owner!, SIZES[0]);
    for (const path of ["/devis/catalogue", "/events/parametres/repas", "/events/parametres/regimes"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBeLessThan(500);
      await expect(page.getByRole("main")).not.toContainText(/Application error|Une erreur est survenue/);
    }
    await page.goto("/parametres");
    await expect(page.locator(".settings-home-label", { hasText: "Catalogue des prestations" })).toHaveCount(0);
  });

  test("le Comptable n'a ni les Paramètres ni « Vos données »", async ({ page }) => {
    const { accountant } = await organization({}, ["owner", "accountant"]);
    await enter(page, accountant!, SIZES[0]);
    for (const path of ["/parametres", "/donnees", "/parametres/entreprise"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/comptable/);
    }
  });
});

test.describe("74g (critère 7) — Les fenêtres", () => {
  for (const size of [SIZES[1], SIZES[2]]) {
    test(`une fenêtre ne dépasse pas la hauteur de l'écran moins 32 px — ${size.name}`, async ({ page }) => {
      const { owner } = await organization();
      await enter(page, owner!, size);
      await page.goto("/events/parametres/plages-occupees");
      await page.getByRole("main").getByRole("button").first().click();
      const dialog = page.locator("dialog[open]").first();
      await expect(dialog).toBeVisible();
      const height = await dialog.evaluate((element) => element.getBoundingClientRect().height);
      expect(height).toBeLessThanOrEqual(size.height - 32);
    });
  }
});
