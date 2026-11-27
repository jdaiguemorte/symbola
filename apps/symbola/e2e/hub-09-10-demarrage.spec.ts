// Lot 33b (HUB-09, HUB-10, PAR-01 ; D9 à D11) — démarrer : questionnaire d'accueil en cinq
// questions, une par écran, « Votre espace est prêt », exemple étiqueté puis supprimé au premier
// évènement réel, liste de prise en main de l'accueil. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Une organisation neuve et sa Propriétaire, questionnaire pas encore commencé.
async function newOwner() {
  const email = `demarrage-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Atelier ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, role: "owner" });
  } finally {
    await sql.end();
  }
  return email;
}

async function question(page: Page, number: number, title: string) {
  await expect(page).toHaveURL(number === 1 ? /\/demarrage(\?etape=1)?$/ : new RegExp(`/demarrage\\?etape=${number}$`));
  await expect(page.getByText(`Question ${number} sur 5`)).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
}

async function skipToReady(page: Page) {
  for (let step = 1; step <= 5; step += 1) await page.getByRole("button", { name: "Passer" }).click();
  await expect(page).toHaveURL(/\/demarrage\/pret$/);
}

test("HUB-09 / PAR-01 — une wedding planner répond aux cinq questions, une par écran, puis reconnaît son métier dans « Votre espace est prêt »", async ({ page }) => {
  const email = await newOwner();
  await signIn(page, email);

  // D9 : les menus ne sont plus verrouillés ; l'accueil propose de reprendre le questionnaire.
  await page.goto("/events");
  await expect(page).toHaveURL(/\/events$/);
  await page.goto("/");
  await expect(page.getByRole("status").filter({ hasText: "Terminez la préparation de votre espace" })).toContainText("il reste 5 questions");
  await page.getByRole("link", { name: "Reprendre le questionnaire" }).click();

  await question(page, 1, "Quel est votre métier ?");
  await expect(page.getByRole("radio", { name: /Wedding planner/ })).toBeChecked();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Continuer" }).click();

  await question(page, 2, "Quels évènements organisez-vous ?");
  await expect(page.getByRole("checkbox", { name: "Mariage" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Séminaire" })).not.toBeChecked();
  await page.getByRole("button", { name: "Continuer" }).click();

  await question(page, 3, "Êtes-vous soumise à la TVA ?");
  await expect(page.getByRole("radio", { name: /Franchise en base/ })).toBeChecked();
  await page.getByRole("button", { name: "Continuer" }).click();

  await question(page, 4, "Combien d'évènements organisez-vous par an ?");
  await expect(page.getByRole("radio", { name: "De 11 à 25" })).toBeChecked();
  await page.getByRole("button", { name: "Continuer" }).click();

  await question(page, 5, "Que voulez-vous remplacer par Symbola ?");
  await page.getByRole("checkbox", { name: "Un tableur (Excel, Google Sheets…)" }).check();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Voir mon espace" }).click();

  await expect(page).toHaveURL(/\/demarrage\/pret$/);
  await expect(page.getByRole("heading", { level: 1, name: "Votre espace est prêt" })).toBeVisible();
  const prepared = page.getByRole("region", { name: "Voici ce que Symbola a préparé d'après vos réponses :" });
  await expect(prepared).toContainText("Vos types d'évènements : Mariage");
  await expect(prepared).toContainText(/\d+ tâches de rétroplanning/);
  await expect(prepared).toContainText(/\d+ postes de budget/);
  await expect(prepared).toContainText("Votre régime de TVA : franchise en base de TVA");
  // Lot 71b (PAR-01 ; I5, R3) : elle suit ses mariages dans un tableur : « Reprendre un mariage en cours »
  // d'abord, en bouton plein ; la création en second.
  const takeover = page.getByRole("region", { name: "Reprendre un mariage en cours" });
  await expect(takeover).toContainText("Vous suivez aujourd'hui vos mariages dans un tableur (Excel, Google Sheets…).");
  // Dans la carte à l'ordinateur, dans la barre collée en bas sur téléphone : un seul lien visible.
  await expect(page.getByRole("link", { name: "Reprendre un mariage en cours" })).toHaveAttribute("href", "/reprise");
  await expect(page.getByRole("heading", { name: "Créer un nouveau mariage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explorer avec un exemple" })).toBeVisible();
  await expectNoAxeViolation(page);

  // Prise en main (lot 63a) : l'indispensable seulement, même avec un tableur.
  await page.goto("/");
  await expect(page.getByText("Terminez la préparation de votre espace")).toHaveCount(0);
  const checklist = page.getByRole("region", { name: "Pour bien démarrer" });
  await expect(checklist.getByRole("listitem").first()).toHaveText("Régler l'essentiel : société, adresse, TVA");
  await expect(checklist.getByRole("listitem")).toHaveCount(2);
  await expect(checklist).toContainText("0 sur 2 faits");
  // Lot 63f (ADR 0103) : « Régler l'essentiel » ouvre l'assistant, une question par écran.
  await expect(checklist.getByRole("link", { name: "Régler l'essentiel : société, adresse, TVA" })).toHaveAttribute("href", "/demarrage/essentiel");
  await expectNoAxeViolation(page);
});

test("HUB-09 — une agence répond au métier puis « Passer » partout : les réponses proposées de son métier sont gardées", async ({ page }) => {
  const email = await newOwner();
  await signIn(page, email);
  await page.goto("/demarrage");
  await page.getByRole("radio", { name: /Agence évènementielle/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await question(page, 2, "Quels évènements organisez-vous ?");
  for (let step = 2; step <= 5; step += 1) await page.getByRole("button", { name: "Passer" }).click();
  await expect(page).toHaveURL(/\/demarrage\/pret$/);
  const prepared = page.getByRole("region", { name: "Voici ce que Symbola a préparé d'après vos réponses :" });
  await expect(prepared).toContainText("Vos types d'évènements : Séminaire, Soirée d'entreprise, Lancement de produit");
  await expect(prepared).toContainText("Votre régime de TVA : franchise en base de TVA");
  // Revenir sur une réponse reste possible ; la progression ne recule pas.
  await page.goto("/demarrage?etape=4");
  await expect(page.getByRole("radio", { name: "De 11 à 25" })).toBeChecked();
  await page.goto("/demarrage");
  await expect(page).toHaveURL(/\/demarrage\/pret$/);
});

test("HUB-10 / PAR-01 — l'exemple est étiqueté « Exemple » et ne contacte personne ; au premier évènement réel, sa suppression est proposée", async ({ page }) => {
  const email = await newOwner();
  await signIn(page, email);
  await page.goto("/demarrage");
  await skipToReady(page);

  await page.getByRole("button", { name: "Ouvrir l'exemple" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Exemple — données fictives" })).toBeVisible();
  await expect(page.getByText(/il ne contacte personne\. Il sera supprimé seul le \d+/)).toBeVisible();
  await page.goto("/events");
  await expect(page.getByRole("row", { name: /Léa & Maxime/ })).toContainText("Exemple");

  // Premier évènement réel : prénoms, date, type ; le rétroplanning et les postes apparaissent.
  await page.goto("/demarrage/pret");
  await expect(page.getByRole("link", { name: "Revoir l'exemple" })).toBeVisible();
  await page.getByLabel("Prénom du premier marié").fill("Chloé");
  await page.getByLabel("Prénom du second marié (facultatif)").fill("Hugo");
  await page.getByLabel("Date de l'évènement", { exact: true }).fill("2027-09-18");
  await page.getByRole("button", { name: "Créer l'évènement" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\?exemple=proposer$/);
  const eventUrl = page.url().replace(/\?.*$/, "");
  await expect(page.getByRole("heading", { name: "Votre premier évènement est créé" })).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Supprimer l'exemple" }).click();
  await expect(page.getByRole("status").filter({ hasText: "L'exemple et ses données fictives ont été supprimés." })).toBeVisible();

  await page.goto(`${eventUrl}?onglet=taches`);
  await expect(page.getByText("Définir le budget global").first()).toBeVisible();
  await page.goto(`${eventUrl}?onglet=budget`);
  await expect(page.getByText("Lieu de réception").first()).toBeVisible();
  await page.goto("/events");
  await expect(page.getByRole("row", { name: /Léa & Maxime/ })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /Chloé & Hugo/ })).toBeVisible();
});
