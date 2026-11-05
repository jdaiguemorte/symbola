// Lot 12 — premier démarrage (ONB-03/04), fiche événement (EVT-12 à
// EVT-15) et agenda cliquable (HUB-13), en taille ordinateur et en 375 px,
// axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { addDefaultVendorSlots, createProspect, createProspectSource } from "../modules/events/service";
import { clickMenuLink, readyOrganization } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function login(page: Page, email: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL(landing);
}

async function owner(ready: boolean) {
  const email = `planner-demarrage-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-demarrage";
  const { sql, db } = createAppConnection();
  try {
    const organization = ready ? await readyOrganization(db, `Org ${randomUUID()}`) : await createOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    return { organizationId: organization.id, userId: user.id, email, password };
  } finally {
    await sql.end();
  }
}

async function validate(page: Page, nextStep: number) {
  await page.getByRole("button", { name: "Valider et continuer" }).click();
  await expect(page).toHaveURL(new RegExp(`/demarrage\\?etape=${nextStep}$`));
}

async function runSetup(page: Page, metier: RegExp, expectedLine: string) {
  // Tant que le démarrage n'est pas fini, les autres écrans renvoient ici.
  await page.goto("/events");
  await expect(page).toHaveURL(/\/demarrage/);

  await page.getByRole("radio", { name: metier }).check();
  await validate(page, 2);
  await page.getByLabel("Forme juridique").selectOption("sas");
  await validate(page, 3);
  await page.getByRole("radio", { name: /Franchise en base/ }).check();
  await validate(page, 4);

  // Les lignes du budget du métier sont pré-remplies, avec leur icône.
  await expect(page.getByRole("textbox", { name: `Nom de la ligne ${expectedLine}` })).toHaveValue(expectedLine);
  await expectNoAxeViolation(page);
  await page.getByLabel("Ajouter une ligne (ex. Navettes)").fill("Navettes");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("textbox", { name: "Nom de la ligne Navettes" })).toHaveValue("Navettes");
  await validate(page, 5);
  await validate(page, 6);
  await page.getByRole("button", { name: "Terminer et découvrir Symbola" }).click();
  await expect(page).toHaveURL(/\/\?demarrage=termine$/);

  // Menus ouverts.
  await clickMenuLink(page, "Événements");
  await expect(page).toHaveURL(/\/events$/);
}

test("ONB-03 / ONB-04 — premier démarrage d'une wedding planner, paramètres pré-remplis", async ({ page }) => {
  const account = await owner(false);
  await login(page, account.email, account.password, /\/demarrage/);
  await runSetup(page, /Wedding planner/, "Lieu de réception");
});

test("ONB-03 / ONB-04 — premier démarrage d'une agence événementielle", async ({ page }) => {
  const account = await owner(false);
  await login(page, account.email, account.password, /\/demarrage/);
  await runSetup(page, /Agence événementielle/, "Technique son et lumière");
});

test("EVT-12 / EVT-13 / EVT-15 — statut en boutons, rétroplanning à la confirmation, lieux du programme", async ({ page }) => {
  const account = await owner(true);
  await addDefaultVendorSlots(account.organizationId, [{ label: "Lieu de réception", icon: "venue" }]);
  const source = await createProspectSource(account.organizationId, "Salon");
  const event = await createProspect({
    organizationId: account.organizationId,
    createdByUserId: account.userId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Inès" }],
    eventDate: "2027-06-12",
  });
  await login(page, account.email, account.password, /\/$/);

  // Prospect : pas de rétroplanning, on explique pourquoi.
  await page.goto(`/events/${event.id}?onglet=retroplanning`);
  await expect(page.locator("p.notice", { hasText: "Le rétroplanning démarre quand l'événement est confirmé" })).toBeVisible();

  // Statut en étapes : un clic suffit, puis le rétroplanning est proposé.
  const steps = page.getByRole("form", { name: "Statut de l'événement" });
  await expect(steps.getByRole("button", { name: "Prospect" })).toHaveAttribute("aria-current", "step");
  await steps.getByRole("button", { name: "Confirmé" }).click();
  await expect(steps.getByRole("button", { name: "Confirmé" })).toHaveAttribute("aria-current", "step");
  await expect(page.getByText("L'événement est confirmé : appliquer le rétroplanning ?")).toBeVisible();
  await expectNoAxeViolation(page);

  // Lieux saisis une fois, proposés ensuite dans le programme.
  await page.goto(`/events/${event.id}?onglet=programme`);
  await page.getByLabel("Nouveau lieu (ex. Lieu des préparatifs)").fill("Domaine des Tilleuls");
  await page.getByRole("button", { name: "Ajouter le lieu" }).click();
  await expect(page.getByText("✓ Lieu ajouté.")).toBeVisible();
  await expect(page.locator("#event-place-options option[value='Domaine des Tilleuls']")).toHaveCount(1);
  await expectNoAxeViolation(page);
});

test("HUB-13 — un clic sur une date libre de l'agenda crée un événement à cette date", async ({ page }) => {
  const account = await owner(true);
  await createProspectSource(account.organizationId, "Salon");
  await login(page, account.email, account.password, /\/$/);

  await page.goto("/?agenda=3");
  const agenda = page.locator("[data-tour='home-agenda']");
  const day = agenda.locator("details.agenda-create").nth(10);
  await day.locator("summary").click();
  await expectNoAxeViolation(page);
  await day.getByRole("link", { name: "Créer un événement à cette date" }).click();
  await expect(page).toHaveURL(/\/events\/new\?date=\d{4}-\d{2}-\d{2}&type=evenement$/);
  const date = new URL(page.url()).searchParams.get("date")!;
  await expect(page.getByRole("heading", { name: "Nouvel événement" })).toBeVisible();
  await expect(page.getByLabel("Date de l'événement")).toHaveValue(date);

  await page.getByLabel("Prénom du premier marié").fill("Léa");
  await page.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await page.getByRole("button", { name: "Créer l'événement" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("form", { name: "Statut de l'événement" }).getByRole("button", { name: "Confirmé" })).toHaveAttribute("aria-current", "step");
});
