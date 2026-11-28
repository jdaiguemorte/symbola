// Lot 74b (EVT-01, EVT-05, CHR-01, CHR-02, DAT-07, UX-06 ; C-67, B7, L74-D2 ; spécification du lot 74, § 6.2 ; page
// 23 des maquettes du lot 68) — le premier mariage, à l'heure. Camille crée « Léa & Maxime », signé, dans
// 199 jours, avec le rétroplanning de départ (18 tâches, de J-365 à J+30) : la fenêtre annonce les 8 tâches
// qui tombent avant aujourd'hui, « Continuer » ouvre l'étape 2, rien n'y est coché ; ce qui est fait le reste,
// ce qui reste à faire reçoit une date à venir, le reste est « à dater ». Aucune tâche ne naît en retard.
// « Une demande en cours » ne crée ni tâche ni étape 2. En 1 440 et 375 px ; axe-core sur les deux étapes.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createUser, setUserNames } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { listEventTasks } from "../modules/events/service";
import { saveOnboardingStep } from "../modules/hub/service";
import { loadStarterKit } from "../lib/setup/starter-kit";
import { feedback, readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

function parisDay(offsetDays = 0): string {
  const day = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
}

// L'espace neuf de Camille, avec les modèles de départ d'une wedding planner (rétroplanning rattaché au mariage).
async function espaceNeuf() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier Roussel ${randomUUID().slice(0, 6)}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    await loadStarterKit(organizationId, "wedding_planner", "fr");
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, role: "owner" });
    await setUserNames(db, owner.id, { firstName: "Camille", lastName: "Roussel" });
    return { organizationId, email };
  } finally {
    await sql.end();
  }
}

async function fillStepOne(page: Page, input: { standing: "signed" | "enquiry"; name: string; date: string }) {
  await page.goto("/events/new");
  await page.getByRole("radio", { name: input.standing === "signed" ? /^Signé, en préparation/ : /^Une demande en cours/ }).check();
  await page.getByLabel(/^Nom de l'évènement/).fill(input.name);
  await page.getByLabel(/^Date/).fill(input.date);
}

const pastTask = (page: Page, label: string) => page.getByRole("group", { name: label, exact: true });

test.describe("lot 74b — le premier mariage, à l'heure", () => {
  test("critères 1 à 5 — le rétroplanning annoncé, l'étape 2 sans rien de coché, et aucune tâche en retard", async ({ page }) => {
    const setup = await espaceNeuf();
    await signIn(page, setup.email);
    const eventDate = parisDay(199);
    await fillStepOne(page, { standing: "signed", name: "Léa & Maxime", date: eventDate });

    // Critère 1 : l'annonce et son compte, avant toute création.
    await expect(page.getByText(/^Avec le rétroplanning « Rétroplanning mariage \(modèle de départ\) » · 18 tâches, dont 8 tombent avant aujourd'hui$/)).toBeVisible();
    await expect(page.getByText("Étape 1 sur 2")).toBeVisible();
    await expectNoAxeViolation(page);
    await noHorizontalScroll(page);
    await page.getByRole("button", { name: "Continuer" }).click();

    // L'étape 2 : huit tâches, aucune réponse cochée.
    await expect(page.getByRole("heading", { level: 2, name: "8 tâches tombaient avant aujourd'hui" })).toBeVisible();
    await expect(page.getByText("Étape 2 sur 2 · Léa & Maxime")).toBeVisible();
    const step = page.locator(".past-due-list");
    await expect(step.getByRole("group")).toHaveCount(8);
    for (const radio of await step.getByRole("radio").all()) await expect(radio).not.toBeChecked();
    await expect(page.getByRole("radio", { name: /^D'ici 4 semaines/ })).toBeChecked();
    await expectNoAxeViolation(page);
    await noHorizontalScroll(page);

    // « Tout reste à faire », puis deux tâches déjà faites et une laissée sans réponse.
    await page.getByRole("button", { name: "Tout reste à faire" }).click();
    await expect(page.getByText("0 faite · 8 à faire · 0 sans réponse")).toBeVisible();
    await pastTask(page, "Définir le budget global").getByText("Déjà fait").click();
    await pastTask(page, "Établir une première liste d'invités").getByText("Déjà fait").click();
    await expect(page.getByText("2 faites · 6 à faire · 0 sans réponse")).toBeVisible();
    await expect(pastTask(page, "Définir le budget global")).toContainText("faite, date de fin non renseignée");
    await expect(pastTask(page, "Réserver le lieu de réception")).toContainText(/redatée au /);
    await page.getByRole("button", { name: "Créer l'évènement" }).click();

    await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}/);
    await expect(feedback(page)).toContainText("Évènement créé");
    await expect(feedback(page)).toContainText("2 faites, 6 redatées, 0 à dater");
    const eventId = /\/events\/([0-9a-f-]{36})/.exec(page.url())![1]!;
    const { sql } = createAppConnection();
    try {
      const tasks = await listEventTasks(setup.organizationId, eventId, parisDay());
      expect(tasks).toHaveLength(18);
      // Critère 2 : aucune en retard ; critère 3 : faites ; critère 4 : redatées entre demain et J+28.
      expect(tasks.filter((task) => task.dueState?.kind === "late")).toHaveLength(0);
      expect(tasks.filter((task) => task.done)).toHaveLength(2);
      const tomorrow = parisDay(1);
      const limit = parisDay(28);
      const redated = tasks.filter((task) => !task.done && task.offsetDays !== null && task.offsetDays < -199);
      expect(redated).toHaveLength(6);
      for (const task of redated) expect(task.dueDate >= tomorrow && task.dueDate <= limit).toBe(true);
    } finally {
      await sql.end();
    }
    await page.goto(`/events/${eventId}?onglet=taches`);
    await expect(page.getByText(/2 faites sur 18 · 0 en retard/)).toBeVisible();
  });

  test("critère 5 — sans réponse, les tâches sont « à dater », comptées à part ; « Changer » retire le rétroplanning", async ({ page }) => {
    const setup = await espaceNeuf();
    await signIn(page, setup.email);
    await fillStepOne(page, { standing: "signed", name: "Inès & Sacha", date: parisDay(199) });
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("0 faite · 0 à faire · 8 sans réponse")).toBeVisible();
    await page.getByRole("button", { name: "Créer l'évènement" }).click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}/);
    await expect(feedback(page)).toContainText("0 faite, 0 redatée, 8 à dater");
    await page.goto(`${page.url().split("?")[0]}?onglet=taches`);
    await expect(page.getByText(/0 faites sur 18 · 0 en retard · 8 à dater/)).toBeVisible();
    await expect(page.getByText("À dater").first()).toBeVisible();
    await page.goto("/taches");
    await expect(page.getByText(/8 à dater/).first()).toBeVisible();

    // « Changer » : aucun rétroplanning, une seule étape.
    await fillStepOne(page, { standing: "signed", name: "Zoé & Hugo", date: parisDay(199) });
    await page.getByText("Changer", { exact: true }).click();
    await page.getByRole("radio", { name: "Aucun rétroplanning" }).check();
    await expect(page.getByText("Sans rétroplanning : les tâches s'ajoutent depuis la fiche.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuer" })).toHaveCount(0);
    await page.getByRole("button", { name: "Créer l'évènement" }).click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}/);
    await page.goto(`${page.url().split("?")[0]}?onglet=taches`);
    await expect(page.getByText(/0 faites sur 0/)).toBeVisible();
  });

  test("critère 8 — « Une demande en cours » ne crée ni tâche ni étape 2", async ({ page }) => {
    const setup = await espaceNeuf();
    await signIn(page, setup.email);
    await fillStepOne(page, { standing: "enquiry", name: "Chloé & Nathan", date: parisDay(199) });
    await expect(page.getByText(/^Avec le rétroplanning/)).toHaveCount(0);
    await page.getByRole("button", { name: "Créer l'évènement" }).click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}/);
    const eventId = /\/events\/([0-9a-f-]{36})/.exec(page.url())![1]!;
    const { sql } = createAppConnection();
    try {
      expect(await listEventTasks(setup.organizationId, eventId)).toHaveLength(0);
    } finally {
      await sql.end();
    }
  });
});
