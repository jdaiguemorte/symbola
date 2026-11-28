// Lot 33b (PAR-01, UX-04 ; partie L) — scénarios du cahier des charges (§ 17) :
// - SC-01 « Le premier quart d'heure », en entier, sur téléphone (375 × 812), chronométré : moins
//   de dix minutes de l'inscription au devis en brouillon, retrouvé sur un autre appareil ;
// - SC-10, étape 1, à 150 % de zoom (1 280 × 800 vu à 150 %) : inscription et questionnaire lus en
//   entier, sans défilement horizontal, sans fonction perdue.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { crossIdentityProvider, latestMagicLink, signIn } from "./helpers";
import { submitNewEvent } from "./new-event";

const TEN_MINUTES_MS = 10 * 60 * 1000;

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function signUp(page: Page, email: string) {
  await page.goto("/inscription");
  await page.getByLabel("Adresse e-mail").fill(email);
  const after = Date.now() - 1000;
  await page.getByRole("button", { name: "Recevoir mon lien" }).click();
  await expect(page.getByRole("status")).toContainText("vient de partir");
  await page.goto(await latestMagicLink(email, after));
  await crossIdentityProvider(page, null);
  await expect(page).toHaveURL(/\/demarrage$/);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("SC-01 / PAR-01 / UX-04 — le premier quart d'heure sur téléphone : de l'inscription au devis en brouillon, retrouvé ailleurs, en moins de dix minutes", async ({ page, browser }, testInfo) => {
  test.skip(page.viewportSize()!.width >= 768, "SC-01 se joue sur téléphone (375 px)");
  const started = Date.now();
  const email = `camille-sc01-${randomUUID()}@symbola.test`;

  // 1. Elle s'inscrit avec son e-mail et confirme.
  await signUp(page, email);

  // 2. Les questions (lot 74a, C-68, D6) : wedding planner, mariages, des mariages en cours dans un tableur, pas
  // de TVA. Le volume annuel n'est plus demandé (B2, L74-D5 : écart accepté avec l'étape 2 du scénario).
  await expect(page.getByRole("radio", { name: /Wedding planner/ })).toBeChecked();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByRole("checkbox", { name: "Mariage" })).toBeChecked();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("radio", { name: /Oui, j'ai des mariages en cours/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("checkbox", { name: "Un tableur (Excel, Google Sheets…)" }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("radio", { name: /Non, mes prix sont sans TVA/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();

  // 3. « Votre espace est prêt » : elle y reconnaît son métier et ce qui a été préparé.
  await expect(page.getByRole("heading", { level: 1, name: /^Votre espace est prêt/ })).toBeVisible();
  const prepared = page.getByRole("region", { name: "Vos réponses, et ce qu'elles ont préparé" });
  await expect(prepared).toContainText("Wedding planner · mariage");
  await expect(prepared).toContainText(/Un budget de départ, \d+ postes/);
  await expectNoAxeViolation(page);
  await noHorizontalScroll(page);

  // 4. Elle crée le mariage de Léa et Maxime dans « Nouvel évènement » (D8) : où il en est, nom, date.
  await page.getByRole("link", { name: "Créer un nouveau mariage" }).click();
  await expect(page).toHaveURL(/\/events\/new$/);
  await page.getByRole("radio", { name: /^Signé, en préparation/ }).check();
  await page.getByLabel(/^Nom de l'évènement/).fill("Léa & Maxime");
  await page.getByLabel(/^Date/).fill("2027-06-12");
  await submitNewEvent(page);
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  const eventUrl = page.url();

  // 5. Le rétroplanning et le budget générés.
  await page.goto(`${eventUrl}?onglet=taches`);
  await expect(page.getByText("Réserver le lieu de réception").first()).toBeVisible();
  await page.goto(`${eventUrl}?onglet=budget`);
  await expect(page.getByText("Traiteur").first()).toBeVisible();

  // 6. Elle commence un devis, depuis le modèle de départ de son métier, et le laisse en brouillon.
  await page.goto(`${eventUrl}?onglet=devis`);
  await page.getByRole("button", { name: "Créer un devis" }).click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);
  const quotePath = new URL(page.url()).pathname;
  await expect(page.getByText("Brouillon").first()).toBeVisible();

  // 7. Elle ferme l'onglet, rouvre sur son téléphone et retrouve tout.
  await page.close();
  const phone = await browser.newContext({
    baseURL: "http://localhost:3000",
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    locale: "fr-FR",
    storageState: { cookies: [{ name: "symbola_visites_auto", value: "0", domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] },
  });
  const again = await phone.newPage();
  await signIn(again, email);
  await again.goto("/events");
  await expect(again.getByRole("row", { name: /Léa & Maxime/ })).toBeVisible();
  await again.goto(quotePath);
  await expect(again.getByText("Brouillon").first()).toBeVisible();
  await phone.close();

  const elapsed = Date.now() - started;
  testInfo.annotations.push({ type: "durée SC-01", description: `${Math.round(elapsed / 1000)} s` });
  expect(elapsed).toBeLessThan(TEN_MINUTES_MS);
});

test("SC-10 / PAR-01 — étape 1 à 150 % : inscription et questionnaire lus en entier, sans défilement horizontal ni fonction perdue", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 768, "SC-10 se joue sur ordinateur, à 150 %");
  // 1 280 × 800 à 150 % de zoom : 853 × 533 pixels de mise en page.
  await page.setViewportSize({ width: 853, height: 533 });
  await signUp(page, `sophie-sc10-${randomUUID()}@symbola.test`);
  // Lot 74a (C-68, D6) : cinq questions, la quatrième (outils) seulement après « Oui ».
  const steps: { title: string; answer?: { role: "radio" | "checkbox"; name: RegExp | string } }[] = [
    { title: "Quel est votre métier ?" },
    { title: "Quels évènements organisez-vous ?" },
    { title: "Avez-vous déjà des mariages en cours ?", answer: { role: "radio", name: /Oui, j'ai des mariages en cours/ } },
    { title: "Où les suivez-vous aujourd'hui ?", answer: { role: "checkbox", name: "Un tableur (Excel, Google Sheets…)" } },
    { title: "Vos devis portent-ils la TVA ?", answer: { role: "radio", name: /Non, mes prix sont sans TVA/ } },
  ];
  for (const [index, step] of steps.entries()) {
    await expect(page.getByRole("heading", { level: 1, name: step.title })).toBeVisible();
    await expect(page.getByText(`question ${index + 1} sur 5`)).toBeVisible();
    await noHorizontalScroll(page);
    await expectNoAxeViolation(page);
    // Revenir en arrière reste possible à chaque question (sauf la première).
    if (index > 0) await expect(page.getByRole("link", { name: "Question précédente" })).toBeVisible();
    if (step.answer) await page.getByRole(step.answer.role, { name: step.answer.name }).check();
    const next = page.getByRole("button", { name: "Continuer" });
    // « Continuer » collé en bas : dans la fenêtre sans défiler.
    await expect(next).toBeInViewport();
    await expect(page.getByRole("button", { name: "Passer" })).toHaveCount(0);
    await next.click();
  }
  await expect(page.getByRole("heading", { level: 1, name: /^Votre espace est prêt/ })).toBeVisible();
  await noHorizontalScroll(page);
  await expectNoAxeViolation(page);
});
