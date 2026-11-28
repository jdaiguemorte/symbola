// Lot 33b (HUB-09, HUB-10, PAR-01 ; D9 à D11), revu au lot 74a (C-68, D6, D8) — démarrer : l'assistant
// d'abord, cinq questions au plus, une par écran, « Votre espace est prêt », exemple étiqueté puis supprimé au premier
// évènement réel, liste de prise en main de l'accueil. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";
import { submitNewEvent } from "./new-event";

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

// Lot 74a (C-68) : cinq questions au plus, un seul « Continuer » ; « Non, je pars de zéro » et la franchise.
async function answerToReady(page: Page) {
  for (let step = 1; step <= 2; step += 1) await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("radio", { name: /Non, je pars de zéro/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("radio", { name: /Non, mes prix sont sans TVA/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/demarrage\/pret$/);
}

test("HUB-09 / PAR-01 — une wedding planner répond aux questions, une par écran, puis reconnaît son métier dans « Votre espace est prêt »", async ({ page }) => {
  const email = await newOwner();
  await signIn(page, email);

  // D9 : les menus ne sont plus verrouillés. Lot 74a (C-68) : l'accueil mène d'abord à l'assistant.
  await page.goto("/events");
  await expect(page).toHaveURL(/\/events$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/demarrage$/);
  await expect(page.getByRole("heading", { level: 1, name: "Quel est votre métier ?" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Wedding planner/ })).toBeChecked();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByRole("checkbox", { name: "Mariage" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Séminaire" })).not.toBeChecked();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("radio", { name: /Oui, j'ai des mariages en cours/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("checkbox", { name: "Un tableur (Excel, Google Sheets…)" }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("radio", { name: /Non, mes prix sont sans TVA/ }).check();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/demarrage\/pret$/);
  await expect(page.getByRole("heading", { level: 1, name: /^Votre espace est prêt/ })).toBeVisible();
  const prepared = page.getByRole("region", { name: "Vos réponses, et ce qu'elles ont préparé" });
  await expect(prepared).toContainText("Wedding planner · mariage");
  await expect(prepared).toContainText(/Un rétroplanning « .+ », \d+ tâches/);
  await expect(prepared).toContainText(/Un budget de départ, \d+ postes/);
  await expect(prepared).toContainText("Pas de TVA sur vos prix (franchise en base)");
  // Lot 71b (PAR-01 ; I5, R3) : elle suit ses mariages dans un tableur : « Reprendre un mariage en cours »
  // d'abord, en bouton plein ; la création en second.
  const takeover = page.getByRole("region", { name: "Reprendre un mariage en cours" });
  await expect(takeover).toContainText("Vous suivez aujourd'hui vos mariages dans un tableur (Excel, Google Sheets…).");
  await expect(page.getByRole("link", { name: "Reprendre un mariage en cours" })).toHaveAttribute("href", "/reprise");
  await expect(page.getByRole("link", { name: "Créer un nouveau mariage" })).toHaveAttribute("href", "/events/new");
  await expectNoAxeViolation(page);

  // Prise en main (lot 63a) : l'indispensable seulement, même avec un tableur.
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Votre espace n'est pas tout à fait prêt" })).toHaveCount(0);
  const checklist = page.getByRole("region", { name: "Pour bien démarrer" });
  await expect(checklist.getByRole("listitem").first()).toHaveText("Régler l'essentiel : société, adresse, TVA");
  await expect(checklist.getByRole("listitem")).toHaveCount(2);
  await expect(checklist).toContainText("0 sur 2");
  // Lot 63f (ADR 0103) : « Régler l'essentiel » ouvre l'assistant, une question par écran.
  await expect(checklist.getByRole("link", { name: "Régler l'essentiel : société, adresse, TVA" })).toHaveAttribute("href", "/demarrage/essentiel");
  await expectNoAxeViolation(page);
});

test("HUB-09 — une agence répond au métier : les types de son métier sont proposés, et revenir sur une réponse reste possible", async ({ page }) => {
  const email = await newOwner();
  await signIn(page, email);
  await page.goto("/demarrage");
  await page.getByRole("radio", { name: /Agence évènementielle/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Quels évènements organisez-vous ?" })).toBeVisible();
  for (const type of ["Séminaire", "Soirée d'entreprise", "Lancement de produit"]) await expect(page.getByRole("checkbox", { name: type })).toBeChecked();
  await page.getByRole("button", { name: "Continuer" }).click();
  // La question des évènements en cours suit le métier.
  await expect(page.getByRole("heading", { level: 1, name: "Avez-vous déjà des évènements en cours ?" })).toBeVisible();
  await page.getByRole("radio", { name: /Non, je pars de zéro/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("radio", { name: /Oui, j'ajoute la TVA/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/demarrage\/pret$/);
  const prepared = page.getByRole("region", { name: "Vos réponses, et ce qu'elles ont préparé" });
  await expect(prepared).toContainText("Vos types d'évènements : Séminaire, Soirée d'entreprise, Lancement de produit");
  await expect(prepared).toContainText("Oui, vous ajoutez la TVA à vos prix (assujettie)");
  await expect(page.getByRole("link", { name: "Créer votre premier évènement" })).toHaveAttribute("href", "/events/new");
  // « Modifier mes réponses » rouvre une question déjà vue ; la progression ne recule pas.
  await page.getByRole("link", { name: "Modifier mes réponses" }).click();
  await expect(page.getByRole("radio", { name: /Agence évènementielle/ })).toBeChecked();
  await page.goto("/demarrage?etape=5");
  await expect(page.getByRole("radio", { name: /Oui, j'ajoute la TVA/ })).toBeChecked();
  await page.goto("/demarrage");
  await expect(page).toHaveURL(/\/demarrage\/pret$/);
});

test("HUB-10 / PAR-01 — l'exemple est étiqueté « Exemple » et ne contacte personne ; au premier évènement réel, sa suppression est proposée", async ({ page }) => {
  const email = await newOwner();
  await signIn(page, email);
  await page.goto("/demarrage");
  await answerToReady(page);

  await page.getByRole("button", { name: "Ouvrir un mariage d'exemple" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Exemple — données fictives" })).toBeVisible();
  await expect(page.getByText(/il ne contacte personne\. Il sera supprimé seul le \d+/)).toBeVisible();
  await page.goto("/events");
  await expect(page.getByRole("row", { name: /Léa & Maxime/ })).toContainText("Exemple");

  // Premier évènement réel, dans « Nouvel évènement » (lot 74a, D8) : le rétroplanning et les postes apparaissent.
  await page.goto("/demarrage/pret");
  await expect(page.getByRole("link", { name: "Revoir l'exemple" })).toBeVisible();
  await page.getByRole("link", { name: "Créer votre premier mariage" }).click();
  await expect(page).toHaveURL(/\/events\/new$/);
  await page.getByRole("radio", { name: /^Signé, en préparation/ }).check();
  await page.getByLabel(/^Nom de l'évènement/).fill("Chloé & Hugo");
  await page.getByLabel(/^Date/).fill("2027-09-18");
  await submitNewEvent(page);
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
