// Lot 11 — prestataires consultés (EVT-10/11) et carnet de prestataires
// (PRE-01 à PRE-07, HUB-12), en taille ordinateur et en 375 px, axe-core.
// Géocodeur simulé (hors production) ; pas de fond de carte installé : la
// liste, les filtres et les distances fonctionnent quand même.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import {
  acceptEventClientInvitation,
  addDefaultVendorSlots,
  createProspect,
  createProspectSource,
  inviteEventClient,
  listEventVendorSlots,
} from "../modules/events/service";
import { createVendor } from "../modules/vendors/service";
import { clickMenuLink, openMenu, readyOrganization } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).exclude(".vendor-map-canvas").analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function plannerLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
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

test("EVT-10 / EVT-11 — comparer deux devis pour une ligne du budget, retenir, et ce que voient les clients", async ({ page, browser }) => {
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
  const clientEmail = `client-${randomUUID()}@symbola.test`;
  const invitation = await inviteEventClient({ organizationId: planner.organizationId, eventId: event.id, email: clientEmail, invitedByUserId: planner.userId, locale: "fr" });
  await acceptEventClientInvitation(invitation.invitationToken!, "mot-de-passe-du-client");

  await plannerLogin(page, planner.email, "mot-de-passe-presta");
  await page.goto(`/events/${event.id}?onglet=budget&poste=${caterer.id}`);
  const candidates = page.getByRole("region", { name: "Prestataires consultés — Traiteur" });
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
  await expect(page.getByRole("region", { name: "Lignes du budget" }).getByRole("row", { name: /Traiteur/ })).toContainText("Devis demandé");

  // Devis, montré aux clients, notes « Clients » et interne.
  await tables.getByLabel("Montant du devis (€)").fill("4480");
  await tables.getByLabel("Montrer aux clients").check();
  await tables.getByRole("button", { name: "Enregistrer — Les Tables de Flandre" }).click();
  await expect(tables.getByText("Devis : 4 480,00 €")).toBeVisible();
  await tables.getByLabel("Nouvelle note sur Les Tables de Flandre").fill("Cuisine régionale, service en plateaux.");
  await tables.getByLabel("Visible par les clients").check();
  await tables.getByRole("button", { name: "Ajouter la note sur Les Tables de Flandre" }).click();
  await expect(tables.getByText("Cuisine régionale, service en plateaux.")).toBeVisible();
  await tables.getByLabel("Nouvelle note sur Les Tables de Flandre").fill("Négociable à 60 € par personne.");
  await tables.getByRole("button", { name: "Ajouter la note sur Les Tables de Flandre" }).click();
  await expect(tables.getByText("Négociable à 60 € par personne.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Lignes du budget" }).getByRole("row", { name: /Traiteur/ })).toContainText("Devis reçu");
  await expectNoAxeViolation(page);

  // Retenir : le poste est réservé avec ce prestataire et son montant.
  await tables.getByRole("button", { name: "Retenir Les Tables de Flandre" }).click();
  const row = page.getByRole("region", { name: "Lignes du budget" }).getByRole("row", { name: /Traiteur/ });
  await expect(row).toContainText("Les Tables de Flandre");
  await expect(row).toContainText("Réservé");
  await expect(row).toContainText("4 480,00 €");
  await expect(candidates.getByRole("listitem", { name: "Les Tables de Flandre" }).getByText("Retenu", { exact: true })).toBeVisible();
  await expect(candidates.getByRole("listitem", { name: "Maison Verdier" }).getByText("Non retenu")).toBeVisible();

  // Les clients voient l'option montrée et la note « Clients », rien d'autre.
  const clientContext = await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() });
  const client = await clientContext.newPage();
  await client.goto("/login");
  await client.getByLabel("E-mail").fill(clientEmail);
  await client.getByLabel("Mot de passe").fill("mot-de-passe-du-client");
  await client.getByRole("button", { name: "Se connecter" }).click();
  await expect(client).toHaveURL(/\/espace$/);
  await client.goto(`/espace/${event.id}`);
  const options = client.getByRole("region", { name: "Prestataires proposés" });
  await expect(options).toContainText("Les Tables de Flandre");
  await expect(options).toContainText("Cuisine régionale, service en plateaux.");
  await expect(options).toContainText("Devis : 4 480,00 €");
  await expect(options).not.toContainText("Négociable");
  await expect(options).not.toContainText("Maison Verdier");
  await expectNoAxeViolation(client);
  await clientContext.close();
});

test("PRE-01 à PRE-07 / HUB-12 — créer ses fiches, filtrer autour d'un lieu, retrouver par la recherche", async ({ page }) => {
  const planner = await plannerOrganization();
  await plannerLogin(page, planner.email, "mot-de-passe-presta");

  // Paramètres en pastilles : la solution « Prestataires » et ses réglages.
  await clickMenuLink(page, "Paramètres");
  const solutions = page.getByRole("navigation", { name: "Paramètres par module" });
  await solutions.getByRole("link", { name: "Prestataires", exact: true }).click();
  await expect(solutions.getByRole("link", { name: "Prestataires", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Ajouter les types de départ" }).click();
  await expect(page.getByRole("heading", { name: "Hôtel / hébergement" })).toBeVisible();
  await expectNoAxeViolation(page);

  // Deux fiches, placées sur la carte depuis leur ville.
  for (const vendor of [
    { name: "Hôtel du Beffroi", city: "Lille", beds: "62" },
    { name: "Gîte des Prés", city: "Arras", beds: "20" },
  ]) {
    await page.goto("/prestataires/nouveau");
    await page.getByLabel("Nom du prestataire").fill(vendor.name);
    await page.locator("select[name=typeId]").selectOption({ label: "Hôtel / hébergement" });
    await page.getByLabel("Ville").fill(vendor.city);
    await page.getByLabel("Couchages").fill(vendor.beds);
    await page.getByRole("button", { name: "Créer la fiche" }).click();
    await expect(page.getByRole("heading", { level: 1, name: vendor.name })).toBeVisible();
    await expect(page.getByText("Adresse placée sur la carte.")).toBeVisible();
  }
  await expectNoAxeViolation(page);

  // Carnet : type, au moins 40 couchages, à moins de 15 km de Lille.
  await openMenu(page);
  await page.locator("#app-menu").getByRole("link", { name: "Prestataires", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Carnet de prestataires" })).toBeVisible();
  await page.getByRole("navigation", { name: "Types de prestataires" }).getByRole("link", { name: "Hôtel / hébergement" }).click();
  const filters = page.getByRole("form", { name: "Filtres du carnet" });
  await filters.getByLabel("Autour de").fill("Lille");
  await filters.getByLabel("Couchages au moins").fill("40");
  await filters.getByRole("button", { name: "Filtrer" }).click();
  const results = page.getByRole("region", { name: /résultat/ });
  await expect(results.getByRole("heading", { level: 2 })).toHaveText("1 résultat autour de Lille, du plus proche au plus loin");
  await expect(results).toContainText("Hôtel du Beffroi");
  await expect(results).toContainText("(estimation)");
  await expect(results).not.toContainText("Gîte des Prés");
  await expect(page.getByRole("img", { name: /Carte : 1 prestataire placé/ })).toBeVisible();
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
