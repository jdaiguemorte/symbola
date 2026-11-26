// Lot 70b (UX-07, UX-10, UX-15, NFR-16, HUB-17, EVT-05 ; M5, M6, C-04, C-08, C-09, C-87 ; page 4 des
// maquettes du lot 68) — le retour après action, le danger, l'erreur de saisie. À 1 440 et 375 px.
//
// 1. « Fait » donne un message en bas à gauche du contenu, un seul à la fois, avec « Annuler » dix
//    secondes ; le temps s'arrête sous la souris ; « Annuler » rend l'état d'avant. Contraste mesuré.
// 2. « Annuler l'évènement… » : niveau 2, la fenêtre nomme l'évènement, dit la conséquence et propose
//    « Garder l'évènement » ; sur téléphone, elle prend la page et « Garder … » est le plus bas.
// 3. Un formulaire envoyé vide : aucune bulle du navigateur, une erreur en français sous chaque champ,
//    un résumé à partir de deux erreurs, la saisie gardée. axe-core sur la fenêtre et le formulaire.
// 4. Coupure réseau (NFR-16) : « Erreur : la tâche n'a pas été enregistrée … Réessayer », saisie gardée.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addEventTask, addLossReasons, changeEventStatus, createProspect, createProspectSource } from "../modules/events/service";
import { feedback, readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page, include?: string) {
  const builder = new AxeBuilder({ page });
  if (include) builder.include(include);
  const result = await builder.analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Atelier prêt, sa titulaire, le mariage confirmé de Léa et Maxime avec deux tâches.
async function atelier() {
  const email = `planner-70b-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    await addLossReasons(organization.id, [{ label: "Séparation", isFreeText: false }]);
    const event = await createProspect({
      organizationId: organization.id,
      createdByUserId: owner.id,
      prospectSourceId: source.id,
      clients: [
        { firstName: "Léa", lastName: "Morel" },
        { firstName: "Maxime", lastName: "Petit" },
      ],
      eventDate: "2027-06-12",
    });
    await changeEventStatus({ organizationId: organization.id, eventId: event.id, changedByUserId: owner.id, toStatus: "confirmed" });
    const first = await addEventTask(organization.id, event.id, { label: "Choisir le fleuriste", dueDate: "2027-03-01", responsible: "planner" });
    const second = await addEventTask(organization.id, event.id, { label: "Réserver la navette", dueDate: "2027-04-01", responsible: "planner" });
    return { email, eventId: event.id, firstTaskId: first.id, secondTaskId: second.id };
  } finally {
    await sql.end();
  }
}

// Rapport de contraste WCAG entre deux couleurs « rgb(r, g, b) ».
function contrast(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const [r, g, b] = (color.match(/\d+/g) ?? []).slice(0, 3).map((value) => {
      const channel = Number(value) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

for (const size of [
  { name: "1 440 px", width: 1440, height: 900 },
  { name: "375 px", width: 375, height: 812 },
]) {
  test.describe(`Lot 70b — à ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    // Le projet « desktop » joue 1 440 px, le projet « mobile-375 » joue 375 px.
    test.beforeEach(({}, testInfo) => {
      test.skip((testInfo.project.name === "mobile-375") !== (size.width === 375), "taille jouée par l'autre projet");
    });

    test("UX-07 — « Fait » : un message en bas à gauche, « Annuler » dix secondes, le temps arrêté sous la souris", async ({ page }) => {
      test.setTimeout(120_000);
      const setup = await atelier();
      await signIn(page, setup.email, /\/$/);
      await page.goto(`/events/${setup.eventId}?onglet=retroplanning`);
      await page.waitForLoadState("networkidle");
      const check = page.locator(".task-check button").first();
      await check.click();

      const message = feedback(page);
      await expect(message).toHaveCount(1);
      await expect(message).toContainText("Tâche faite : Choisir le fleuriste");
      await expect(feedback(page).filter({ hasText: "Tâche faite : Choisir le fleuriste" })).toBeVisible();
      const undo = message.getByRole("button", { name: "Annuler", exact: true });
      await expect(undo).toBeVisible();

      // Critère 4 : en bas à gauche du contenu ; ni sur « Fait », ni hors de la fenêtre.
      const box = (await message.boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(box.x).toBeLessThan(viewport.width / 2);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.y + box.height).toBeGreaterThan(viewport.height - 120);
      const checkBox = (await check.boundingBox())!;
      const overlaps = !(checkBox.x > box.x + box.width || checkBox.x + checkBox.width < box.x || checkBox.y > box.y + box.height || checkBox.y + checkBox.height < box.y);
      expect(overlaps).toBe(false);
      // « Annuler » : un vrai bouton de 40 px.
      expect((await undo.boundingBox())!.height).toBeGreaterThanOrEqual(40);

      // M5 : contraste mesuré (encre, accent de nuit 9,7:1, texte secondaire 8,4:1).
      const colors = await message.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        undo: getComputedStyle(element.querySelector(".feedback-action")!).color,
        title: getComputedStyle(element.querySelector(".feedback-title")!).color,
      }));
      expect(contrast(colors.undo, colors.background)).toBeGreaterThanOrEqual(9.6);
      expect(contrast(colors.title, colors.background)).toBeGreaterThanOrEqual(4.5);

      // Critère 3 : sous la souris, le temps s'arrête (plus de dix secondes, le message reste).
      await message.hover();
      await expect(message).toHaveAttribute("data-paused", "true");
      await page.waitForTimeout(10_500);
      await expect(message).toBeVisible();

      // Critère 1 : « Annuler » rend l'état d'avant (le serveur revérifie les droits).
      await undo.click();
      await expect(message).toContainText("Tâche remise à faire : Choisir le fleuriste");
      await expect(feedback(page)).toHaveCount(1);
      await expect(page.locator('.task-check button[aria-pressed="false"]').first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolation(page);
    });

    test("UX-07 — une seule zone de message : l'action suivante remplace la précédente", async ({ page }) => {
      test.setTimeout(120_000);
      const setup = await atelier();
      await signIn(page, setup.email, /\/$/);
      await page.goto(`/events/${setup.eventId}?onglet=retroplanning`);
      await page.waitForLoadState("networkidle");
      await page.locator('.task-check button[aria-pressed="false"]').first().click();
      await expect(feedback(page)).toContainText("Tâche faite : Choisir le fleuriste");
      await page.locator('.task-check button[aria-pressed="false"]').first().click();
      await expect(feedback(page)).toContainText("Tâche faite : Réserver la navette");
      await expect(feedback(page)).toHaveCount(1);
      await expect(page.locator(".feedback-region")).toHaveCount(1);
    });

    test("EVT-05 — « Annuler l'évènement… » : niveau 2, la conséquence, « Garder l'évènement » ; rétabli, il revient en Option", async ({ page }) => {
      test.setTimeout(120_000);
      const setup = await atelier();
      await signIn(page, setup.email, /\/$/);
      await page.goto(`/events/${setup.eventId}`);
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Annuler l'évènement…" }).click();
      const dialog = page.getByRole("dialog", { name: "Annuler l'évènement « Léa & Maxime » ?" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("Vous pourrez le rétablir depuis sa fiche");
      await expect(dialog).toContainText("ne peuvent plus ouvrir leur lien personnel");
      await expect(dialog).toContainText("Personne n'est prévenu par Symbola.");
      await expect(dialog.getByRole("button", { name: "Annuler", exact: true })).toHaveCount(0);
      const keep = dialog.getByRole("button", { name: "Garder l'évènement" });
      const confirm = dialog.getByRole("button", { name: "Annuler l'évènement", exact: true });
      const [keepBox, confirmBox] = [(await keep.boundingBox())!, (await confirm.boundingBox())!];
      if (size.width < 640) {
        // Sur téléphone : la page entière, « Garder l'évènement » le plus bas.
        expect((await dialog.boundingBox())!.width).toBeGreaterThanOrEqual(size.width - 1);
        expect(keepBox.y).toBeGreaterThan(confirmBox.y);
      } else {
        expect(keepBox.x).toBeLessThan(confirmBox.x);
      }
      await expectNoAxeViolation(page, "dialog[open]");

      // Renoncer ne change rien.
      await keep.click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("list", { name: "Statut de l'évènement" }).getByRole("listitem").filter({ hasText: "Confirmé" })).toHaveAttribute("aria-current", "step");

      // Annuler pour de bon, puis rétablir : il revient en « Option ».
      await page.getByRole("button", { name: "Annuler l'évènement…" }).click();
      await dialog.getByLabel("Motif (pour vous)").selectOption({ index: 1 });
      await dialog.getByRole("button", { name: "Annuler l'évènement", exact: true }).click();
      await expect(feedback(page).filter({ hasText: "Évènement annulé : Léa & Maxime" })).toBeVisible();
      await page.getByRole("button", { name: "Rétablir l'évènement" }).click();
      await expect(feedback(page).filter({ hasText: "Évènement rétabli : Léa & Maxime" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Statut de l'évènement" }).getByRole("listitem").filter({ hasText: "Option" })).toHaveAttribute("aria-current", "step");
      await expect(page.getByRole("button", { name: /Réactiver/ })).toHaveCount(0);
    });

    test("UX-10 — la tâche envoyée vide : pas de bulle, une erreur sous chaque champ, un résumé, la saisie gardée", async ({ page }) => {
      test.setTimeout(120_000);
      const setup = await atelier();
      await signIn(page, setup.email, /\/$/);
      await page.goto(`/events/${setup.eventId}?onglet=retroplanning&tache=${setup.firstTaskId}`);
      const dialog = page.getByRole("dialog", { name: "Modifier la tâche" });
      await expect(dialog).toBeVisible();
      const label = dialog.getByRole("textbox", { name: /Tâche/ }).first();
      await label.fill("");
      await dialog.locator('input[name="dueDate"]').fill("");
      // Aucune bulle du navigateur : le formulaire est en noValidate, Symbola parle.
      expect(await dialog.locator("form.task-dialog-form").evaluate((form) => (form as HTMLFormElement).noValidate)).toBe(true);
      await dialog.getByRole("button", { name: "Enregistrer" }).click();
      await expect(dialog.getByRole("alert")).toContainText("Erreur : 2 champs à remplir avant d'enregistrer la tâche.");
      await expect(dialog.getByText("Donnez un nom à la tâche, par exemple « Réserver la navette ».")).toBeVisible();
      await expect(dialog.getByText("Choisissez une date d'échéance.")).toBeVisible();
      await expect(label).toBeFocused();
      await expect(label).toHaveAttribute("aria-invalid", "true");
      await expectNoAxeViolation(page, "dialog[open]");

      // La saisie reste ; corrigée, l'erreur du champ s'efface et l'enregistrement part.
      await label.fill("Choisir la fleuriste");
      await expect(dialog.getByText("Donnez un nom à la tâche, par exemple « Réserver la navette ».")).toHaveCount(0);
      await dialog.locator('input[name="dueDate"]').fill("2027-03-02");
      await dialog.getByRole("button", { name: "Enregistrer" }).click();
      await expect(feedback(page).filter({ hasText: "Tâche enregistrée : Choisir la fleuriste" })).toBeVisible();
    });

    test("NFR-16 — la connexion coupée à l'enregistrement : « Réessayer », la saisie gardée", async ({ page, context }) => {
      test.setTimeout(120_000);
      const setup = await atelier();
      await signIn(page, setup.email, /\/$/);
      await page.goto(`/events/${setup.eventId}?onglet=retroplanning&tache=${setup.secondTaskId}`);
      const dialog = page.getByRole("dialog", { name: "Modifier la tâche" });
      await expect(dialog).toBeVisible();
      await page.waitForLoadState("networkidle");
      const label = dialog.getByRole("textbox", { name: /Tâche/ }).first();
      await label.fill("Réserver la navette des invités");
      await context.setOffline(true);
      await dialog.getByRole("button", { name: "Enregistrer" }).click();
      const message = feedback(page);
      await expect(message).toContainText("Erreur : la tâche n'a pas été enregistrée");
      await expect(message).toContainText("Connexion perdue. Votre saisie est gardée.");
      await expect(dialog).toBeVisible();
      await expect(label).toHaveValue("Réserver la navette des invités");
      await context.setOffline(false);
      await message.getByRole("button", { name: "Réessayer" }).click();
      await expect(feedback(page).filter({ hasText: "Tâche enregistrée : Réserver la navette des invités" })).toBeVisible();
    });
  });
}

test("UX-10 — « Nouvel évènement » envoyé vide : les erreurs de Symbola, en français, sous les champs", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await page.goto("/events/new");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Créer/ }).last().click();
  await expect(page.getByText("Indiquez le prénom du client, ou choisissez-le dans vos contacts.")).toBeVisible();
  await expect(page.getByText("Choisissez d'où vient la demande.")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Erreur : 2 champs à remplir avant de créer l'évènement." })).toBeVisible();
  await expect(page).toHaveURL(/\/events\/new/);
  await expectNoAxeViolation(page, "main");
});
