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
import {
  changeEventStatus,
  createProspect,
  createTaskTemplate,
  listDefaultVendorSlots,
  listEventVendorSlots,
  listProspectSources,
  setEventWantedBudget,
} from "../modules/events/service";
import { addQuoteLine, addScheduleItem, createCatalogItem, createQuote, sendQuote } from "../modules/quotes/service";
import { confirmEventBudget, createAllocationModel, simulateEventBudget, updateBudgetLine } from "../modules/budget/service";
import { createVendor, createVendorTag, listVendorTypes } from "../modules/vendors/service";
import { createPrivacyRequest, saveDocumentDetails } from "../modules/hub/service";
import { fillRequiredMentions } from "../lib/test-fixtures/legal-mentions";
import { HELP_SCREENS } from "../lib/help/screens";
import { signIn } from "../e2e/helpers";

const OUT = join(__dirname, "..", "public", "aide", "captures") + "/";

// Lot 33a : lien magique et fournisseur d'identité, comme les parcours (e2e/helpers.ts).
async function login(page: Page, email: string) {
  await signIn(page, email);
}

// Lot 33b (HUB-09) : le questionnaire, comme une wedding planner ; « Passer » garde les réponses
// proposées (wedding planner, mariage, franchise en base) et charge les listes et modèles de départ.
async function runSetup(page: Page) {
  await page.goto("/demarrage");
  for (let step = 1; step <= 5; step += 1) await page.getByRole("button", { name: "Passer" }).click();
  await expect(page).toHaveURL(/\/demarrage\/pret$/);
}

async function seed(organizationId: string, userId: string) {
  const sources = await listProspectSources(organizationId);
  const source = sources[0]!;
  const slots = await listDefaultVendorSlots(organizationId);

  // Lot 36a (CRM-03) : les clients deviennent des contacts ; quelques coordonnées fictives pour la
  // liste des contacts.
  type Client = { firstName: string; lastName?: string; email?: string; phone?: string; city?: string };
  const make = async (clients: Client[], eventDate: string, venueName: string, venueCity: string) =>
    (await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: source.id, clients, eventDate, venueName, venueCity })).id;
  const confirmed = await make(
    [
      { firstName: "Léa", lastName: "Martin", email: "lea.martin@exemple.test", phone: "06 12 34 56 78", city: "Lille" },
      { firstName: "Hugo", lastName: "Martin", email: "hugo.martin@exemple.test", city: "Lille" },
    ],
    "2027-06-12",
    "Domaine des Tilleuls",
    "Lille",
  );
  const quoted = await make([{ firstName: "Inès", lastName: "Benali", email: "ines.benali@exemple.test", city: "Arras" }, { firstName: "Malik" }], "2027-09-04", "Château de la Roche", "Arras");
  await make([{ firstName: "Chloé", lastName: "Dubois", phone: "07 98 76 54 32", city: "Amiens" }, { firstName: "Antoine", lastName: "Dubois" }], "2027-05-22", "Moulin de Beauregard", "Amiens");
  await make([{ firstName: "Sarah" }, { firstName: "Yanis" }], "2028-07-01", "Ferme du Vert Bocage", "Lens");

  await changeEventStatus({ organizationId, eventId: confirmed, changedByUserId: userId, toStatus: "confirmed" });
  await changeEventStatus({ organizationId, eventId: quoted, changedByUserId: userId, toStatus: "in_preparation" });

  // Lot 34a (EVT-01, D8) : le rétroplanning de départ est né avec chaque évènement daté ; ce
  // modèle-ci reste dans la liste des modèles.
  await createTaskTemplate(organizationId, "Mariage — 12 mois", [
    { label: "Réserver le lieu de réception", offsetDays: -365, responsible: "planner" },
    { label: "Choisir le photographe", offsetDays: -300, responsible: "clients" },
    { label: "Envoyer les faire-part", offsetDays: -120, responsible: "clients" },
    { label: "Dégustation chez le traiteur", offsetDays: -90, responsible: "planner" },
    { label: "Plan de table définitif", offsetDays: -14, responsible: "clients" },
    { label: "Briefing des prestataires", offsetDays: -7, responsible: "planner" },
  ]);

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
    // Lot 28a (BUD-01, BUD-02) : budget estimé, enveloppe du client, une ligne engagée
    // et en partie payée, un devis reçu sur la suivante.
    await confirmEventBudget({ organizationId, eventId: confirmed, confirmedByUserId: userId });
    await setEventWantedBudget(organizationId, confirmed, 3500000);
    const [first, next] = await listEventVendorSlots(organizationId, confirmed);
    const amounts: [string | undefined, "quoted" | "committed" | "paid", number][] = [
      [first?.id, "quoted", 280000],
      [first?.id, "committed", 280000],
      [first?.id, "paid", 84000],
      [next?.id, "quoted", 275000],
    ];
    for (const [eventVendorSlotId, field, amountCents] of amounts) {
      if (eventVendorSlotId) await updateBudgetLine({ organizationId, eventId: confirmed, eventVendorSlotId, field, amountCents, changedByUserId: userId });
    }
  }

  // Lot 16 (L16-PRE-14) : chaque fiche a son type de départ, pour que le carnet
  // montre plusieurs familles.
  const types = await listVendorTypes(organizationId);
  const typeOf = (starterKey: string) => types.find((type) => type.starterKey === starterKey)?.id ?? types[0]?.id ?? null;
  const vendorIds: string[] = [];
  for (const [name, city, starterKey] of [
    ["Domaine des Tilleuls", "Lille", "venue"],
    ["Maison Verdier Traiteur", "Arras", "caterer"],
    ["Studio Lumière", "Amiens", "photographer"],
    ["Fleurs de Saison", "Lens", "florist"],
  ] as const) {
    vendorIds.push((await createVendor(organizationId, { name, typeId: typeOf(starterKey), city })).vendor.id);
  }
  // Lot 20 (décision 5) : quelques étiquettes, dont deux tranches de capacité
  // que l'écran Étiquettes propose de ranger en palier.
  for (const label of ["100 à 150 personnes", "150 à 200 personnes", "Champêtre", "Accès PMR"]) await createVendorTag(organizationId, label);
  return { confirmed, quoteId: quote.id, vendorId: vendorIds[0]! };
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
  await login(page, email);
  await runSetup(page);
  // Lot 31a (FAC-07) : un devis ne part qu'avec les mentions requises ; valeurs fictives (SAS de
  // l'assistant : immatriculation et capital en plus).
  await fillRequiredMentions(organizationId);
  const details = createAppConnection();
  try {
    await saveDocumentDetails(details.db, organizationId, { siret: null, contactEmail: null, contactPhone: null, website: null, vatNumber: null, registration: "RCS Sarlat 123 456 789", shareCapitalCents: 100_000 });
  } finally {
    await details.sql.end();
  }
  const { confirmed, quoteId, vendorId } = await seed(organizationId, userId);
  // Lot 18 (RGPD-07) : deux demandes fictives, dont une en alerte, pour que la
  // liste des demandes et le compteur du menu aient quelque chose à montrer.
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const privacy = createAppConnection();
  let privacyRequestId = "";
  try {
    privacyRequestId = (await createPrivacyRequest(privacy.db, { organizationId, userId, type: "access", personLabel: "Léa Martin", receivedOn: daysAgo(26) })).id;
    await createPrivacyRequest(privacy.db, { organizationId, userId, type: "rectification", personLabel: "Antoine", receivedOn: daysAgo(3) });
  } finally {
    await privacy.sql.end();
  }

  const dynamic: Record<string, string> = {
    eventsDetail: `/events/${confirmed}`,
    budgetDetail: `/budget/${confirmed}/detail`,
    quotesDetail: `/devis/${quoteId}`,
    // Lot 20 (AIDE-14, AIDE-16) : fiche d'un prestataire, recherche avec un
    // terme, dossier d'une demande RGPD à son étape « Données retrouvées ».
    vendorDetail: `/prestataires/${vendorId}`,
    search: "/recherche?q=Martin",
    privacyCase: `/rgpd/demandes/${privacyRequestId}?etape=found`,
  };
  // Lot 28a : écrans dont la capture commence plus bas (enveloppe et cinq montants du budget).
  const anchors: Partial<Record<string, string>> = { budgetDetail: "#envelope-title" };
  // CAPTURES_ONLY=importFile,vendorBook : seulement ces écrans (lot qui n'en change que quelques-uns).
  const only = (process.env.CAPTURES_ONLY ?? "").split(",").filter(Boolean);
  for (const screen of HELP_SCREENS.filter((candidate) => candidate.capture && (only.length === 0 || only.includes(candidate.key)))) {
    const path = dynamic[screen.key] ?? screen.path;
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
    const anchor = anchors[screen.key];
    if (anchor) await page.locator(anchor).evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
    await page.screenshot({ path: `${OUT}${screen.key}.jpg`, type: "jpeg", quality: 72 });
  }
});
