// Lot 74a (HUB-09, HUB-10, PAR-01, UX-04 ; C-68, D6, M13, B1 à B6, R3, L74-D4 ; page 22 des maquettes du lot 68) —
// l'assistant de démarrage et sa fin : l'assistant d'abord, cinq questions au plus, une par écran, un seul
// « Continuer » ; la question des mariages en cours choisit le premier pas ; la TVA dite avec les mots des devis ;
// « Votre espace est prêt » à trois issues ; la ligne « pas tout à fait prêt » de l'accueil. À 1 440 et 375 px
// (projets), et à 911 × 512 ; axe-core à chaque question. L'inscription par Logto est jouée par SC-01 et SC-10
// (sc-01-sc-10-demarrage.spec.ts).
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { createProspect, createProspectSource } from "../modules/events/service";
import { addQuoteLine, createQuote } from "../modules/quotes/service";
import { fillRequiredMentions } from "../lib/test-fixtures/legal-mentions";
import { signIn } from "./helpers";

test.describe.configure({ timeout: 120_000 });

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Une organisation neuve et sa titulaire, l'assistant pas encore commencé ; une collègue au besoin.
async function newOwner(options: { member?: boolean } = {}) {
  const email = `assistant-${randomUUID()}@symbola.test`;
  const memberEmail = `collegue-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Atelier ${randomUUID()}`);
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    if (options.member) await createUser(db, { organizationId: organization.id, email: memberEmail, role: "member" });
    return { email, memberEmail, organizationId: organization.id, userId: owner.id };
  } finally {
    await sql.end();
  }
}

async function question(page: Page, number: number, total: number, title: string) {
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText(`Préparer votre espace · question ${number} sur ${total}`)).toBeVisible();
  // Un seul bouton : « Continuer » ; plus de « Passer » (C-68).
  await expect(page.getByRole("button", { name: "Passer" })).toHaveCount(0);
  const go = page.getByRole("button", { name: "Continuer" });
  await expect(go).toBeInViewport();
  // Sur téléphone, collé en bas mais au-dessus de la barre d'onglets : jamais caché dessous.
  const tabbar = page.locator(".app-tabbar");
  if (await tabbar.isVisible()) expect((await go.boundingBox())!.y + (await go.boundingBox())!.height).toBeLessThanOrEqual((await tabbar.boundingBox())!.y + 1);
}

const next = (page: Page) => page.getByRole("button", { name: "Continuer" }).click();

// Les deux questions dont la réponse est proposée d'avance (le métier, les types du métier).
async function firstTwo(page: Page) {
  await question(page, 1, 5, "Quel est votre métier ?");
  await expect(page.getByRole("radio", { name: /Wedding planner/ })).toBeChecked();
  await expectNoAxeViolation(page);
  await next(page);
  await question(page, 2, 5, "Quels évènements organisez-vous ?");
  await expect(page.getByRole("checkbox", { name: "Mariage" })).toBeChecked();
  await expectNoAxeViolation(page);
  await next(page);
  await question(page, 3, 5, "Avez-vous déjà des mariages en cours ?");
}

test.describe("HUB-09 — L'assistant d'abord, une question par écran (lot 74a)", () => {
  test("critères 1 et 3 à 5 — à la première connexion, la question 1 avant tout écran ; rien de coché sur un fait ; sans réponse, « Choisissez une réponse » ; « Non » compte la TVA « 4 sur 4 »", async ({ page }) => {
    const owner = await newOwner();
    await signIn(page, owner.email);
    // L'accueil mène à l'assistant tant qu'il n'est pas commencé.
    await page.goto("/");
    await expect(page).toHaveURL(/\/demarrage$/);
    await firstTwo(page);

    // Question 3 : aucune réponse cochée ; « Continuer » sans réponse le dit sous la question et ne passe pas.
    for (const name of [/Oui, j'ai des mariages en cours/, /Non, je pars de zéro/]) await expect(page.getByRole("radio", { name })).not.toBeChecked();
    await next(page);
    await expect(page.getByText("Choisissez une réponse.")).toBeVisible();
    await expect(page.getByRole("group", { name: "Avez-vous déjà des mariages en cours ?" })).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/demarrage(\?etape=3)?$/);
    await expectNoAxeViolation(page);
    await page.getByRole("radio", { name: /Non, je pars de zéro/ }).check();
    await next(page);

    // Après « Non », la question des outils ne se pose pas : la TVA est la quatrième sur quatre.
    await question(page, 4, 4, "Vos devis portent-ils la TVA ?");
    for (const name of [/Non, mes prix sont sans TVA/, /Oui, j'ajoute la TVA/, /Je ne sais pas encore/]) await expect(page.getByRole("radio", { name })).not.toBeChecked();
    await expect(page.getByText("Tout reste modifiable ensuite dans les Paramètres.")).toBeVisible();
    await expectNoAxeViolation(page);
    // « Question précédente » ramène à la question 3, réponse gardée.
    await page.getByRole("link", { name: "Question précédente" }).click();
    await expect(page.getByRole("radio", { name: /Non, je pars de zéro/ })).toBeChecked();
    await next(page);
    await page.getByRole("radio", { name: /Non, mes prix sont sans TVA/ }).check();
    await next(page);

    // Critères 7 et 8 : un seul bouton plein, « Créer votre premier mariage » ; « Préparé pour vous » et ses liens.
    await expect(page).toHaveURL(/\/demarrage\/pret$/);
    // L'écran s'ouvre par son haut, même sur téléphone après avoir défilé jusqu'à « Continuer ».
    await expect(page.getByRole("heading", { level: 1, name: /^Votre espace est prêt/ })).toBeInViewport();
    const first = page.getByRole("link", { name: "Créer votre premier mariage" });
    await expect(first).toHaveCount(1);
    await expect(first).toHaveClass(/button-link-primary/);
    await expect(first).toHaveAttribute("href", "/events/new");
    await expect(page.locator("main .button-link-primary:visible")).toHaveCount(1);
    const answers = page.getByRole("region", { name: "Vos réponses, et ce qu'elles ont préparé" });
    await expect(answers).toContainText("Aucun : vous partez de zéro");
    await expect(answers).toContainText("Pas de TVA sur vos prix (franchise en base)");
    await expect(answers).toContainText(/Un rétroplanning « .+ », \d+ tâches/);
    await expect(answers.getByRole("link", { name: "Voir les tâches" })).toHaveAttribute("href", "/events/modeles");
    await expect(answers.getByRole("link", { name: "Voir les postes" })).toHaveAttribute("href", "/events/parametres");
    await expect(answers.getByRole("link", { name: "Voir les types" })).toHaveAttribute("href", "/events/parametres/types");
    await expect(answers.getByRole("link", { name: "Modifier mes réponses" })).toHaveAttribute("href", "/demarrage?etape=1");
    await expect(page.getByRole("button", { name: "Ouvrir un mariage d'exemple" })).toBeVisible();
    // Sur téléphone, le premier pas et l'exemple collés en bas, au-dessus de la barre d'onglets.
    const tabbar = page.locator(".app-tabbar");
    if (await tabbar.isVisible()) {
      const example = (await page.getByRole("button", { name: "Ouvrir un mariage d'exemple" }).boundingBox())!;
      expect(example.y + example.height).toBeLessThanOrEqual((await tabbar.boundingBox())!.y + 1);
    }
    // Le formulaire en ligne et sa case du rétroplanning cochée d'avance sont partis (C-67).
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expectNoAxeViolation(page);
    await first.click();
    await expect(page).toHaveURL(/\/events\/new$/);
    await expect(page.getByRole("radio", { name: /^Signé, en préparation/ })).not.toBeChecked();
    await expect(page.getByRole("radio", { name: /^Une demande en cours/ })).not.toBeChecked();
  });

  test("critère 2 — interrompue après la question 3, l'accueil dit « 2 questions sur 5 restent » ; « Continuer les questions » y ramène ; aucune visite avant la fin", async ({ page, context }) => {
    const owner = await newOwner();
    // Les visites automatiques sont permises dans ce parcours : aucune ne doit s'ouvrir avant la fin.
    await context.clearCookies({ name: "symbola_visites_auto" });
    await signIn(page, owner.email);
    await page.goto("/demarrage");
    await firstTwo(page);
    await page.getByRole("radio", { name: /Oui, j'ai des mariages en cours/ }).check();
    await next(page);
    await question(page, 4, 5, "Où les suivez-vous aujourd'hui ?");
    for (const box of await page.getByRole("checkbox").all()) await expect(box).not.toBeChecked();

    // Elle va à l'accueil : la première fois de la session, l'assistant la reprend à la question 4.
    await page.goto("/");
    await expect(page).toHaveURL(/\/demarrage$/);
    await question(page, 4, 5, "Où les suivez-vous aujourd'hui ?");
    // Ensuite, l'accueil s'ouvre et le dit d'une ligne ; aucune visite ne s'ouvre.
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    const line = page.getByRole("region", { name: "Votre espace n'est pas tout à fait prêt" });
    await expect(line).toContainText("2 questions sur 5 restent, environ 1 minute.");
    await expect(page.getByText("Reprendre le questionnaire")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectNoAxeViolation(page);
    await line.getByRole("link", { name: "Continuer les questions" }).click();
    await question(page, 4, 5, "Où les suivez-vous aujourd'hui ?");
    // Rien n'est perdu au rechargement : la réponse de la question 3 est gardée.
    await page.reload();
    await page.getByRole("link", { name: "Question précédente" }).click();
    await expect(page.getByRole("radio", { name: /Oui, j'ai des mariages en cours/ })).toBeChecked();
  });

  test("critère 7 — « Oui » et un carnet seulement : « Entrer un mariage en cours » ouvre « Nouvel évènement » sur « Signé, en préparation »", async ({ page }) => {
    const owner = await newOwner();
    await signIn(page, owner.email);
    await page.goto("/demarrage");
    await firstTwo(page);
    await page.getByRole("radio", { name: /Oui, j'ai des mariages en cours/ }).check();
    await next(page);
    // Sans case cochée, rien ne passe.
    await next(page);
    await expect(page.getByText("Choisissez une réponse.")).toBeVisible();
    await page.getByRole("checkbox", { name: "Un carnet et du papier" }).check();
    await expectNoAxeViolation(page);
    await next(page);
    await question(page, 5, 5, "Vos devis portent-ils la TVA ?");
    await page.getByRole("radio", { name: /Oui, j'ajoute la TVA/ }).check();
    await next(page);
    await expect(page.getByRole("heading", { level: 2, name: "Commencez par un mariage en cours" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Vos réponses, et ce qu'elles ont préparé" })).toContainText("Oui, avec un carnet et du papier");
    const enter = page.getByRole("link", { name: "Entrer un mariage en cours" });
    await expect(enter).toHaveCount(1);
    await expect(enter).toHaveAttribute("href", "/events/new?ou=signe");
    await expect(page.getByRole("link", { name: "Reprendre un mariage en cours" })).toHaveCount(0);
    await expectNoAxeViolation(page);
    await enter.click();
    await expect(page.getByRole("radio", { name: /^Signé, en préparation/ })).toBeChecked();
  });

  test("critère 7 — « Oui » et un tableur : « Reprendre un mariage en cours » en bouton plein", async ({ page }) => {
    const owner = await newOwner();
    await signIn(page, owner.email);
    await page.goto("/demarrage");
    await firstTwo(page);
    await page.getByRole("radio", { name: /Oui, j'ai des mariages en cours/ }).check();
    await next(page);
    await page.getByRole("checkbox", { name: "Un tableur (Excel, Google Sheets…)" }).check();
    await next(page);
    await page.getByRole("radio", { name: /Non, mes prix sont sans TVA/ }).check();
    await next(page);
    const start = page.getByRole("link", { name: "Reprendre un mariage en cours" });
    await expect(start).toHaveCount(1);
    await expect(start).toHaveClass(/button-link-primary/);
    await expect(start).toHaveAttribute("href", "/reprise");
    await expect(page.getByRole("link", { name: "Créer un nouveau mariage" })).toHaveAttribute("href", "/events/new");
    await expectNoAxeViolation(page);
  });
});

test.describe("HUB-09 / L74-D4 — « Je ne sais pas encore » : aucun devis ne part sans la réponse (lot 74a, critère 9)", () => {
  test("« Envoyer le devis » ouvre la question de la TVA, sans « Je ne sais pas encore » ; la réponse donnée, le devis part", async ({ page }) => {
    const owner = await newOwner();
    await signIn(page, owner.email);
    await page.goto("/demarrage");
    await firstTwo(page);
    await page.getByRole("radio", { name: /Non, je pars de zéro/ }).check();
    await next(page);
    await page.getByRole("radio", { name: /Je ne sais pas encore/ }).check();
    await next(page);
    await expect(page.getByRole("region", { name: "Vos réponses, et ce qu'elles ont préparé" })).toContainText("Pas encore dite");

    // Un devis en brouillon, préparé à côté (mentions requises remplies).
    await fillRequiredMentions(owner.organizationId);
    const source = await createProspectSource(owner.organizationId, "Salon");
    const event = await createProspect({ organizationId: owner.organizationId, createdByUserId: owner.userId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }] });
    const quote = await createQuote({ organizationId: owner.organizationId, eventId: event.id, createdByUserId: owner.userId });
    await addQuoteLine(owner.organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150_000 });
    const quoteId = quote.id;

    await page.goto(`/devis/${quoteId}`);
    await expect(page.getByText("À l'envoi, vous direz si vos devis portent la TVA")).toBeVisible();
    await page.getByRole("button", { name: "Envoyer le devis" }).first().click();
    const ask = page.getByRole("group", { name: "Avant d'envoyer : vos devis portent-ils la TVA ?" });
    await expect(ask).toBeVisible();
    await expect(ask.getByRole("radio")).toHaveCount(2);
    await expect(ask.getByRole("radio", { name: /Je ne sais pas encore/ })).toHaveCount(0);
    await expectNoAxeViolation(page);
    await page.getByRole("button", { name: "Répondre et envoyer le devis" }).click();
    await expect(page.getByText("Choisissez une réponse.")).toBeVisible();
    await ask.getByRole("radio", { name: /Non, mes prix sont sans TVA/ }).check();
    await page.getByRole("button", { name: "Répondre et envoyer le devis" }).click();
    await expect(page.getByText("Devis envoyé").first()).toBeVisible();
  });
});

test.describe("HUB-09 — Un écran bas (911 × 512) : « Continuer » toujours dans la fenêtre (lot 74a)", () => {
  test("à chaque question, « Continuer » est visible sans défiler", async ({ page }) => {
    test.skip(page.viewportSize()!.width < 768, "joué à la taille d'un portable bas");
    await page.setViewportSize({ width: 911, height: 512 });
    const owner = await newOwner();
    await signIn(page, owner.email);
    await page.goto("/demarrage");
    await firstTwo(page);
    await page.getByRole("radio", { name: /Oui, j'ai des mariages en cours/ }).check();
    await next(page);
    await question(page, 4, 5, "Où les suivez-vous aujourd'hui ?");
    await page.getByRole("checkbox", { name: "Un autre logiciel de planning ou de gestion" }).check();
    await next(page);
    await question(page, 5, 5, "Vos devis portent-ils la TVA ?");
    await expectNoAxeViolation(page);
  });
});

test.describe("SEC-12 — Une collègue n'est jamais menée à l'assistant (lot 74a, critère 10)", () => {
  test("l'accueil s'ouvre pour elle ; l'assistant lui dit qui prépare l'espace", async ({ page }) => {
    const owner = await newOwner({ member: true });
    await signIn(page, owner.memberEmail);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("region", { name: "Votre espace n'est pas tout à fait prêt" })).toHaveCount(0);
    await page.goto("/demarrage");
    await expect(page.getByText("La titulaire du compte prépare votre espace. Les modules sont déjà ouverts.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuer" })).toHaveCount(0);
  });
});
