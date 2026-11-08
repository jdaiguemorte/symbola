// Lot 13 (AIDE-12, ADR 0033) — captures réelles des écrans pour le centre
// d'aide, sur une organisation fictive (aucune donnée réelle) : démarrage par
// l'assistant comme une vraie wedding planner, quelques événements, devis,
// prestataires et budget, puis une capture de chaque écran en 1280 × 800, les
// repères ouverts sur les écrans qui en ont. Lancer :
//   pnpm --filter @symbola/app help:captures
// ou, pour quelques écrans seulement :
//   CAPTURES_ONLY=importFile pnpm --filter @symbola/app help:captures
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import {
  applyTaskTemplate,
  changeEventStatus,
  createProspect,
  createTaskTemplate,
  listDefaultVendorSlots,
  listProspectSources,
} from "../modules/events/service";
import { addQuoteLine, addScheduleItem, createCatalogItem, createQuote, sendQuote } from "../modules/quotes/service";
import { createAllocationModel, simulateEventBudget } from "../modules/budget/service";
import { createVendor, listVendorTypes } from "../modules/vendors/service";
import { HELP_SCREENS } from "../lib/help/screens";

const OUT = join(__dirname, "..", "public", "aide", "captures") + "/";

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
  await expect(page).toHaveURL(/\/demarrage/);
}

// Assistant de démarrage (ONB-03), comme une wedding planner : listes et modèles de départ.
async function runSetup(page: Page) {
  // Tant que le démarrage n'est pas fini, les écrans renvoient vers l'assistant.
  await page.goto("/events");
  await expect(page).toHaveURL(/\/demarrage/);
  await page.getByRole("radio", { name: /Wedding planner/ }).check();
  for (const step of [2, 3, 4, 5, 6]) {
    if (step === 3) await page.getByLabel("Forme juridique").selectOption("sas");
    if (step === 4) await page.getByRole("radio", { name: /Franchise en base/ }).check();
    await page.getByRole("button", { name: "Valider et continuer" }).click();
    await expect(page).toHaveURL(new RegExp(`/demarrage\\?etape=${step}$`));
  }
  await page.getByRole("button", { name: "Terminer et découvrir Symbola" }).click();
  await expect(page).toHaveURL(/\/\?demarrage=termine$/);
}

async function seed(organizationId: string, userId: string) {
  const sources = await listProspectSources(organizationId);
  const source = sources[0]!;
  const slots = await listDefaultVendorSlots(organizationId);

  const make = async (clients: { firstName: string; lastName?: string }[], eventDate: string, venueName: string, venueCity: string) =>
    (await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: source.id, clients, eventDate, venueName, venueCity })).id;
  const confirmed = await make([{ firstName: "Léa", lastName: "Martin" }, { firstName: "Hugo" }], "2027-06-12", "Domaine des Tilleuls", "Lille");
  const quoted = await make([{ firstName: "Inès" }, { firstName: "Malik" }], "2027-09-04", "Château de la Roche", "Arras");
  await make([{ firstName: "Chloé" }, { firstName: "Antoine" }], "2027-05-22", "Moulin de Beauregard", "Amiens");
  await make([{ firstName: "Sarah" }, { firstName: "Yanis" }], "2028-07-01", "Ferme du Vert Bocage", "Lens");

  await changeEventStatus({ organizationId, eventId: confirmed, changedByUserId: userId, toStatus: "confirmed" });
  await changeEventStatus({ organizationId, eventId: quoted, changedByUserId: userId, toStatus: "quote_sent" });

  const template = await createTaskTemplate(organizationId, "Mariage — 12 mois", [
    { label: "Réserver le lieu de réception", offsetDays: -365, responsible: "planner" },
    { label: "Choisir le photographe", offsetDays: -300, responsible: "clients" },
    { label: "Envoyer les faire-part", offsetDays: -120, responsible: "clients" },
    { label: "Dégustation chez le traiteur", offsetDays: -90, responsible: "planner" },
    { label: "Plan de table définitif", offsetDays: -14, responsible: "clients" },
    { label: "Briefing des prestataires", offsetDays: -7, responsible: "planner" },
  ]);
  await applyTaskTemplate(organizationId, confirmed, template.id);

  const items = [
    await createCatalogItem(organizationId, { label: "Organisation complète", unit: "forfait", unitPriceCents: 450000, vatRateBasisPoints: 0, category: "Organisation" }),
    await createCatalogItem(organizationId, { label: "Coordination du jour J", unit: "forfait", unitPriceCents: 120000, vatRateBasisPoints: 0, category: "Organisation" }),
    await createCatalogItem(organizationId, { label: "Décoration florale", unit: "table", unitPriceCents: 8500, vatRateBasisPoints: 0, category: "Décoration" }),
    await createCatalogItem(organizationId, { label: "Recherche de prestataires", unit: "heure", unitPriceCents: 6000, vatRateBasisPoints: 0, category: "Conseil" }),
  ];
  const quote = await createQuote({ organizationId, eventId: confirmed, createdByUserId: userId });
  await addQuoteLine(organizationId, quote.id, { catalogItemId: items[0]!.id, quantityMilli: 1000 });
  await addQuoteLine(organizationId, quote.id, { catalogItemId: items[2]!.id, quantityMilli: 12000 });
  await addScheduleItem(organizationId, quote.id, { label: "Acompte à la signature", dueDate: "2026-11-20", percentageBasisPoints: 3000 });
  await addScheduleItem(organizationId, quote.id, { label: "Solde", dueDate: "2027-05-29", percentageBasisPoints: 7000 });
  await sendQuote({ organizationId, quoteId: quote.id });
  const second = await createQuote({ organizationId, eventId: quoted, createdByUserId: userId });
  await addQuoteLine(organizationId, second.id, { catalogItemId: items[1]!.id, quantityMilli: 1000 });
  await addScheduleItem(organizationId, second.id, { label: "Acompte", dueDate: "2026-12-05", percentageBasisPoints: 4000 });
  await sendQuote({ organizationId, quoteId: second.id });

  if (slots.length > 0) {
    const share = Math.floor(10000 / slots.length);
    const model = await createAllocationModel({
      organizationId,
      name: "Mariage 120 invités",
      items: slots.map((slot, index) => ({ defaultVendorSlotId: slot.id, percentageBasisPoints: index === 0 ? 10000 - share * (slots.length - 1) : share })),
    });
    await simulateEventBudget({ organizationId, eventId: confirmed, totalAmountCents: 3500000, guestCount: 120, allocationModelId: model.id });
  }

  // Lot 16 (PRE-14) : chaque fiche a son type de départ, pour que le carnet
  // montre plusieurs familles.
  const types = await listVendorTypes(organizationId);
  const typeOf = (starterKey: string) => types.find((type) => type.starterKey === starterKey)?.id ?? types[0]?.id ?? null;
  for (const [name, city, starterKey] of [
    ["Domaine des Tilleuls", "Lille", "venue"],
    ["Maison Verdier Traiteur", "Arras", "caterer"],
    ["Studio Lumière", "Amiens", "photographer"],
    ["Fleurs de Saison", "Lens", "florist"],
  ] as const) {
    await createVendor(organizationId, { name, typeId: typeOf(starterKey), city });
  }
  return { confirmed, quoteId: quote.id };
}

test("captures des écrans pour le centre d'aide", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  // Adresse lisible sur les captures (menu « Connecté comme… ») ; un suffixe
  // seulement si une capture précédente l'a déjà prise dans cette base.
  let email = "julie@atelier-exemple.test";
  const password = "mot-de-passe-captures";
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let userId: string;
  try {
    organizationId = (await createOrganization(db, "Atelier Exemple")).id;
    try {
      userId = (await createUser(db, { organizationId, email, password, role: "owner" })).id;
    } catch {
      email = `julie+${randomUUID().slice(0, 4)}@atelier-exemple.test`;
      userId = (await createUser(db, { organizationId, email, password, role: "owner" })).id;
    }
  } finally {
    await sql.end();
  }
  await login(page, email, password);
  await runSetup(page);
  const { confirmed, quoteId } = await seed(organizationId, userId);

  const dynamic: Record<string, string> = {
    eventsDetail: `/events/${confirmed}`,
    budgetDetail: `/budget/${confirmed}`,
    quotesDetail: `/devis/${quoteId}`,
  };
  // CAPTURES_ONLY=importFile,vendorBook : seulement ces écrans (lot qui n'en change que quelques-uns).
  const only = (process.env.CAPTURES_ONLY ?? "").split(",").filter(Boolean);
  for (const screen of HELP_SCREENS.filter((candidate) => candidate.capture && (only.length === 0 || only.includes(candidate.key)))) {
    const path = screen.path ?? dynamic[screen.key];
    if (!path) throw new Error(`pas d'adresse pour la capture ${screen.key}`);
    await page.goto(screen.tour ? `${path}${path.includes("?") ? "&" : "?"}visite=revoir` : path);
    await page.waitForLoadState("networkidle");
    if (screen.tour) {
      // Repères ouverts : la capture est annotée (repère 1 choisi).
      await expect(page.locator(".landmark-panel")).toBeVisible();
      await page.waitForTimeout(400);
      // Le repère choisi a pu faire défiler l'écran : la capture montre le haut de l'écran.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: `${OUT}${screen.key}.jpg`, type: "jpeg", quality: 72 });
  }
});
