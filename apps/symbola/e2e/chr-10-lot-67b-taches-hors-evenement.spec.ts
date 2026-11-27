// Lot 67b (CHR-10, HUB-08 ; recette du 24/11/2026, R01 et R02) — une tâche hors évènement se modifie
// depuis son panneau (lot 70c), et les compteurs de tâches (en-tête de la page, pastille du menu) la comptent.
// En taille ordinateur et en 375 px (projets Playwright), axe-core sur la fenêtre.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test } from "@playwright/test";
import { addStandaloneTask } from "../modules/events/service";
import { readyOrganization, signIn } from "./helpers";

test("CHR-10 — modifier une tâche hors évènement ; elle compte dans l'en-tête et la pastille « en retard »", async ({ page }) => {
  const { sql, db } = createAppConnection();
  let email: string;
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID()}`);
    email = `taches-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-67b", role: "owner" });
    // Échue depuis longtemps : en retard quel que soit le jour du test.
    await addStandaloneTask(organization.id, { label: "Déclaration de TVA", dueDate: "2026-01-20", recurrence: null });
  } finally {
    await sql.end();
  }
  await signIn(page, email, /\/$/);
  await page.goto("/taches");

  // R01 : la tâche hors évènement compte dans le décompte (elle était ignorée). Lot 70d : une seule liste,
  // « 1 tâche à faire sur 1 · 1 en retard ».
  await expect(page.locator(".task-count")).toHaveText("1 tâche à faire sur 1 · 1 en retard");

  // R02, lot 70c : le titre de la ligne ouvre le panneau unique de la tâche.
  const list = page.locator(".task-lines");
  await list.getByRole("link", { name: "Déclaration de TVA", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Déclaration de TVA" });
  await expect(dialog).toBeVisible();
  const result = await new AxeBuilder({ page }).include("dialog[open]").analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
  await dialog.getByLabel(/^Tâche/).fill("Déclaration de TVA du trimestre");
  await dialog.getByLabel(/^Échéance/).fill("2099-01-24");
  await dialog.getByLabel("Répétition").selectOption({ label: "Tous les trois mois" });
  await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();

  await expect(dialog).toBeHidden();
  const item = list.locator(".task-line").filter({ hasText: "Déclaration de TVA du trimestre" });
  await expect(item).toContainText("24 janv.");
  await expect(item).toContainText("Hors évènement");
  // Repoussée, elle n'est plus en retard.
  await expect(page.locator(".task-count")).toHaveText("1 tâche à faire sur 1");
});
