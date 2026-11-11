// Lot 24a — ARC-07 (et preuve de l'écart ARC-01, ADR 0062) : l'app est jouée
// avec chacune des 16 combinaisons des quatre modules (Événements, Budget,
// Devis, Prestataires). Pour chacune : l'accueil, le menu, la recherche et les
// écrans de chaque module s'affichent sans erreur ; le menu ne montre que les
// modules souscrits ; un lien vers un module absent mène à « indisponible »
// (ou à « introuvable »), jamais à une erreur. En taille ordinateur et en
// 375 px.
import { randomUUID } from "node:crypto";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { createProspect, createProspectSource } from "../modules/events/service";
import { MODULE_KEYS, setModuleEnabled, type ModuleKey } from "../modules/hub/service";
import { createQuote } from "../modules/quotes/service";
import { createVendor } from "../modules/vendors/service";
import { mainMenu, readyOrganization } from "./helpers";

const MODULE_HOME: Record<ModuleKey, string> = { events: "/events", budget: "/budget", quotes: "/devis", vendors: "/prestataires" };
// Message « indisponible » propre à chaque module, et forme générale.
const MODULE_UNAVAILABLE: Record<ModuleKey, string> = {
  events: "Le module Événements n'est pas activé pour votre organisation.",
  budget: "Le module Budget n'est pas activé pour votre organisation.",
  quotes: "Le module Devis n'est pas activé pour votre organisation.",
  vendors: "Le carnet de prestataires n'est pas disponible pour votre organisation.",
};
const UNAVAILABLE = /n'est pas (activé|disponible) pour votre organisation/;
const NOT_FOUND = "Page introuvable";

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

async function organizationWithObjects() {
  const email = `owner-arc07-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-e2e-de-test";
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let userId: string;
  try {
    organizationId = (await readyOrganization(db, `Org ARC-07 ${randomUUID()}`)).id;
    userId = (await createUser(db, { organizationId, email, password, role: "owner" })).id;
  } finally {
    await sql.end();
  }
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: source.id, clients: [{ firstName: "Inès" }], eventDate: "2027-06-12" });
  const quote = await createQuote({ organizationId, eventId: event.id, createdByUserId: userId });
  const { vendor } = await createVendor(organizationId, { name: "Maison Verdier", typeId: null, city: "Lille" });
  return { organizationId, email, password, eventId: event.id, quoteId: quote.id, vendorId: vendor.id };
}

async function subscribe(organizationId: string, enabled: Set<ModuleKey>): Promise<void> {
  const { sql, db } = createAppConnection();
  try {
    for (const moduleKey of MODULE_KEYS) {
      await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey, enabled: enabled.has(moduleKey) });
    }
  } finally {
    await sql.end();
  }
}

function moduleOf(path: string): ModuleKey | null {
  if (path === "/events" || path.startsWith("/events/")) return "events";
  if (path === "/budget" || path.startsWith("/budget/")) return "budget";
  if (path === "/devis" || path.startsWith("/devis/")) return "quotes";
  if (path === "/prestataires" || path.startsWith("/prestataires/")) return "vendors";
  return null;
}

// Liens internes du contenu d'une page (hors menu), sans paramètres.
function linksOf(html: string): string[] {
  const main = html.slice(Math.max(0, html.indexOf("<main")));
  return [...new Set([...main.matchAll(/href="(\/[^"?#]*)/g)].map((match) => match[1]!))];
}

async function fetchPage(page: Page, path: string): Promise<{ status: number; html: string }> {
  const response = await page.request.get(path);
  // Texte rendu côté serveur : apostrophes et esperluettes échappées par React.
  const html = (await response.text()).replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
  return { status: response.status(), html };
}

test("ARC-07 — chaque combinaison de modules s'affiche sans erreur, et un module absent est indisponible", async ({ page }) => {
  test.setTimeout(300_000);
  const organization = await organizationWithObjects();
  await loginAndSetupMfa(page, organization.email, organization.password);
  const screens = [
    "/",
    "/recherche?q=Verdier",
    ...Object.values(MODULE_HOME),
    `/events/${organization.eventId}`,
    `/budget/${organization.eventId}`,
    `/devis/${organization.quoteId}`,
    `/prestataires/${organization.vendorId}`,
  ];

  for (let mask = 0; mask < 16; mask += 1) {
    const enabled = new Set(MODULE_KEYS.filter((_, index) => (mask >> index) & 1));
    const combination = `[${[...enabled].join(", ") || "aucun module"}]`;
    await subscribe(organization.organizationId, enabled);

    // Accueil et menu : seuls les modules souscrits y figurent.
    const home = await page.goto("/");
    expect(home!.status(), combination).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), combination).toBeVisible();
    for (const moduleKey of MODULE_KEYS) {
      await expect(mainMenu(page).locator(`a[href="${MODULE_HOME[moduleKey]}"]`), `${combination} ${moduleKey}`).toHaveCount(enabled.has(moduleKey) ? 1 : 0);
    }

    // Chaque écran répond sans erreur ; celui d'un module absent dit « indisponible ».
    const reached = new Set<string>();
    for (const screen of screens) {
      const { status, html } = await fetchPage(page, screen);
      expect(status, `${combination} ${screen}`).toBeLessThan(500);
      const owner = moduleOf(screen.split("?")[0]!);
      if (owner && !enabled.has(owner)) {
        expect(UNAVAILABLE.test(html) || html.includes(NOT_FOUND), `${combination} ${screen} : indisponible`).toBe(true);
        continue;
      }
      if (owner) expect(html.includes(MODULE_UNAVAILABLE[owner]), `${combination} ${screen} : disponible`).toBe(false);
      for (const link of linksOf(html)) {
        const target = moduleOf(link);
        if (target && !enabled.has(target)) reached.add(link);
      }
    }

    // Un lien vers un module absent, trouvé dans un écran, mène à « indisponible ».
    for (const link of reached) {
      const { status, html } = await fetchPage(page, link);
      expect(status, `${combination} lien ${link}`).toBeLessThan(500);
      expect(UNAVAILABLE.test(html) || html.includes(NOT_FOUND), `${combination} lien ${link} : indisponible`).toBe(true);
    }
  }
});
