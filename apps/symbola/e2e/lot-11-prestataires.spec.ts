// Lot 11 — prestataires consultés (L11-EVT-10/11) et carnet de prestataires
// (L11-PRE-01 à L11-PRE-07, L11-HUB-12), en taille ordinateur et en 375 px, axe-core.
// Géocodeur simulé (hors production) ; pas de fond de carte installé : la
// liste, les filtres et les distances fonctionnent quand même.
import { bookFilters, bookResults, closeBookFilters } from "./vendor-book";
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import {
  addDefaultVendorSlots,
  createProspect,
  createProspectSource,
  createEventLink,
  listEventVendorSlots,
} from "../modules/events/service";
import { createVendor } from "../modules/vendors/service";
import { clickMenuLink, closeSlotWindow, openMenu, openSettingsRubric, openSlotDetails, openSlotWindow, readyOrganization, signIn as signInByLink, slotWindow } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function plannerLogin(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function plannerOrganization() {
  const email = `planner-presta-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-presta", role: "owner" });
    return { organizationId: organization.id, userId: user.id, email };
  } finally {
    await sql.end();
  }
}

test("L11-EVT-10 / L11-EVT-11 — comparer deux devis pour une ligne du budget, retenir, et ce que voient les clients", async ({ page, browser }) => {
  const planner = await plannerOrganization();
  await addDefaultVendorSlots(planner.organizationId, ["Lieu de réception", "Traiteur"]);
  const source = await createProspectSource(planner.organizationId, "Salon");
  const event = await createProspect({
    organizationId: planner.organizationId,
    createdByUserId: planner.userId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Inès" }],
    venueName: "Domaine des Tilleuls",
  });
  const caterer = (await listEventVendorSlots(planner.organizationId, event.id)).find((slot) => slot.label === "Traiteur")!;
  await createVendor(planner.organizationId, { name: "Maison Verdier", typeId: null, city: "Lille" });
  // Lot 26a : le client a un lien personnel (rubrique « Options de prestataires »).
  const clientLink = await createEventLink({
    organizationId: planner.organizationId,
    eventId: event.id,
    createdByUserId: planner.userId,
    audience: "client",
    locale: "fr",
    link: { personName: "Inès", email: `client-${randomUUID()}@symbola.test`, rights: { rubrics: ["vendor_options"], budgetScope: "all", sharedSlotIds: [] } },
  });

  await plannerLogin(page, planner.email, "mot-de-passe-presta");
  // Lot 65b (M14) : ?poste= ouvre la fenêtre du poste ; le détail des prestataires est sous la comparaison.
  await page.goto(`/events/${event.id}?onglet=budget&poste=${caterer.id}`);
  const candidates = await openSlotDetails(page, "Traiteur");
  await expect(candidates.getByText("Aucun prestataire consulté pour l'instant.", { exact: false })).toBeVisible();

  // Un prestataire du carnet, puis un autre saisi par son nom.
  await candidates.getByLabel("Dans mon carnet").selectOption({ label: "Maison Verdier — Lille" });
  await candidates.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(candidates.getByRole("listitem", { name: "Maison Verdier" })).toBeVisible();
  await candidates.getByLabel("Ou un nouveau prestataire (nom)").fill("Les Tables de Flandre");
  await candidates.getByLabel("L'ajouter aussi à mon carnet").uncheck();
  await candidates.getByRole("button", { name: "Ajouter", exact: true }).click();
  const tables = candidates.getByRole("listitem", { name: "Les Tables de Flandre" });
  await expect(tables).toBeVisible();
  // Lot 28a (PRE-02) : un prestataire ajouté est « en comparaison » (lot 73a, P2 : « Pressenti » ne s'affiche plus) ; le poste montre le statut le plus avancé.
  await closeSlotWindow(page, "Traiteur");
  await expect(page.getByRole("region", { name: "Budget et prestataires, par poste" }).getByRole("row", { name: /Traiteur/ })).toContainText("En comparaison");
  // Lot 65b : la ligne dit « 2 en comparaison ».
  await expect(page.getByRole("region", { name: "Budget et prestataires, par poste" }).getByRole("row", { name: /Traiteur/ })).toContainText("2 en comparaison");
  await openSlotWindow(page, "Traiteur");
  await openSlotDetails(page, "Traiteur");

  // Devis, montré aux clients, notes « Clients » et interne : dans la fenêtre du prestataire (lot 63d, #36).
  await tables.getByRole("button", { name: "Modifier Les Tables de Flandre" }).click();
  let card = page.getByRole("dialog", { name: "Les Tables de Flandre" });
  await card.getByLabel("Montant du devis (€)").fill("4480");
  await card.getByLabel("Montrer aux clients").check();
  await card.getByRole("button", { name: "Enregistrer — Les Tables de Flandre" }).click();
  // La ligne dit le devis et qu'il est montré aux clients.
  await expect(tables.locator(".vendor-choice-row-main")).toContainText("Devis : 4 480,00 €");
  await expect(tables.locator(".vendor-choice-row-main")).toContainText("Montré aux clients");
  await tables.getByRole("button", { name: "Modifier Les Tables de Flandre" }).click();
  card = page.getByRole("dialog", { name: "Les Tables de Flandre" });
  await card.getByLabel("Nouvelle note sur Les Tables de Flandre").fill("Cuisine régionale, service en plateaux.");
  await card.getByLabel("Visible par les clients").check();
  await card.getByRole("button", { name: "Ajouter la note sur Les Tables de Flandre" }).click();
  await expect(card.getByText("Cuisine régionale, service en plateaux.")).toBeVisible();
  await card.getByLabel("Nouvelle note sur Les Tables de Flandre").fill("Négociable à 60 € par personne.");
  await card.getByRole("button", { name: "Ajouter la note sur Les Tables de Flandre" }).click();
  await expect(card.getByText("Négociable à 60 € par personne.")).toBeVisible();
  await card.getByRole("button", { name: /^(Fermer|Retour)$/ }).click();
  await expectNoAxeViolation(page);

  // Lot 65b (M14 B) : la comparaison côte à côte, puis « Retenir » : le poste est engagé avec ce
  // prestataire et son montant ; l'autre est écarté (grisé).
  const comparison = slotWindow(page, "Traiteur").getByRole("table", { name: "Comparaison des prestataires de « Traiteur »" });
  await expect(comparison.getByRole("columnheader", { name: "Les Tables de Flandre" })).toBeVisible();
  await expect(comparison.getByRole("row", { name: /^Devis/ })).toContainText("4 480,00 €");
  await comparison.getByRole("button", { name: "Retenir — Les Tables de Flandre", exact: true }).click();
  await expect(comparison.getByRole("columnheader", { name: /Les Tables de Flandre Retenu/ })).toBeVisible();
  await expect(comparison.getByRole("row", { name: /^Où en est-on/ })).toContainText("Écarté");
  await closeSlotWindow(page, "Traiteur");
  const row = page.getByRole("region", { name: "Budget et prestataires, par poste" }).getByRole("row", { name: /Traiteur/ });
  await expect(row).toContainText("Les Tables de Flandre");
  await expect(row).toContainText("Retenu");
  await expect(row).toContainText("4 480,00 €");

  // Les clients voient l'option montrée et la note « Clients », rien d'autre.
  const clientContext = await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() });
  const client = await clientContext.newPage();
  await client.goto(clientLink.url);
  await expect(client).toHaveURL(/\/portail$/);
  const options = client.getByRole("region", { name: "Prestataires proposés" });
  await expect(options).toContainText("Les Tables de Flandre");
  await expect(options).toContainText("Cuisine régionale, service en plateaux.");
  await expect(options).toContainText("Devis : 4 480,00 €");
  await expect(options).not.toContainText("Négociable");
  await expect(options).not.toContainText("Maison Verdier");
  await expectNoAxeViolation(client);
  await clientContext.close();
});

test("L11-PRE-01 à L11-PRE-07 / L11-HUB-12 — créer ses fiches, filtrer autour d'un lieu, retrouver par la recherche", async ({ page }) => {
  const planner = await plannerOrganization();
  await plannerLogin(page, planner.email, "mot-de-passe-presta");

  // Lot 13 (L13-HUB-16) : rubrique « Types de prestataires » des Paramètres.
  await clickMenuLink(page, "Paramètres");
  const sections = page.getByRole("navigation", { name: "Rubriques des paramètres" });
  await openSettingsRubric(page, "Types de prestataires");
  await expect(sections.getByRole("link", { name: "Types de prestataires", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Ajouter les types de départ" }).click();
  // Lot 16 (L16-PRE-15) : types en tableau, rangés par famille.
  await expect(page.getByRole("region", { name: "Tableau des types" }).getByRole("link", { name: "Hôtel / hébergement" })).toBeVisible();
  await expectNoAxeViolation(page);

  // Deux fiches, placées sur la carte depuis leur ville.
  for (const vendor of [
    { name: "Hôtel du Beffroi", city: "Lille", beds: "62" },
    { name: "Gîte des Prés", city: "Arras", beds: "20" },
  ]) {
    // Lot 63e (ADR 0105, ADR 0107) : la fiche en rubriques, parcourues sans enregistrer, créée à la fin.
    await page.goto("/prestataires/nouveau");
    await page.getByLabel("Nom du prestataire").fill(vendor.name);
    const rubrics = page.getByRole("navigation", { name: "Rubriques de la fiche" });
    await rubrics.getByRole("button", { name: "Métiers et étiquettes" }).click();
    await page.getByRole("checkbox", { name: "Hôtel / hébergement" }).check();
    await page.getByLabel("Couchages").fill(vendor.beds);
    await rubrics.getByRole("button", { name: "Coordonnées" }).click();
    await page.getByLabel("Ville").fill(vendor.city);
    await rubrics.getByRole("button", { name: "Tarifs et note" }).click();
    await page.getByRole("button", { name: "Créer la fiche" }).click();
    await expect(page.getByRole("heading", { level: 1, name: vendor.name })).toBeVisible();
    await expect(page.getByText("Adresse placée sur la carte.")).toBeVisible();
  }
  await expectNoAxeViolation(page);

  // Carnet : type, au moins 40 couchages, à moins de 15 km de Lille.
  await openMenu(page);
  await page.locator("#app-menu").getByRole("link", { name: "Prestataires", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Carnet de prestataires" })).toBeVisible();
  // Lot 16 (L16-PRE-14) : la famille, puis le type en second rang.
  await page.getByRole("navigation", { name: "Familles de prestataires" }).getByRole("link", { name: /^Lieux et hébergement/ }).click();
  await page.getByRole("navigation", { name: "Types de la famille Lieux et hébergement" }).getByRole("link", { name: /^Hôtel \/ hébergement/ }).click();
  // Lot 13 (L13-PRE-12) : barre de filtres ; l'adresse et les nombres
  // s'appliquent en quittant le champ ou avec Entrée.
  // Lot 73b : « Où ? » (sur téléphone, dans le panneau « Filtres ») ; un lieu trie par distance et
  // écrit le trajet sur la ligne.
  const filters = await bookFilters(page);
  await filters.getByLabel("Où ?").fill("Lille");
  await filters.getByLabel("Couchages au moins").fill("40");
  await filters.getByLabel("Couchages au moins").press("Enter");
  await closeBookFilters(page);
  const results = bookResults(page);
  await expect(results.getByRole("heading", { level: 2 })).toHaveText(/^1 fiche sur \d+, par distance$/);
  await expect(results).toContainText("Hôtel du Beffroi");
  await expect(results).toContainText("≈");
  await expect(results).not.toContainText("Gîte des Prés");
  // Lot 73b (V2) : la carte est une vue, « Liste · Carte ».
  await page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: "Carte" }).click();
  await expect(page.getByRole("region", { name: /Carte : 1 prestataire placé/ })).toBeVisible();
  await expect(page.getByText("Fond de carte non installé", { exact: false })).toBeVisible();
  await expectNoAxeViolation(page);

  // Export CSV de la sélection.
  const csv = await page.request.get(`/prestataires/export?format=csv&type=${new URL(page.url()).searchParams.get("type")}&autour=Lille&min_x=1`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Hôtel du Beffroi");

  // Recherche globale : la fiche se retrouve par son nom.
  const box = page.getByRole("combobox", { name: "Rechercher" });
  await box.fill("beffroi");
  await expect(page.getByRole("option").first()).toContainText("Hôtel du Beffroi");
});
